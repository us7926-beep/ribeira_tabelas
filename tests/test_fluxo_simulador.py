"""POST /fluxo/simular — Simulador de Fluxo Comercial (PR #69)."""


from tests.conftest import auth_headers, cliente  # noqa: F401

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
        headers=auth_headers(cliente),
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
        headers=auth_headers(cliente),
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
        headers=auth_headers(cliente),
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
        headers=auth_headers(cliente),
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
        headers=auth_headers(cliente),
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
        headers=auth_headers(cliente),
        json={
            "linhas": [
                {"id": "L", "valor_unidade": 300000.0, "fluxo": fluxo},
            ]
        },
    )
    assert r.status_code == 400
    assert "quantidade" in r.json()["detail"].lower()
