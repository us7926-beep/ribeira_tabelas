"""Testes do módulo de inteligência de mercado."""
import pandas as pd

from src.mercado import (
    COLUNAS_BASE,
    adicionar_a_base,
    base_vazia,
    comparar_por_dimensao,
    gerar_insights,
    kpis_gerais,
    normalizar_upload,
    posicionamento_por_padrao,
)


def _df_bruto():
    return pd.DataFrame({"Unid": [101, 102], "Preco": [500000, 600000], "Area": [50, 60]})


def _normalizar(df, **kw):
    base_tags = dict(
        col_valor="Preco",
        col_area="Area",
        col_unidade="Unid",
        tipo="Nosso",
        incorporadora="Ribeira",
        produto="Edifício A",
        cidade="Curitiba",
        bairro="Batel",
        padrao="Alto",
    )
    base_tags.update(kw)
    return normalizar_upload(df, **base_tags)


# --- normalização ----------------------------------------------------------- #
def test_deve_calcular_preco_m2_quando_normaliza_upload():
    out = _normalizar(_df_bruto())
    assert list(out.columns) == COLUNAS_BASE
    assert out.loc[0, "preco_m2"] == 10000  # 500000 / 50
    assert out.loc[1, "preco_m2"] == 10000  # 600000 / 60
    assert out.loc[0, "incorporadora"] == "Ribeira"


def test_deve_gerar_unidade_sequencial_quando_sem_coluna_unidade():
    out = _normalizar(_df_bruto(), col_unidade=None)
    assert out["unidade"].tolist() == ["1", "2"]


def test_deve_descartar_linhas_sem_valor_quando_normaliza():
    df = pd.DataFrame({"Preco": [500000, None], "Area": [50, 60]})
    out = _normalizar(df, col_unidade=None)
    assert len(out) == 1


def test_deve_interpretar_numeros_brasileiros_quando_normaliza():
    # '472.436' (milhar), '47,44' (decimal) e '4 72.436' (ruído de PDF)
    df = pd.DataFrame({"Preco": ["472.436", "4 72.436"], "Area": ["47,44", "47,44"]})
    out = _normalizar(df, col_unidade=None)
    assert out["valor"].tolist() == [472436.0, 472436.0]
    assert round(out["area"].iloc[0], 2) == 47.44


def test_deve_descartar_tudo_quando_coluna_valor_e_texto():
    # mapear uma coluna de texto como valor -> 0 linhas (caso do bug reportado)
    df = pd.DataFrame({"Titulo": ["TABELA SFH", "TORRE"], "Area": ["50", "60"]})
    out = normalizar_upload(
        df, col_valor="Titulo", col_area="Area", col_unidade=None,
        tipo="Nosso", incorporadora="R", produto="P", cidade="C", bairro="B", padrao="Alto",
    )
    assert out.empty


# --- acúmulo na base -------------------------------------------------------- #
def test_deve_acumular_uploads_quando_adiciona_a_base():
    base = base_vazia()
    base = adicionar_a_base(base, _normalizar(_df_bruto()))
    base = adicionar_a_base(base, _normalizar(_df_bruto(), tipo="Concorrente", incorporadora="X"))
    assert len(base) == 4
    assert set(base["tipo"]) == {"Nosso", "Concorrente"}


# --- KPIs ------------------------------------------------------------------- #
def test_deve_separar_preco_m2_nosso_e_concorrente_quando_calcula_kpis():
    base = adicionar_a_base(base_vazia(), _normalizar(_df_bruto()))  # nosso, 10000/m²
    conc = pd.DataFrame({"Preco": [800000], "Area": [40]})  # 20000/m²
    base = adicionar_a_base(base, _normalizar(conc, col_unidade=None, tipo="Concorrente", incorporadora="X"))

    kpis = kpis_gerais(base)
    assert kpis["preco_m2_nosso"] == 10000
    assert kpis["preco_m2_concorrentes"] == 20000
    assert kpis["incorporadoras"] == 2


# --- comparação por dimensão ------------------------------------------------ #
def test_deve_ordenar_por_preco_m2_desc_quando_compara_por_dimensao():
    base = adicionar_a_base(base_vazia(), _normalizar(_df_bruto(), incorporadora="Barata"))  # 10000
    cara = pd.DataFrame({"Preco": [1000000], "Area": [40]})  # 25000/m²
    base = adicionar_a_base(base, _normalizar(cara, col_unidade=None, incorporadora="Cara"))

    agregado = comparar_por_dimensao(base, "incorporadora")
    assert agregado.iloc[0]["incorporadora"] == "Cara"
    assert agregado.iloc[0]["preco_m2_medio"] == 25000


# --- posicionamento --------------------------------------------------------- #
def test_deve_calcular_diferenca_percentual_quando_posiciona_por_padrao():
    base = adicionar_a_base(base_vazia(), _normalizar(_df_bruto()))  # nosso Alto 10000
    conc = pd.DataFrame({"Preco": [400000], "Area": [50]})  # 8000/m²
    base = adicionar_a_base(
        base, _normalizar(conc, col_unidade=None, tipo="Concorrente", incorporadora="X")
    )

    pos = posicionamento_por_padrao(base)
    linha_alto = pos[pos["padrao"] == "Alto"].iloc[0]
    assert linha_alto["preco_m2_nosso"] == 10000
    assert linha_alto["preco_m2_concorrentes"] == 8000
    assert linha_alto["dif_pct"] == 25.0  # 10000 é 25% acima de 8000


# --- insights --------------------------------------------------------------- #
def test_deve_retornar_lista_vazia_quando_base_vazia():
    assert gerar_insights(base_vazia()) == []


def test_deve_gerar_insight_de_posicionamento_quando_ha_nosso_e_concorrente():
    base = adicionar_a_base(base_vazia(), _normalizar(_df_bruto()))  # nosso 10000
    conc = pd.DataFrame({"Preco": [400000], "Area": [50]})  # 8000
    base = adicionar_a_base(
        base, _normalizar(conc, col_unidade=None, tipo="Concorrente", incorporadora="X")
    )
    insights = gerar_insights(base)
    assert any("acima" in frase for frase in insights)
