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
# Parser CSV no formato do CV CRM (fix smoke 2026-07-03): separador ';',
# BOM UTF-8, header multilinha entre aspas, valores "R$ 1.234,56" / "40,9 m²"
# e coluna FINANCIAMENTO numérica que não pode virar modalidade.
# --------------------------------------------------------------------------- #
_CSV_CVCRM = (
    'UNIDADE;"ÁREA PRIVATIVA";SITUAÇÃO;"VALOR TOTAL";"ATO (1x) 5,00% \n'
    '01/07/2026";"FINANCIAMENTO (1x) 80,00% \n'
    '30/09/2026";"PARCELAS MENSAIS (36x) 9,95% \n'
    '10/09/2026"\n'
    'T1-011;"40,900 m²";Vendida;"R$ 357.934,53";"R$ 17.896,73";"R$ 286.347,62";"R$ 989,29"\n'
    'T1-016;"42,190 m²";Disponível;"R$ 357.934,53";"R$ 17.896,73";"R$ 286.347,62";"R$ 989,29"\n'
    'T2-014;"42,240 m²";Bloqueada;"R$ 357.934,53";"R$ 17.896,73";"R$ 286.347,62";"R$ 989,29"\n'
)
_CSV_CVCRM_BYTES = b"\xef\xbb\xbf" + _CSV_CVCRM.encode("utf-8")


def test_ler_planilha_detecta_separador_ponto_e_virgula_e_bom():
    from api import mercado_api

    df = mercado_api.ler_planilha(_CSV_CVCRM_BYTES, "total braz cubas- 07-26.csv")
    assert df.shape == (3, 7)
    assert list(df.columns)[0] == "UNIDADE"  # BOM não vaza pro nome da coluna


def test_ler_planilha_csv_latin1_nao_explode():
    from api import mercado_api

    csv = "unidade;área;preço\n101;50;1.000,50\n".encode("latin-1")
    df = mercado_api.ler_planilha(csv, "tabela.csv")
    assert df.shape == (1, 3)
    assert "área" in df.columns


def test_para_numero_formatos_brasileiros():
    from src import mercado

    assert mercado.para_numero("R$ 357.934,53") == 357934.53
    assert mercado.para_numero("40,900 m²") == 40.9
    assert mercado.para_numero("472.436") == 472436
    assert mercado.para_numero("47.44") == 47.44
    assert mercado.para_numero(1500) == 1500.0
    assert mercado.para_numero("—") is None
    assert mercado.para_numero("") is None
    assert mercado.para_numero(None) is None


def test_normalizar_unidades_formato_cvcrm_popula_schema_canonico():
    from api import mercado_api

    df = mercado_api.ler_planilha(_CSV_CVCRM_BYTES, "tabela.csv")
    unidades = mercado_api.normalizar_unidades(df)
    assert len(unidades) == 3
    u = unidades[0]
    assert u["unidade"] == "T1-011"
    assert u["preco_total"] == 357934.53
    assert u["area_m2"] == 40.9
    assert u["situacao"] == "Vendida"
    assert u["entrada"] == 17896.73
    assert u["financiamento"] == 286347.62
    assert u["parcelas_mensais"] == 989.29


def test_vendas_kpis_cvcrm_nao_confunde_financiamento_com_modalidade(cliente):
    """A coluna "FINANCIAMENTO (1x) 80%" traz valores R$ — não é rótulo de
    modalidade. A guarda derruba a detecção explícita e a composição do
    pagamento (entrada 5% < 25% do total) infere Financiamento."""
    corpo = _post_vendas(cliente, _CSV_CVCRM_BYTES)
    assert corpo["colunas"]["modalidade"] is None
    assert corpo["colunas"]["modalidade_origem"] == "inferida"
    kpis = corpo["kpis"]
    assert kpis["total_unidades"] == 3
    assert kpis["vendidas"] == 1
    assert kpis["disponiveis"] == 1
    assert kpis["vgv_total"] == pytest.approx(3 * 357934.53)
    assert corpo["distribuicao"] == [
        {"modalidade": "Financiamento", "unidades_vendidas": 1, "vgv": 357934.53}
    ]


def test_comparativo_formato_cvcrm_calcula_kpis(cliente):
    corpo_resposta = cliente.post(
        "/mercado/comparativo",
        headers=_auth(cliente),
        files={"arquivo": ("total braz cubas- 07-26.csv", _CSV_CVCRM_BYTES, "text/csv")},
        data={
            "tipo": "Nosso", "incorporadora": "Ribeira", "produto": "TOTAL",
            "cidade": "Mogi das Cruzes", "bairro": "Braz Cubas", "padrao": "Econômico",
        },
    )
    assert corpo_resposta.status_code == 200, corpo_resposta.text
    corpo = corpo_resposta.json()
    assert corpo["linhas"] == 3
    assert corpo["kpis"]["ticket_medio"] == pytest.approx(357934.53)
    assert corpo["colunas_detectadas"]["valor"] == "VALOR TOTAL"


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


# --------------------------------------------------------------------------- #
# Diagnóstico competitivo (Gemini) — POST/GET /empreendimentos/{id}/diagnostico
# --------------------------------------------------------------------------- #
def test_diagnostico_404_quando_empreendimento_inexistente(cliente, monkeypatch):
    from api import db

    monkeypatch.setattr(db, "obter", lambda _t, _i: None)
    r = cliente.post("/empreendimentos/zzz/diagnostico", headers=_auth(cliente))
    assert r.status_code == 404


def test_diagnostico_400_quando_sem_kpis(cliente, monkeypatch):
    """Sem KPIs (preço/m², ticket, VSO, VGV) a IA não tem o que analisar."""
    from api import db

    monkeypatch.setattr(db, "obter", lambda _t, _i: {"id": "abc", "nome": "X", "cidade": "SP", "padrao": "Alto"})
    monkeypatch.setattr(db, "listar", lambda _t: [])
    r = cliente.post("/empreendimentos/abc/diagnostico", headers=_auth(cliente))
    assert r.status_code == 400
    assert "kpi" in r.json()["detail"].lower()


def test_diagnostico_fluxo_feliz_salva_e_retorna(cliente, monkeypatch):
    """Concorrentes filtrados por cidade+padrão; ficha + KPIs + concorrentes
    chegam ao mock do Gemini; parecer é persistido em pareceres_empreendimento."""
    from api import db, gemini

    empreendimento = {
        "id": "meu", "nome": "Alegria", "cidade": "Mogi das Cruzes",
        "padrao": "Alto", "bairro": "Vila Mogilar",
        "preco_m2_medio": 9276, "ticket_medio": 545000, "vso": 100,
        "vgv_total": 3270000, "unidades_vendidas": 11, "total_unidades_calc": 6,
    }
    concorrente_similar = {
        "id": "c1", "nome": "Passeo", "cidade": "Mogi das Cruzes", "padrao": "Alto",
        "bairro": "Centro", "preco_m2_medio": 8500, "vgv_total": 5000000,
    }
    fora_da_cidade = {"id": "c2", "nome": "X", "cidade": "SP", "padrao": "Alto"}
    fora_do_padrao = {"id": "c3", "nome": "Y", "cidade": "Mogi das Cruzes", "padrao": "Medio"}

    monkeypatch.setattr(db, "obter", lambda _t, id_: empreendimento if id_ == "meu" else None)
    monkeypatch.setattr(
        db, "listar",
        lambda _t: [empreendimento, concorrente_similar, fora_da_cidade, fora_do_padrao],
    )

    capturado: dict = {}

    def fake_gemini(ficha, kpis, concorrentes):
        capturado["ficha"] = ficha
        capturado["kpis"] = kpis
        capturado["concorrentes"] = concorrentes
        return {
            "bullets": [
                {"texto": "Preço/m² 9% acima da média Alto de Mogi",
                 "tag": "risco", "kpi_referencia": "preco_m2"},
                {"texto": "VSO em 100% - estoque enxuto",
                 "tag": "forca", "kpi_referencia": "vso"},
            ],
            "resumo_executivo": "Posição premium com estoque esgotado.",
        }

    monkeypatch.setattr(gemini, "gerar_diagnostico_competitivo", fake_gemini)

    def fake_inserir(_tabela, registro):
        return {"id": "novo-parecer", "criado_em": "2026-08-15T12:00:00Z", **registro}

    monkeypatch.setattr(db, "inserir", fake_inserir)

    r = cliente.post("/empreendimentos/meu/diagnostico", headers=_auth(cliente))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["id"] == "novo-parecer"
    assert body["empreendimento_id"] == "meu"
    assert body["resumo_executivo"].startswith("Posição premium")
    assert len(body["bullets"]) == 2

    # Concorrentes filtrados: só o que bate cidade+padrão, exclui o próprio
    assert len(capturado["concorrentes"]) == 1
    assert capturado["concorrentes"][0]["nome"] == "Passeo"
    # Ficha só com campos preenchidos
    assert capturado["ficha"]["nome"] == "Alegria"
    assert "tipologias" not in capturado["ficha"]
    # KPIs coletados
    assert capturado["kpis"]["preco_m2_medio"] == 9276
    assert capturado["kpis"]["vso"] == 100


def test_diagnostico_get_vazio_retorna_atual_null(cliente, monkeypatch):
    from api import db

    monkeypatch.setattr(db, "listar_ordenado", lambda *a, **kw: [])
    r = cliente.get("/empreendimentos/abc/diagnostico", headers=_auth(cliente))
    assert r.status_code == 200
    assert r.json() == {"atual": None, "historico": []}


def test_diagnostico_get_com_historico(cliente, monkeypatch):
    from api import db

    pareceres = [
        {"id": "p3", "criado_em": "2026-08-15", "resumo_executivo": "atual"},
        {"id": "p2", "criado_em": "2026-08-01", "resumo_executivo": "antigo1"},
        {"id": "p1", "criado_em": "2026-07-01", "resumo_executivo": "antigo2"},
    ]
    monkeypatch.setattr(db, "listar_ordenado", lambda *a, **kw: pareceres)
    r = cliente.get("/empreendimentos/abc/diagnostico", headers=_auth(cliente))
    assert r.status_code == 200
    body = r.json()
    assert body["atual"]["id"] == "p3"
    assert [p["id"] for p in body["historico"]] == ["p2", "p1"]


# --------------------------------------------------------------------------- #
# GET /health/heartbeat — cron heartbeat pro Supabase (PR heartbeat)
# --------------------------------------------------------------------------- #
def test_heartbeat_ok_quando_supabase_responde(cliente, monkeypatch):
    """Bate SELECT count e devolve ok=true + contagem."""
    from api import db

    class FakeResp:
        count = 3

    class FakeQuery:
        def select(self, *_a, **_k): return self
        def limit(self, _n): return self
        def execute(self): return FakeResp()

    class FakeClient:
        def table(self, _t): return FakeQuery()

    monkeypatch.setattr(db, "cliente", lambda: FakeClient())
    r = cliente.get("/health/heartbeat")
    assert r.status_code == 200
    d = r.json()
    assert d["ok"] is True
    assert d["supabase"] is True
    assert d["incorporadoras"] == 3
    assert isinstance(d["tempo_ms"], int)


def test_heartbeat_devolve_erro_estruturado_quando_supabase_falha(cliente, monkeypatch):
    """Se supabase quebra, devolve 200 com ok=false + erro (não crasha o cron)."""
    from api import db

    def falha():
        raise RuntimeError("Supabase paused")

    monkeypatch.setattr(db, "cliente", falha)
    r = cliente.get("/health/heartbeat")
    assert r.status_code == 200
    d = r.json()
    assert d["ok"] is False
    assert d["supabase"] is False
    assert "Supabase paused" in d["erro"]


def test_heartbeat_e_publico_sem_auth(cliente):
    """Cron precisa chamar sem JWT — Vercel Cron não manda Authorization."""
    r = cliente.get("/health/heartbeat")
    # Sem auth funciona (200 mesmo com erro do supabase, pra não crashar cron).
    assert r.status_code == 200


# --------------------------------------------------------------------------- #
# GET /geocode — Nominatim + cache (PR feature/mapa-geografico)
# --------------------------------------------------------------------------- #
def test_geocode_devolve_lat_lng(cliente, monkeypatch):
    """Fluxo feliz: geocode.geocode retorna resultado, endpoint devolve JSON."""
    from api import geocode

    geocode.limpar_cache()
    monkeypatch.setattr(
        geocode, "geocode",
        lambda b, c: {"lat": -23.52, "lng": -46.19, "formatado": "Vila Mogilar, Mogi das Cruzes"},
    )
    r = cliente.get("/geocode?bairro=Vila+Mogilar&cidade=Mogi+das+Cruzes", headers=_auth(cliente))
    assert r.status_code == 200
    d = r.json()
    assert d["lat"] == -23.52
    assert d["lng"] == -46.19
    assert "Vila Mogilar" in d["formatado"]


def test_geocode_400_sem_cidade(cliente):
    r = cliente.get("/geocode?bairro=Centro", headers=_auth(cliente))
    assert r.status_code == 400


def test_geocode_404_quando_nominatim_nao_acha(cliente, monkeypatch):
    from api import geocode

    geocode.limpar_cache()
    monkeypatch.setattr(geocode, "geocode", lambda _b, _c: None)
    r = cliente.get("/geocode?cidade=CidadeInexistente", headers=_auth(cliente))
    assert r.status_code == 404


def test_geocode_502_quando_nominatim_explode(cliente, monkeypatch):
    from api import geocode

    def _falha(_b, _c):
        raise RuntimeError("timeout")

    geocode.limpar_cache()
    monkeypatch.setattr(geocode, "geocode", _falha)
    r = cliente.get("/geocode?cidade=Mogi", headers=_auth(cliente))
    assert r.status_code == 502


def test_geocode_usa_cache(monkeypatch):
    """Segunda chamada com mesma chave não bate no Nominatim."""
    from api import geocode

    geocode.limpar_cache()
    chamadas = []

    def fake_consultar(q):
        chamadas.append(q)
        return {"lat": 1.0, "lng": 2.0, "formatado": q}

    monkeypatch.setattr(geocode, "_consultar_nominatim", fake_consultar)
    r1 = geocode.geocode("Centro", "Mogi")
    r2 = geocode.geocode("Centro", "Mogi")
    assert r1 == r2
    assert len(chamadas) == 1, f"esperado 1 chamada Nominatim, recebi {len(chamadas)}: {chamadas}"


def test_geocode_fallback_para_cidade(monkeypatch):
    """Quando bairro+cidade não bate, tenta só cidade."""
    from api import geocode

    geocode.limpar_cache()

    def fake_consultar(q):
        if "InexistenteBairro" in q:
            return None
        return {"lat": -23.5, "lng": -46.2, "formatado": q}

    monkeypatch.setattr(geocode, "_consultar_nominatim", fake_consultar)
    r = geocode.geocode("InexistenteBairro", "Mogi das Cruzes")
    assert r is not None
    assert "Mogi das Cruzes" in r["formatado"]


# --------------------------------------------------------------------------- #
# pdf_tabelas — extração híbrida com pdfplumber (PR feature/pdfplumber-hibrido)
# --------------------------------------------------------------------------- #
def test_pdf_tabelas_num_br_lida_com_reais_brasileiros():
    from api.pdf_tabelas import _num_br

    assert _num_br("R$ 357.934,53") == 357934.53
    assert _num_br("40,900 m²") == 40.9
    assert _num_br("R$\n1.234,56") == 1234.56  # com quebra de linha do pdfplumber
    assert _num_br("1000") == 1000.0
    assert _num_br("47.44") == 47.44  # US style
    assert _num_br(None) is None
    assert _num_br("—") is None
    assert _num_br("") is None


def test_pdf_tabelas_colunas_por_palavra_chave():
    from api.pdf_tabelas import _colunas_por_palavra_chave

    # Formato CV CRM: UNIDADE / ÁREA / SITUAÇÃO / VALOR / ATO / SINAIS... / FINANCIAMENTO
    header = ["UNIDADE", "ÁREA PRIVATIVA", "SITUAÇÃO", "VALOR TOTAL",
              "ATO (1x)", "SINAL 30d", "FINANCIAMENTO"]
    mapa = _colunas_por_palavra_chave(header)
    assert mapa["unidade"] == 0
    assert mapa["area_m2"] == 1
    assert mapa["preco_total"] == 3
    assert mapa["entrada"] == 4
    assert mapa["financiamento"] == 6


def test_pdf_tabelas_tem_header_valido():
    from api.pdf_tabelas import _tem_header_valido

    assert _tem_header_valido(["UNIDADE", "ÁREA", "VALOR"])
    assert _tem_header_valido(["Apto", "Metragem", "Preço"])
    # Metadata (não é header): nome da tabela, logo
    assert not _tem_header_valido(["MÁXIMO BRAZ CUBAS", None, None, "Tabela: 07.2026"])
    # Linha de dados (não é header)
    assert not _tem_header_valido(["18-A", "33,03 m²", "Disponível"])
    assert not _tem_header_valido([])


def test_mesclar_com_gemini_substitui_so_area_e_preco():
    """Merge não sobrescreve entrada/parcelas/financiamento porque
    semântica desses campos depende de contexto (Gemini decide)."""
    from api.pdf_tabelas import mesclar_com_gemini

    gemini_out = [
        {
            "unidade": "5-A",
            "area_m2": 45.0,  # arredondamento do Gemini
            "preco_total": 396800,  # também arredondado
            "entrada": 23810.24,  # soma de ATO + SINAIS (interpretação do Gemini)
            "parcelas_mensais": 1825.45,
            "financiamento": 297429.4,
        },
    ]
    pdf_out = [
        {
            "unidade": "5-A",
            "area_m2": 45.05,  # valor exato do PDF
            "preco_total": 396837.10,  # valor exato do PDF
            "entrada": 5952.56,  # só o ATO (semântica errada)
            "parcelas_mensais": 1825.45,
            "financiamento": 297429.4,
        },
    ]
    mesclado = mesclar_com_gemini(gemini_out, pdf_out)
    assert len(mesclado) == 1
    u = mesclado[0]
    # area e preço vêm do PDF (mais precisos)
    assert u["area_m2"] == 45.05
    assert u["preco_total"] == 396837.10
    # entrada mantém interpretação do Gemini
    assert u["entrada"] == 23810.24


def test_mesclar_com_gemini_vazio_devolve_gemini():
    from api.pdf_tabelas import mesclar_com_gemini

    gem = [{"unidade": "1", "preco_total": 100}]
    assert mesclar_com_gemini(gem, []) == gem
    assert mesclar_com_gemini([], [{"unidade": "1"}]) == []


def test_mesclar_com_gemini_ignora_unidades_pdf_orfas():
    """Unidade que só aparece no pdfplumber (não no Gemini) fica de
    fora — protege contra pdfplumber pegar tabela irrelevante."""
    from api.pdf_tabelas import mesclar_com_gemini

    gem = [{"unidade": "1", "preco_total": 100}]
    pdf = [{"unidade": "1", "preco_total": 200}, {"unidade": "999", "preco_total": 999}]
    mesclado = mesclar_com_gemini(gem, pdf)
    assert len(mesclado) == 1  # não veio a "999"
    assert mesclado[0]["preco_total"] == 200


def test_extrair_tabela_precos_desativa_hibrido():
    """hibrido=False bloqueia pdfplumber (útil pra testes ou imagens)."""
    from unittest.mock import patch
    from api import gemini

    with patch("api.gemini._gerar", return_value={
        "nome_empreendimento": "X",
        "unidades": [{"unidade": "1", "area_m2": 50, "preco_total": 500000}],
    }):
        with patch("api.pdf_tabelas.extrair_tabelas_pdf") as mock_pdf:
            r = gemini.extrair_tabela_precos(b"pdf", "book.pdf", hibrido=False)
    mock_pdf.assert_not_called()
    assert r["unidades"][0]["preco_total"] == 500000


# --------------------------------------------------------------------------- #
# extrair_ficha_dossie — retry seletivo + few-shot (PR feature/gemini-retry-fewshot)
# --------------------------------------------------------------------------- #
def test_ficha_dossie_sem_retry_quando_essenciais_preenchidos(monkeypatch):
    """Se veio >=3 dos 5 essenciais (nome/bairro/cidade/padrao/tipologias),
    NAO refaz — economiza chamada Gemini."""
    from api import gemini

    chamadas = []

    def fake_gerar(_c, _n, prompt):
        chamadas.append(prompt)
        return {
            "nome": "Alegria",
            "bairro": "Vila Mogilar",
            "cidade": "Mogi das Cruzes",
            "padrao": "Alto",
            "tipologias": "2 dorms",
        }

    monkeypatch.setattr(gemini, "_gerar", fake_gerar)
    ficha = gemini.extrair_ficha_dossie(b"pdf", "book.pdf")
    assert ficha["nome"] == "Alegria"
    assert len(chamadas) == 1  # sem retry


def test_ficha_dossie_faz_retry_quando_essenciais_faltam(monkeypatch):
    """Se veio <3 essenciais, refaz com prompt de reforco e mescla — o
    valor da 1a tentativa vence, o reforco so preenche vazios."""
    from api import gemini

    chamadas: list[str] = []

    def fake_gerar(_c, _n, prompt):
        chamadas.append(prompt)
        # 1a tentativa: veio so o nome (1 dos 5 essenciais).
        if len(chamadas) == 1:
            return {"nome": "Torres do Parque", "pavimentos": 10}
        # 2a (reforco): traz bairro, cidade e padrao adicionais.
        return {
            "nome": "OUTRO NOME (ignorado)",  # nao pode sobrescrever
            "bairro": "Centro",
            "cidade": "Mogi",
            "padrao": "Medio",
            "pavimentos": 99,  # tambem ignorado (ja tinha)
        }

    monkeypatch.setattr(gemini, "_gerar", fake_gerar)
    ficha = gemini.extrair_ficha_dossie(b"pdf", "book.pdf")

    assert len(chamadas) == 2, "esperado 1 chamada + 1 retry"
    assert "reforco" in chamadas[1].lower() or "reforc" in chamadas[1].lower() or "faltar" in chamadas[1].lower() or "vazios" in chamadas[1].lower() or "ja tent" in chamadas[1].lower()
    # 1a tentativa vence: nome + pavimentos
    assert ficha["nome"] == "Torres do Parque"
    assert ficha["pavimentos"] == 10
    # Reforco preenche vazios: bairro/cidade/padrao
    assert ficha["bairro"] == "Centro"
    assert ficha["cidade"] == "Mogi"
    assert ficha["padrao"] == "Medio"


def test_ficha_dossie_retry_desligado(monkeypatch):
    """Passar retry_vazios=False bloqueia a 2a chamada."""
    from api import gemini

    chamadas = []

    def fake_gerar(_c, _n, _prompt):
        chamadas.append(1)
        return {"nome": "So o nome"}

    monkeypatch.setattr(gemini, "_gerar", fake_gerar)
    ficha = gemini.extrair_ficha_dossie(b"pdf", "book.pdf", retry_vazios=False)
    assert len(chamadas) == 1
    assert ficha["nome"] == "So o nome"


def test_ficha_dossie_retry_tolera_falha(monkeypatch):
    """Se o retry der RuntimeError, mantem o que veio da 1a tentativa."""
    from api import gemini

    chamadas = []

    def fake_gerar(_c, _n, _prompt):
        chamadas.append(1)
        if len(chamadas) == 1:
            return {"nome": "X"}
        raise RuntimeError("Gemini indisponivel")

    monkeypatch.setattr(gemini, "_gerar", fake_gerar)
    ficha = gemini.extrair_ficha_dossie(b"pdf", "book.pdf")
    assert len(chamadas) == 2  # tentou retry
    assert ficha == {"nome": "X"}  # mas voltou com o parcial


def test_ficha_dossie_prompt_tem_exemplos_few_shot():
    """O prompt principal deve incluir 2 exemplos (few-shot) — book completo + book pobre."""
    from api import gemini

    prompt = gemini._PROMPT_FICHA_DOSSIE
    assert "EXEMPLOS" in prompt.upper() or "exemplo" in prompt.lower()
    assert "Alegria" in prompt  # exemplo 1 do book completo
    assert "Torres do Parque" in prompt  # exemplo 2 do book pobre
    # Deve mostrar o padrao de usar null em vez de inventar
    assert "null" in prompt


# --------------------------------------------------------------------------- #
# POST /books/extrair — dry-run pra fila de análise em lote
# --------------------------------------------------------------------------- #
def test_books_extrair_devolve_ficha_e_tabela(cliente, monkeypatch):
    """Fluxo feliz: Gemini extrai ficha + tabela, endpoint devolve ambos."""
    from api import gemini

    monkeypatch.setattr(gemini, "extrair_ficha_dossie", lambda _b, _n: {"nome": "Alegria", "cidade": "Mogi"})
    monkeypatch.setattr(
        gemini, "extrair_tabela_precos",
        lambda _b, _n: {
            "nome_empreendimento": "Alegria",
            "incorporadora": "Ribeira",
            "unidades": [{"unidade": "101", "area_m2": 50, "preco_total": 500000}],
            "promocoes": [],
            "padrao": "Alto",
            "cidade": "Mogi",
            "bairro": "",
            "total_unidades": 1,
        },
    )
    r = cliente.post(
        "/books/extrair",
        headers=_auth(cliente),
        files={"arquivo": ("book.pdf", b"%PDF-1.4 fake", "application/pdf")},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["arquivo_nome"] == "book.pdf"
    assert body["ficha"]["nome"] == "Alegria"
    assert body["tabela"]["nome_empreendimento"] == "Alegria"
    assert body["tabela"]["unidades"][0]["unidade"] == "101"
    assert body["erros"] == {}


def test_books_extrair_tolera_falha_de_tabela(cliente, monkeypatch):
    """Ficha OK + tabela falha: retorna 200 com ficha + erros.tabela."""
    from api import gemini

    monkeypatch.setattr(gemini, "extrair_ficha_dossie", lambda _b, _n: {"nome": "X"})

    def fake_tabela(_b, _n):
        raise RuntimeError("Gemini timeout")

    monkeypatch.setattr(gemini, "extrair_tabela_precos", fake_tabela)
    r = cliente.post(
        "/books/extrair",
        headers=_auth(cliente),
        files={"arquivo": ("book.pdf", b"%PDF-1.4", "application/pdf")},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["ficha"]["nome"] == "X"
    assert body["erros"]["tabela"] == "Gemini timeout"


def test_books_extrair_502_quando_ambos_falham(cliente, monkeypatch):
    """Ficha E tabela falham: 502."""
    from api import gemini

    def _falha(_b, _n):
        raise RuntimeError("boom")

    monkeypatch.setattr(gemini, "extrair_ficha_dossie", _falha)
    monkeypatch.setattr(gemini, "extrair_tabela_precos", _falha)
    r = cliente.post(
        "/books/extrair",
        headers=_auth(cliente),
        files={"arquivo": ("book.pdf", b"%PDF-1.4", "application/pdf")},
    )
    assert r.status_code == 502
    assert "boom" in r.json()["detail"]


def test_books_extrair_413_quando_arquivo_excede_25mb(cliente, monkeypatch):
    """Guarda de tamanho é comum a todos os uploads — herda de _ler_upload."""
    conteudo = b"x" * (26 * 1024 * 1024)  # 26 MB
    r = cliente.post(
        "/books/extrair",
        headers=_auth(cliente),
        files={"arquivo": ("book.pdf", conteudo, "application/pdf")},
    )
    assert r.status_code == 413


def test_gemini_diagnostico_normaliza_tag_invalida_e_limita_5(monkeypatch):
    """Unit test do gemini.py: garante que tags fora do enum caem em 'neutro'
    e que a lista é truncada em 5 bullets. Mocka via monkeypatch (reversível)."""
    from google import genai

    from api import gemini as gemini_mod

    class _Resp:
        text = json.dumps({
            "resumo_executivo": "ok",
            "bullets": [
                {"texto": "b1", "tag": "forca"},
                {"texto": "b2", "tag": "TAG_ESQUISITA"},
                {"texto": "b3", "tag": "oportunidade", "kpi_referencia": "vso"},
                {"texto": "b4", "tag": "risco"},
                {"texto": "b5", "tag": "fraqueza"},
                {"texto": "b6-excedente", "tag": "neutro"},
                {"texto": "", "tag": "forca"},  # sem texto -> ignorado
            ],
        })

    class _Models:
        def generate_content(self, **_kw):
            return _Resp()

    class _Client:
        def __init__(self, api_key):  # noqa: ARG002
            self.models = _Models()

    monkeypatch.setattr(genai, "Client", _Client)
    monkeypatch.setenv("GEMINI_API_KEY", "fake")

    parecer = gemini_mod.gerar_diagnostico_competitivo(
        {"nome": "X"}, {"vso": 90}, [{"nome": "Concorrente"}]
    )
    assert parecer["resumo_executivo"] == "ok"
    assert len(parecer["bullets"]) == 5  # truncado
    tags = [b["tag"] for b in parecer["bullets"]]
    assert "neutro" in tags
    assert all(b["texto"] for b in parecer["bullets"])
