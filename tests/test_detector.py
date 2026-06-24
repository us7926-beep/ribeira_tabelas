"""Testes da detecção heurística do padrão de colunas."""
import pandas as pd

from src.detector import detectar_padrao


def test_deve_mapear_papeis_quando_colunas_conhecidas():
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


def test_deve_zerar_confianca_quando_nenhuma_coluna_reconhecida():
    df = pd.DataFrame({"Coluna X": [1, 2], "Coluna Y": [3, 4]})

    resultado = detectar_padrao(df)

    assert resultado["confianca"] == 0.0


def test_deve_listar_colunas_nao_mapeadas_quando_existem_extras():
    df = pd.DataFrame({"Unidade": [1], "Observação": ["x"]})

    resultado = detectar_padrao(df)

    assert "Observação" in resultado["colunas_nao_mapeadas"]
