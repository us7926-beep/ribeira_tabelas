"""Testes do backend FastAPI (auth/JWT e contrato dos endpoints protegidos)."""
import hashlib
import json

import pytest
from fastapi.testclient import TestClient

SENHA = "segredo123"


@pytest.fixture
def cliente(monkeypatch):
    monkeypatch.setenv("TABLM_USERS", json.dumps({"teste": hashlib.sha256(SENHA.encode()).hexdigest()}))
    monkeypatch.setenv("JWT_SECRET", "segredo-de-teste-com-tamanho-suficiente-123")
    # garante ausência de Supabase neste teste
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_KEY", raising=False)
    from api.main import app
    return TestClient(app)


def _token(cliente) -> str:
    return cliente.post("/auth/login", json={"usuario": "teste", "senha": SENHA}).json()["token"]


def test_health_responde_ok(cliente):
    resposta = cliente.get("/health")
    assert resposta.status_code == 200
    assert resposta.json()["status"] == "ok"


def test_login_invalido_retorna_401(cliente):
    assert cliente.post("/auth/login", json={"usuario": "teste", "senha": "errada"}).status_code == 401


def test_login_valido_emite_token_e_me(cliente):
    resposta = cliente.post("/auth/login", json={"usuario": "teste", "senha": SENHA})
    assert resposta.status_code == 200
    token = resposta.json()["token"]
    assert cliente.get("/me").status_code == 401  # sem token
    me = cliente.get("/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["usuario"] == "teste"


def test_endpoint_de_dados_sem_supabase_retorna_503(cliente):
    token = _token(cliente)
    resposta = cliente.get("/incorporadoras", headers={"Authorization": f"Bearer {token}"})
    assert resposta.status_code == 503


def test_mercado_comparativo_calcula_kpis_de_csv(cliente):
    token = _token(cliente)
    csv = b"unidade,valor,area\n101,500000,50\n102,600000,60\n"
    resposta = cliente.post(
        "/mercado/comparativo",
        headers={"Authorization": f"Bearer {token}"},
        files={"arquivo": ("tabela.csv", csv, "text/csv")},
        data={"tipo": "Concorrente", "incorporadora": "Concorrente X"},
    )
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["linhas"] == 2
    assert corpo["kpis"]["preco_m2_medio"] == 10000  # 500000/50 e 600000/60
    assert corpo["colunas_detectadas"]["valor"] == "valor"


def test_incc_reajustar_aplica_percentual_via_csv(cliente):
    token = _token(cliente)
    csv = b"unidade,valor\n101,100000\n102,200000\n"
    resposta = cliente.post(
        "/incc/reajustar",
        headers={"Authorization": f"Bearer {token}"},
        files={"arquivo": ("tabela.csv", csv, "text/csv")},
        data={"variacao_pct": "10", "extra_pct": "0", "extra_valor": "0"},
    )
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["coluna_valor"] == "valor"
    assert corpo["registros"][0]["valor_reajustado"] == 110000.0  # 100000 * 1.10
    assert corpo["registros"][1]["valor_reajustado"] == 220000.0


def test_vendas_kpis_via_csv(cliente):
    token = _token(cliente)
    csv = b"unidade,valor,status\n101,100000,Vendido\n102,200000,Disponivel\n103,150000,Disponivel\n"
    resposta = cliente.post(
        "/vendas/kpis",
        headers={"Authorization": f"Bearer {token}"},
        files={"arquivo": ("tabela.csv", csv, "text/csv")},
    )
    assert resposta.status_code == 200
    corpo = resposta.json()
    kpis = corpo["kpis"]
    assert kpis["total_unidades"] == 3
    assert kpis["vendidas"] == 1
    assert kpis["disponiveis"] == 2
    # Sem coluna de modalidade nem sinais inferiveis -> nao monta distribuicao
    assert "distribuicao" not in corpo
    assert corpo["colunas"]["modalidade_origem"] is None


def _post_vendas(cliente, csv: bytes) -> dict:
    token = _token(cliente)
    resposta = cliente.post(
        "/vendas/kpis",
        headers={"Authorization": f"Bearer {token}"},
        files={"arquivo": ("tabela.csv", csv, "text/csv")},
    )
    assert resposta.status_code == 200, resposta.text
    return resposta.json()


def test_vendas_kpis_modalidade_explicita(cliente):
    """Coluna `modalidade` dedicada: agrupa direto e marca origem 'explicita'."""
    csv = (
        b"unidade,valor,status,modalidade\n"
        b"101,100000,Vendido,FGTS\n"
        b"102,200000,Vendido,Financiamento\n"
        b"103,150000,Vendido,FGTS\n"
        b"104,180000,Disponivel,FGTS\n"
    )
    corpo = _post_vendas(cliente, csv)
    assert corpo["colunas"]["modalidade_origem"] == "explicita"
    assert corpo["colunas"]["modalidade"] == "modalidade"
    distrib = {linha["modalidade"]: linha for linha in corpo["distribuicao"]}
    # so unidades VENDIDAS entram (104 esta Disponivel)
    assert distrib["FGTS"]["unidades_vendidas"] == 2
    assert distrib["Financiamento"]["unidades_vendidas"] == 1
    assert distrib["FGTS"]["vgv"] == 250000.0


def test_vendas_kpis_modalidade_inferida_por_nome(cliente):
    """Sem coluna dedicada, mas nome da unidade carrega FGTS/MCMV/SBPE."""
    csv = (
        b"unidade,valor,status\n"
        b"Apt 101 FGTS,100000,Vendido\n"
        b"Apt 102 MCMV,200000,Vendido\n"
        b"Apt 103 FGTS,150000,Vendido\n"
        b"Apt 104 SBPE,180000,Disponivel\n"
    )
    corpo = _post_vendas(cliente, csv)
    assert corpo["colunas"]["modalidade_origem"] == "inferida"
    distrib = {linha["modalidade"]: linha for linha in corpo["distribuicao"]}
    assert distrib["FGTS"]["unidades_vendidas"] == 2
    assert distrib["MCMV"]["unidades_vendidas"] == 1
    # SBPE estava Disponivel -> nao entra
    assert "SBPE" not in distrib


def test_vendas_kpis_modalidade_inferida_por_composicao(cliente):
    """Sem coluna dedicada nem nome conhecido: classifica pela composicao
    (subsidio>0 -> MCMV; financ>0 e entrada<25% -> Financiamento; so
    entrada ~ total -> A vista). Nome 'valor_financiado' evita o detect
    de modalidade pegar 'financiamento' como rotulo."""
    csv = (
        b"unidade,valor,status,entrada,valor_financiado,subsidio\n"
        b"101,300000,Vendido,30000,270000,0\n"
        b"102,200000,Vendido,200000,0,0\n"
        b"103,250000,Vendido,50000,175000,25000\n"
    )
    corpo = _post_vendas(cliente, csv)
    assert corpo["colunas"]["modalidade_origem"] == "inferida"
    distrib = {linha["modalidade"]: linha for linha in corpo["distribuicao"]}
    assert distrib["Financiamento"]["unidades_vendidas"] == 1
    assert distrib["À vista"]["unidades_vendidas"] == 1
    assert distrib["MCMV"]["unidades_vendidas"] == 1


# --------------------------------------------------------------------------- #
# PATCH/DELETE /benchmark/eventos/{id} (admin de promocoes, PR #42)
# --------------------------------------------------------------------------- #
def _auth(cliente):
    return {"Authorization": f"Bearer {_token(cliente)}"}


def test_patch_evento_body_vazio_retorna_400(cliente):
    """Validacao acontece antes de tocar o db — funciona sem Supabase."""
    r = cliente.patch("/benchmark/eventos/abc", headers=_auth(cliente), json={})
    assert r.status_code == 400


def test_patch_evento_sem_supabase_retorna_503(cliente):
    """Com body valido, cai no db.obter -> 503 sem SUPABASE_URL."""
    r = cliente.patch(
        "/benchmark/eventos/abc", headers=_auth(cliente), json={"descricao": "x"}
    )
    assert r.status_code == 503


def test_delete_evento_sem_supabase_retorna_503(cliente):
    r = cliente.delete("/benchmark/eventos/abc", headers=_auth(cliente))
    assert r.status_code == 503


def test_patch_evento_404_quando_id_inexistente(cliente, monkeypatch):
    from api import db

    monkeypatch.setattr(db, "obter", lambda _tabela, _id: None)
    r = cliente.patch(
        "/benchmark/eventos/zzz", headers=_auth(cliente), json={"descricao": "x"}
    )
    assert r.status_code == 404


def test_patch_evento_atualiza_quando_existe(cliente, monkeypatch):
    from api import db

    chamadas: list[tuple] = []
    monkeypatch.setattr(db, "obter", lambda tabela, id_: {"id": id_, "descricao": "antigo"})
    monkeypatch.setattr(
        db,
        "atualizar",
        lambda tabela, id_, campos: chamadas.append((tabela, id_, campos))
        or {"id": id_, **campos},
    )
    r = cliente.patch(
        "/benchmark/eventos/abc",
        headers=_auth(cliente),
        json={"descricao": "novo", "data_fim": "2026-12-31"},
    )
    assert r.status_code == 200
    corpo = r.json()
    assert corpo["descricao"] == "novo"
    assert corpo["data_fim"] == "2026-12-31"
    assert chamadas == [
        ("eventos_promocionais", "abc", {"descricao": "novo", "data_fim": "2026-12-31"})
    ]


def test_patch_evento_exclude_none_descarta_campos_omitidos(cliente, monkeypatch):
    """Campos nao enviados nao podem aparecer no UPDATE — protege contra
    wipe acidental (ex: nao enviei data_inicio, nao quero perder o valor)."""
    from api import db

    capturado: dict = {}

    def fake_update(_tabela, _id, campos):
        capturado.update(campos)
        return {"id": _id, **campos}

    monkeypatch.setattr(db, "obter", lambda _t, _i: {"id": "abc"})
    monkeypatch.setattr(db, "atualizar", fake_update)
    r = cliente.patch(
        "/benchmark/eventos/abc",
        headers=_auth(cliente),
        json={"descricao": "so a descricao muda"},
    )
    assert r.status_code == 200
    assert capturado == {"descricao": "so a descricao muda"}


def test_delete_evento_404_quando_id_inexistente(cliente, monkeypatch):
    from api import db

    monkeypatch.setattr(db, "obter", lambda _t, _i: None)
    r = cliente.delete("/benchmark/eventos/zzz", headers=_auth(cliente))
    assert r.status_code == 404


def test_delete_evento_remove_quando_existe(cliente, monkeypatch):
    from api import db

    deletados: list[tuple] = []
    monkeypatch.setattr(db, "obter", lambda _t, id_: {"id": id_})
    monkeypatch.setattr(
        db, "deletar", lambda tabela, id_: deletados.append((tabela, id_))
    )
    r = cliente.delete("/benchmark/eventos/abc", headers=_auth(cliente))
    assert r.status_code == 200
    assert r.json() == {"ok": True}
    assert deletados == [("eventos_promocionais", "abc")]


# --------------------------------------------------------------------------- #
# Parser CSV de Tabela de Precos — normalizar_unidades (fix smoke 2026-06-27)
# --------------------------------------------------------------------------- #
def test_normalizar_unidades_mapeia_csv_para_schema_canonico():
    """CSV "valor,area" deve virar registros com preco_total/area_m2 — sem
    isso, kpisDaVersao no frontend devolvia 0 e o sparkline trio ficava
    vazio."""
    import io

    import pandas as pd

    from api import mercado_api

    csv = "unidade,area_m2,valor\n101,50,500000\n102,60,600000\n"
    df = pd.read_csv(io.StringIO(csv))
    unidades = mercado_api.normalizar_unidades(df)
    assert len(unidades) == 2
    assert unidades[0]["preco_total"] == 500000
    assert unidades[0]["area_m2"] == 50
    assert unidades[0]["unidade"] == "101"
    assert unidades[1]["preco_total"] == 600000


def test_normalizar_unidades_reconhece_sinonimos_de_coluna():
    """Aceita area/metragem/preco/r$ etc — substring case-insensitive."""
    import io

    import pandas as pd

    from api import mercado_api

    csv = "Apto,Metragem,Preço (R$)\nA-01,72,820000\n"
    df = pd.read_csv(io.StringIO(csv))
    unidades = mercado_api.normalizar_unidades(df)
    assert len(unidades) == 1
    assert unidades[0]["preco_total"] == 820000
    assert unidades[0]["area_m2"] == 72
    assert unidades[0]["unidade"] == "A-01"


def test_normalizar_unidades_inclui_opcionais_quando_presentes():
    """Andar, vaga, entrada, parcelas_mensais, financiamento entram quando
    a coluna existe — caso contrario ficam de fora (nao viram null
    forcado)."""
    import io

    import pandas as pd

    from api import mercado_api

    csv = (
        "unidade,andar,vaga,area_m2,valor,entrada,parcelas_mensais,financiamento\n"
        "101,5,1,50,500000,50000,3000,400000\n"
    )
    df = pd.read_csv(io.StringIO(csv))
    unidades = mercado_api.normalizar_unidades(df)
    assert unidades[0]["andar"] == "5"
    assert unidades[0]["vaga"] == "1"
    assert unidades[0]["entrada"] == 50000
    assert unidades[0]["parcelas_mensais"] == 3000
    assert unidades[0]["financiamento"] == 400000


def test_normalizar_unidades_devolve_vazio_sem_colunas_obrigatorias():
    """Sem coluna de valor OU area, devolve []. O caller decide se isso
    eh erro ou apenas registro vazio."""
    import io

    import pandas as pd

    from api import mercado_api

    csv = "qualquer,outra\nx,y\n"
    df = pd.read_csv(io.StringIO(csv))
    assert mercado_api.normalizar_unidades(df) == []


def test_normalizar_unidades_pula_linhas_sem_valor_nem_area():
    import io

    import pandas as pd

    from api import mercado_api

    csv = "unidade,area_m2,valor\n101,50,500000\n102,,\n"
    df = pd.read_csv(io.StringIO(csv))
    unidades = mercado_api.normalizar_unidades(df)
    assert len(unidades) == 1
    assert unidades[0]["unidade"] == "101"


# --------------------------------------------------------------------------- #
# PATCH /incorporadoras/{id} (renomear, PR feature/editar-incorporadora-card)
# --------------------------------------------------------------------------- #
def test_patch_incorporadora_body_vazio_retorna_400(cliente):
    r = cliente.patch("/incorporadoras/abc", headers=_auth(cliente), json={})
    assert r.status_code == 400


def test_patch_incorporadora_nome_vazio_retorna_400(cliente):
    """Sem nome efetivo (so espacos), tambem rejeita — evita gravar lixo."""
    r = cliente.patch(
        "/incorporadoras/abc", headers=_auth(cliente), json={"nome": "   "}
    )
    assert r.status_code == 400


def test_patch_incorporadora_404_quando_id_inexistente(cliente, monkeypatch):
    from api import db

    monkeypatch.setattr(db, "obter", lambda _t, _i: None)
    r = cliente.patch(
        "/incorporadoras/zzz", headers=_auth(cliente), json={"nome": "Novo"}
    )
    assert r.status_code == 404


def test_patch_incorporadora_renomeia_quando_existe(cliente, monkeypatch):
    from api import db

    chamadas: list[tuple] = []
    monkeypatch.setattr(
        db, "obter", lambda _t, id_: {"id": id_, "nome": "Antigo"}
    )
    monkeypatch.setattr(
        db,
        "atualizar",
        lambda tabela, id_, campos: chamadas.append((tabela, id_, campos))
        or {"id": id_, **campos},
    )
    r = cliente.patch(
        "/incorporadoras/abc", headers=_auth(cliente), json={"nome": "Novo Nome"}
    )
    assert r.status_code == 200
    assert r.json()["nome"] == "Novo Nome"
    assert chamadas == [("incorporadoras", "abc", {"nome": "Novo Nome"})]


# --------------------------------------------------------------------------- #
# POST /financiamento/calcular-renda (FEATURE_CALCULO_RENDA)
# --------------------------------------------------------------------------- #
def _renda_body(**over):
    base = {
        "parcela_obra_mensal": 1600.0,
        "saldo_financiar": 354400.0,
        "modalidade": "mcmv_faixa3",
        "prazo_meses": 360,
        "percentual_renda": 0.30,
    }
    base.update(over)
    return base


def test_deve_devolver_taxa_e_renda_quando_modalidade_mcmv_faixa1(cliente):
    r = cliente.post(
        "/financiamento/calcular-renda",
        headers=_auth(cliente),
        json=_renda_body(modalidade="mcmv_faixa1"),
    )
    assert r.status_code == 200
    corpo = r.json()
    assert corpo["taxa_anual_usada"] == 4.5
    assert corpo["label_modalidade"] == "MCMV Faixa 1"
    assert corpo["parcela_financiamento"] > 0
    assert corpo["renda_necessaria"] > corpo["total_mensal_comprometido"]
    # Faixa1 não emite alerta TR
    assert all("TR" not in a for a in corpo["alertas"])


def test_deve_devolver_alerta_tr_quando_modalidade_sbpe(cliente):
    r = cliente.post(
        "/financiamento/calcular-renda",
        headers=_auth(cliente),
        json=_renda_body(modalidade="sbpe"),
    )
    assert r.status_code == 200
    corpo = r.json()
    assert corpo["label_modalidade"] == "SBPE"
    assert corpo["taxa_anual_usada"] == 11.19
    # Alerta de TR especifico do SBPE entra no meio da lista
    assert any("TR" in a for a in corpo["alertas"])


def test_deve_aceitar_taxa_personalizada_quando_modalidade_personalizada(cliente):
    r = cliente.post(
        "/financiamento/calcular-renda",
        headers=_auth(cliente),
        json=_renda_body(modalidade="personalizada", taxa_personalizada_anual=9.5),
    )
    assert r.status_code == 200
    corpo = r.json()
    assert corpo["taxa_anual_usada"] == 9.5
    assert corpo["label_modalidade"] == "Personalizada"


def test_deve_retornar_400_quando_personalizada_sem_taxa(cliente):
    r = cliente.post(
        "/financiamento/calcular-renda",
        headers=_auth(cliente),
        json=_renda_body(modalidade="personalizada"),
    )
    assert r.status_code == 400
    assert "taxa_personalizada_anual" in r.json()["detail"]


def test_deve_retornar_422_quando_prazo_fora_do_intervalo(cliente):
    r = cliente.post(
        "/financiamento/calcular-renda",
        headers=_auth(cliente),
        json=_renda_body(prazo_meses=5),  # < 12, viola Field(ge=12)
    )
    assert r.status_code == 422  # Pydantic validation


def test_deve_calcular_parcela_price_pelo_servico_isolado():
    """Cobertura direta do helper — independente do endpoint."""
    from api import financiamento

    # PV=100000, taxa=12% a.a. -> i_mensal ~= 0.9489%, n=12 meses
    # PMT esperado proximo a R$ 8.880 (Tabela Price 12% a.a. 12 meses)
    i_mensal = financiamento._taxa_anual_para_mensal(12.0)
    parcela = financiamento._parcela_price(100_000.0, i_mensal, 12)
    assert 8800 < parcela < 8900


# --------------------------------------------------------------------------- #
# POST /fluxo/simular (FEATURE_SIMULADOR_FLUXO)
# --------------------------------------------------------------------------- #
def _fluxo_zerado() -> dict:
    """Helper: dict de fluxo com todas as colunas zeradas."""
    return {
        "ato": {"percentual": 0.0, "data": ""},
        "dias30": {"percentual": 0.0, "data": ""},
        "dias60": {"percentual": 0.0, "data": ""},
        "dias90": {"percentual": 0.0, "data": ""},
        "mensais": {"percentual": 0.0, "quantidade": 0, "data_inicio": ""},
        "anuais": {"percentual": 0.0, "quantidade": 0, "data_inicio": ""},
        "semestrais": {"percentual": 0.0, "quantidade": 0, "data_inicio": ""},
        "parcela_unica": {"percentual": 0.0, "data": ""},
        "financiamento": {"percentual": 0.0, "data": ""},
    }


def test_deve_calcular_valor_ato_quando_percentual_informado(cliente):
    fluxo = _fluxo_zerado()
    fluxo["ato"]["percentual"] = 10.0
    fluxo["financiamento"]["percentual"] = 90.0
    r = cliente.post(
        "/fluxo/simular",
        headers=_auth(cliente),
        json={
            "linhas": [
                {"id": "L", "valor_unidade": 352149.63, "fluxo": fluxo},
            ]
        },
    )
    assert r.status_code == 200
    corpo = r.json()
    linha = corpo["linhas"][0]
    # 10% de 352149.63 = 35214.96
    assert abs(linha["colunas"]["ato"]["total"] - 35214.96) < 0.01
    assert linha["colunas"]["ato"]["parcela"] == linha["colunas"]["ato"]["total"]
    assert linha["valida"] is True


def test_deve_calcular_parcela_mensal_quando_quantidade_maior_que_zero(cliente):
    """Mensais: total ÷ quantidade = parcela unitária."""
    fluxo = _fluxo_zerado()
    fluxo["mensais"]["percentual"] = 12.59
    fluxo["mensais"]["quantidade"] = 36
    fluxo["financiamento"]["percentual"] = 87.41
    r = cliente.post(
        "/fluxo/simular",
        headers=_auth(cliente),
        json={
            "linhas": [
                {"id": "L", "valor_unidade": 352149.63, "fluxo": fluxo},
            ]
        },
    )
    assert r.status_code == 200
    linha = r.json()["linhas"][0]
    # 12.59% de 352149.63 = 44335.64; / 36 = 1231.55
    assert abs(linha["colunas"]["mensais"]["total"] - 44335.64) < 0.5
    assert abs(linha["colunas"]["mensais"]["parcela"] - 1231.55) < 0.5


def test_deve_retornar_erro_quando_soma_percentuais_diferente_de_100(cliente):
    fluxo = _fluxo_zerado()
    fluxo["ato"]["percentual"] = 10.0
    fluxo["financiamento"]["percentual"] = 50.0  # soma = 60, nao 100
    r = cliente.post(
        "/fluxo/simular",
        headers=_auth(cliente),
        json={
            "linhas": [
                {"id": "L", "valor_unidade": 300000.0, "fluxo": fluxo},
            ]
        },
    )
    assert r.status_code == 400
    assert "soma" in r.json()["detail"].lower()


def test_deve_calcular_diferenca_quando_duas_linhas_informadas(cliente):
    fluxo_a = _fluxo_zerado()
    fluxo_a["ato"]["percentual"] = 10.0
    fluxo_a["financiamento"]["percentual"] = 90.0

    fluxo_b = _fluxo_zerado()
    fluxo_b["ato"]["percentual"] = 20.0
    fluxo_b["financiamento"]["percentual"] = 80.0

    r = cliente.post(
        "/fluxo/simular",
        headers=_auth(cliente),
        json={
            "linhas": [
                {"id": "A", "valor_unidade": 100000.0, "fluxo": fluxo_a},
                {"id": "B", "valor_unidade": 100000.0, "fluxo": fluxo_b},
            ]
        },
    )
    assert r.status_code == 200
    corpo = r.json()
    assert corpo["diferencas"] is not None
    # ato: A (10000) - B (20000) = -10000
    assert corpo["diferencas"]["ato"] == -10000.0
    # financiamento: A (90000) - B (80000) = 10000
    assert corpo["diferencas"]["financiamento"] == 10000.0


def test_deve_retornar_financiamento_como_residual_automaticamente(cliente):
    """O backend nao deriva o financiamento (cliente envia), mas o
    cenario tipico tem financiamento = 100 - soma(demais). Verifica que
    o calculo respeita esse valor enviado e bate certinho."""
    fluxo = _fluxo_zerado()
    fluxo["ato"]["percentual"] = 10.0
    fluxo["mensais"]["percentual"] = 20.0
    fluxo["mensais"]["quantidade"] = 24
    fluxo["financiamento"]["percentual"] = 70.0  # 100 - (10 + 20)
    r = cliente.post(
        "/fluxo/simular",
        headers=_auth(cliente),
        json={
            "linhas": [
                {"id": "L", "valor_unidade": 500000.0, "fluxo": fluxo},
            ]
        },
    )
    assert r.status_code == 200
    linha = r.json()["linhas"][0]
    assert linha["colunas"]["financiamento"]["total"] == 350000.0  # 70% de 500k
    assert linha["soma_percentuais"] == 100.0


def test_deve_recusar_quando_quantidade_zero_com_percentual_em_mensais(cliente):
    """Validacao defensiva — mensais com 30% mas 0 parcelas seria
    divisao por zero implicita; backend rejeita."""
    fluxo = _fluxo_zerado()
    fluxo["mensais"]["percentual"] = 30.0
    fluxo["mensais"]["quantidade"] = 0
    fluxo["financiamento"]["percentual"] = 70.0
    r = cliente.post(
        "/fluxo/simular",
        headers=_auth(cliente),
        json={
            "linhas": [
                {"id": "L", "valor_unidade": 300000.0, "fluxo": fluxo},
            ]
        },
    )
    assert r.status_code == 400
    assert "quantidade" in r.json()["detail"].lower()
