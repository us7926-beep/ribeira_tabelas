from decimal import Decimal
from unittest.mock import MagicMock, patch

from src.incc import SERIE_INCC_DI, buscar_indices_incc_di


def test_serie_incc_di_e_192():
    # Série 192 = INCC-DI (FGV), confere com a tabela oficial. NÃO usar 7456 (INCC-M).
    assert SERIE_INCC_DI == 192


def _resposta_falsa(dados_json, status=200):
    resposta = MagicMock()
    resposta.status_code = status
    resposta.json.return_value = dados_json
    resposta.raise_for_status.return_value = None
    return resposta


@patch("src.incc.requests.get")
def test_buscar_indices_incc_di_acumula_variacoes(mock_get):
    buscar_indices_incc_di.clear()  # evita colisão de cache entre testes
    mock_get.return_value = _resposta_falsa(
        [
            {"data": "01/01/2024", "valor": "0.50"},
            {"data": "01/02/2024", "valor": "1.00"},
        ]
    )

    indices = buscar_indices_incc_di("01/01/2024", "01/02/2024")

    assert indices["2024-01"] == Decimal("100.5000")
    # 100.5 * 1.01 = 101.505
    assert indices["2024-02"] == Decimal("101.5050")


@patch("src.incc.requests.get")
def test_buscar_indices_incc_di_sem_dados_levanta_erro(mock_get):
    buscar_indices_incc_di.clear()
    mock_get.return_value = _resposta_falsa([])

    try:
        buscar_indices_incc_di("01/03/2024", "01/04/2024")
        assert False, "deveria ter levantado ValueError"
    except ValueError:
        pass


@patch("src.incc.requests.get")
def test_buscar_indices_incc_di_404_mensagem_amigavel(mock_get):
    buscar_indices_incc_di.clear()
    mock_get.return_value = _resposta_falsa([], status=404)

    try:
        buscar_indices_incc_di("24/06/2026", "24/06/2026")
        assert False, "deveria ter levantado ValueError"
    except ValueError as exc:
        assert "período" in str(exc)
