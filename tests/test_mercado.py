"""Endpoint /mercado/comparativo + /incc/reajustar (CSV via mercado_api)."""


from tests.conftest import cliente, get_token  # noqa: F401

def test_mercado_comparativo_calcula_kpis_de_csv(cliente):
    jwt = get_token(cliente)
    csv = b"unidade,valor,area\n101,500000,50\n102,600000,60\n"
    resposta = cliente.post(
        "/mercado/comparativo",
        headers={"Authorization": f"Bearer {jwt}"},
        files={"arquivo": ("tabela.csv", csv, "text/csv")},
        data={"tipo": "Concorrente", "incorporadora": "Concorrente X"},
    )
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["linhas"] == 2
    assert corpo["kpis"]["preco_m2_medio"] == 10000  # 500000/50 e 600000/60
    assert corpo["colunas_detectadas"]["valor"] == "valor"


def test_incc_reajustar_aplica_percentual_via_csv(cliente):
    jwt = get_token(cliente)
    csv = b"unidade,valor\n101,100000\n102,200000\n"
    resposta = cliente.post(
        "/incc/reajustar",
        headers={"Authorization": f"Bearer {jwt}"},
        files={"arquivo": ("tabela.csv", csv, "text/csv")},
        data={"variacao_pct": "10", "extra_pct": "0", "extra_valor": "0"},
    )
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["coluna_valor"] == "valor"
    assert corpo["registros"][0]["valor_reajustado"] == 110000.0  # 100000 * 1.10
    assert corpo["registros"][1]["valor_reajustado"] == 220000.0
