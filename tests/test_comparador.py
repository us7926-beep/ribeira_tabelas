import pandas as pd

from src.comparador import comparar_versoes


def test_comparar_versoes_detecta_diferencas():
    antiga = pd.DataFrame(
        {"unidade": [101, 102, 103], "valor": [100000, 110000, 120000]}
    )
    nova = pd.DataFrame(
        {"unidade": [101, 102, 104], "valor": [100000, 115000, 130000]}
    )

    resultado = comparar_versoes(antiga, nova, "unidade")

    assert resultado["total_adicionadas"] == 1
    assert resultado["total_removidas"] == 1
    assert resultado["total_alteradas"] == 1
    assert resultado["adicionadas"]["unidade"].tolist() == [104]
    assert resultado["removidas"]["unidade"].tolist() == [103]
    assert resultado["alteradas"][0]["chave"] == 102


def test_comparar_versoes_identicas():
    df = pd.DataFrame({"unidade": [1, 2], "valor": [10, 20]})
    resultado = comparar_versoes(df, df.copy(), "unidade")

    assert resultado["total_adicionadas"] == 0
    assert resultado["total_removidas"] == 0
    assert resultado["total_alteradas"] == 0
