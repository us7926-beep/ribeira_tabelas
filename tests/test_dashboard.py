import pandas as pd

from src.dashboard import calcular_kpis, classificar_status, comparar_tabelas_kpis


def test_classificar_status_variacoes():
    assert classificar_status("Disponível") == "disponivel"
    assert classificar_status("DISPONIVEL") == "disponivel"
    assert classificar_status("Vendido") == "vendido"
    assert classificar_status("vendida") == "vendido"
    assert classificar_status("Reservado") == "reservado"
    assert classificar_status("R") == "reservado"
    assert classificar_status("xpto") == "outro"


def test_calcular_kpis():
    df = pd.DataFrame(
        {
            "unidade": [101, 102, 103, 104],
            "valor": [100000, 200000, 300000, 400000],
            "situacao": ["Disponível", "Vendido", "Reservado", "Vendido"],
        }
    )
    k = calcular_kpis(df, "unidade", "valor", "situacao")
    assert k["total_unidades"] == 4
    assert k["disponiveis"] == 1
    assert k["vendidas"] == 2
    assert k["reservadas"] == 1
    assert k["vgv_total"] == 1000000
    assert k["vgv_disponivel"] == 100000
    assert k["pct_vendidas"] == 50.0
    assert k["ticket_medio"] == 250000


def test_comparar_tabelas_kpis():
    ant = pd.DataFrame(
        {
            "unidade": [101, 102, 103],
            "valor": [100000, 200000, 300000],
            "situacao": ["Disponível", "Disponível", "Vendido"],
        }
    )
    novo = pd.DataFrame(
        {
            "unidade": [101, 102, 104],
            "valor": [110000, 200000, 400000],
            "situacao": ["Vendido", "Disponível", "Disponível"],
        }
    )
    c = comparar_tabelas_kpis(ant, novo, "unidade", "valor", "situacao")
    # 101: disponível -> vendido = vendida no período
    assert c["qtd_vendidas_no_periodo"] == 1
    assert c["vendidas_no_periodo"] == [101]
    # 104 nova, 103 removida
    assert c["qtd_novas_unidades"] == 1
    assert c["qtd_unidades_removidas"] == 1
    # 101 subiu de 100000 -> 110000 (10%); 102 ficou igual (0%) => média 5%
    assert c["aumento_medio_pct"] == 5.0
    assert c["aumento_total_rs"] == 10000.0


def test_comparar_detecta_retorno_disponibilidade():
    ant = pd.DataFrame({"unidade": [1], "valor": [100], "situacao": ["Vendido"]})
    novo = pd.DataFrame({"unidade": [1], "valor": [100], "situacao": ["Disponível"]})
    c = comparar_tabelas_kpis(ant, novo, "unidade", "valor", "situacao")
    assert c["qtd_retornaram_disponiveis"] == 1
    assert c["retornaram_disponiveis"] == [1]
