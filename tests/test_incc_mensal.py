from decimal import Decimal
from unittest.mock import MagicMock, patch

import pandas as pd

from src.incc import buscar_variacoes_incc_di, reajustar_tabela_mensal, reajustar_valor_mensal


def test_reajustar_valor_mensal_percentual():
    # 1000 + 0,88% = 1008,80
    assert reajustar_valor_mensal("1000.00", "0.88") == Decimal("1008.80")


def test_reajustar_valor_mensal_com_extra_e_bruto():
    # 1000 * (1 + 1.88/100) + 500 = 1018.80 + 500 = 1518.80
    assert reajustar_valor_mensal("1000.00", "1.88", "500.00") == Decimal("1518.80")


def test_reajustar_valor_mensal_so_bruto():
    # 1000 * (1 + 0) + 250 = 1250.00
    assert reajustar_valor_mensal("1000.00", "0", "250.00") == Decimal("1250.00")


def test_reajustar_tabela_mensal_cria_coluna():
    df = pd.DataFrame({"unidade": [1, 2], "valor": [1000.0, 2000.0]})
    resultado = reajustar_tabela_mensal(df, "valor", "0.88")
    assert "valor_reajustado" in resultado.columns
    assert resultado["valor_reajustado"].tolist() == [1008.80, 2017.60]
    # tabela original não é mutada
    assert "valor_reajustado" not in df.columns


def _resposta_falsa(dados_json, status=200):
    resposta = MagicMock()
    resposta.status_code = status
    resposta.json.return_value = dados_json
    resposta.raise_for_status.return_value = None
    return resposta


@patch("src.incc.requests.get")
def test_buscar_variacoes_incc_di_parseia_mensal(mock_get):
    mock_get.return_value = _resposta_falsa(
        [
            {"data": "01/04/2026", "valor": "0.90"},
            {"data": "01/05/2026", "valor": "0.88"},
        ]
    )
    variacoes = buscar_variacoes_incc_di("01/04/2026", "01/05/2026")
    assert variacoes["2026-04"] == Decimal("0.90")
    assert variacoes["2026-05"] == Decimal("0.88")
