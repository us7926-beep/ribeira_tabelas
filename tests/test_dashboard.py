"""Testes dos KPIs e indicadores do dashboard."""
import pandas as pd
import pytest

from src.dashboard import calcular_kpis, classificar_status, comparar_tabelas_kpis


# --- classificação de status ------------------------------------------------ #
@pytest.mark.parametrize(
    "entrada, esperado",
    [
        ("Disponível", "disponivel"),
        ("DISPONIVEL", "disponivel"),
        ("Vendido", "vendido"),
        ("vendida", "vendido"),
        ("Reservado", "reservado"),
        ("R", "reservado"),
    ],
)
def test_deve_classificar_status_quando_variacoes_de_escrita(entrada, esperado):
    assert classificar_status(entrada) == esperado


def test_deve_classificar_como_outro_quando_status_desconhecido():
    assert classificar_status("xpto") == "outro"


# --- KPIs de uma única tabela ----------------------------------------------- #
def test_deve_calcular_kpis_quando_tabela_valida():
    df = pd.DataFrame(
        {
            "unidade": [101, 102, 103, 104],
            "valor": [100000, 200000, 300000, 400000],
            "situacao": ["Disponível", "Vendido", "Reservado", "Vendido"],
        }
    )

    kpis = calcular_kpis(df, "unidade", "valor", "situacao")

    assert kpis["total_unidades"] == 4
    assert kpis["disponiveis"] == 1
    assert kpis["vendidas"] == 2
    assert kpis["reservadas"] == 1
    assert kpis["vgv_total"] == 1_000_000
    assert kpis["vgv_disponivel"] == 100_000
    assert kpis["pct_vendidas"] == 50.0
    assert kpis["ticket_medio"] == 250_000


def test_deve_retornar_zeros_sem_erro_quando_tabela_vazia():
    df = pd.DataFrame({"unidade": [], "valor": [], "situacao": []})

    kpis = calcular_kpis(df, "unidade", "valor", "situacao")

    assert kpis["total_unidades"] == 0
    assert kpis["vgv_total"] == 0.0
    assert kpis["ticket_medio"] == 0.0
    assert kpis["pct_vendidas"] == 0.0  # sem divisão por zero


# --- comparação entre tabelas ----------------------------------------------- #
def test_deve_detectar_vendidas_no_periodo_quando_status_muda_para_vendido():
    ant = pd.DataFrame(
        {"unidade": [101, 102], "valor": [100000, 200000], "situacao": ["Disponível", "Disponível"]}
    )
    novo = pd.DataFrame(
        {"unidade": [101, 102], "valor": [100000, 200000], "situacao": ["Vendido", "Disponível"]}
    )

    comp = comparar_tabelas_kpis(ant, novo, "unidade", "valor", "situacao")

    assert comp["qtd_vendidas_no_periodo"] == 1
    assert comp["vendidas_no_periodo"] == [101]


def test_deve_detectar_retorno_disponibilidade_quando_status_volta_para_disponivel():
    ant = pd.DataFrame({"unidade": [1], "valor": [100], "situacao": ["Vendido"]})
    novo = pd.DataFrame({"unidade": [1], "valor": [100], "situacao": ["Disponível"]})

    comp = comparar_tabelas_kpis(ant, novo, "unidade", "valor", "situacao")

    assert comp["qtd_retornaram_disponiveis"] == 1
    assert comp["retornaram_disponiveis"] == [1]


def test_deve_contar_novas_e_removidas_quando_unidades_diferem():
    ant = pd.DataFrame({"unidade": [101, 103], "valor": [1, 1], "situacao": ["Vendido", "Vendido"]})
    novo = pd.DataFrame({"unidade": [101, 104], "valor": [1, 1], "situacao": ["Vendido", "Vendido"]})

    comp = comparar_tabelas_kpis(ant, novo, "unidade", "valor", "situacao")

    assert comp["qtd_novas_unidades"] == 1
    assert comp["novas_unidades"] == [104]
    assert comp["qtd_unidades_removidas"] == 1
    assert comp["unidades_removidas"] == [103]


def test_deve_calcular_aumento_medio_e_total_quando_precos_mudam():
    ant = pd.DataFrame(
        {"unidade": [101, 102], "valor": [100000, 200000], "situacao": ["Disponível", "Disponível"]}
    )
    novo = pd.DataFrame(
        {"unidade": [101, 102], "valor": [110000, 200000], "situacao": ["Disponível", "Disponível"]}
    )

    comp = comparar_tabelas_kpis(ant, novo, "unidade", "valor", "situacao")

    # 101 sobe 10%, 102 fica igual (0%) => média 5%; diferença total = 10.000
    assert comp["aumento_medio_pct"] == 5.0
    assert comp["aumento_total_rs"] == 10000.0


def test_deve_zerar_evolucao_quando_nao_ha_unidades_em_comum():
    ant = pd.DataFrame({"unidade": [1], "valor": [100], "situacao": ["Vendido"]})
    novo = pd.DataFrame({"unidade": [2], "valor": [200], "situacao": ["Vendido"]})

    comp = comparar_tabelas_kpis(ant, novo, "unidade", "valor", "situacao")

    assert comp["qtd_comuns"] == 0
    assert comp["aumento_medio_pct"] == 0.0
    assert comp["aumento_total_rs"] == 0.0
