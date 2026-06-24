"""Testes da integração com a API do BCB (dependência externa via pytest-mock)."""
from decimal import Decimal

import pytest

from src.incc import SERIE_INCC_DI, buscar_indices_incc_di, buscar_variacoes_incc_di


def test_serie_incc_di_deve_ser_192():
    # Série 192 = INCC-DI (FGV), confere com a tabela oficial. NÃO usar 7456 (INCC-M).
    assert SERIE_INCC_DI == 192


def test_deve_acumular_variacoes_em_base_100_quando_busca_indices(mock_bcb):
    mock_bcb([
        {"data": "01/01/2024", "valor": "0.50"},
        {"data": "01/02/2024", "valor": "1.00"},
    ])

    indices = buscar_indices_incc_di("01/01/2024", "01/02/2024")

    assert indices["2024-01"] == Decimal("100.5000")
    assert indices["2024-02"] == Decimal("101.5050")  # 100.5 * 1.01


def test_deve_mapear_variacao_mensal_por_competencia_quando_busca_variacoes(mock_bcb):
    mock_bcb([
        {"data": "01/04/2026", "valor": "1.00"},
        {"data": "01/05/2026", "valor": "0.88"},
    ])

    variacoes = buscar_variacoes_incc_di("01/04/2026", "31/05/2026")

    assert variacoes == {"2026-04": Decimal("1.00"), "2026-05": Decimal("0.88")}


def test_deve_levantar_erro_amigavel_quando_api_retorna_404(mock_bcb):
    mock_bcb([], status=404)

    with pytest.raises(ValueError, match="período"):
        buscar_variacoes_incc_di("24/06/2026", "24/06/2026")


def test_deve_levantar_erro_quando_api_retorna_lista_vazia(mock_bcb):
    mock_bcb([], status=200)

    with pytest.raises(ValueError, match="não retornou dados"):
        buscar_variacoes_incc_di("01/01/2024", "01/02/2024")


def test_deve_consultar_a_serie_192_quando_busca_na_api(mock_bcb):
    patch_get = mock_bcb([{"data": "01/05/2026", "valor": "0.88"}])

    buscar_variacoes_incc_di("01/05/2026", "31/05/2026")

    url_chamada = patch_get.call_args.args[0]
    assert "bcdata.sgs.192" in url_chamada  # garante INCC-DI, não INCC-M
