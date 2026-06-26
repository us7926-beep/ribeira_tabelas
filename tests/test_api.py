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
