import pandas as pd

from src.detector import detectar_padrao


def test_detecta_colunas_conhecidas():
    df = pd.DataFrame(
        {
            "Unidade": ["101", "102"],
            "Bloco": ["A", "A"],
            "Valor Total": [100000, 120000],
            "Data Competencia": ["2024-01", "2024-01"],
        }
    )
    resultado = detectar_padrao(df)
    assert resultado["mapeamento"]["unidade"] == "Unidade"
    assert resultado["mapeamento"]["bloco"] == "Bloco"
    assert resultado["mapeamento"]["valor"] == "Valor Total"
    assert resultado["mapeamento"]["data"] == "Data Competencia"
    assert resultado["confianca"] >= 0.5


def test_colunas_sem_padrao_conhecido():
    df = pd.DataFrame({"Coluna X": [1, 2], "Coluna Y": [3, 4]})
    resultado = detectar_padrao(df)
    assert resultado["confianca"] == 0.0
