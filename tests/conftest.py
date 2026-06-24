"""Fixtures compartilhadas dos testes.

Antes, cada arquivo redefinia ``_resposta_falsa`` e chamava ``.clear()`` à mão.
Centralizamos aqui: ``mock_bcb`` simula a API do BCB (via pytest-mock) e
``_limpar_cache_incc`` zera o cache do st.cache_data antes de cada teste,
tornando-os determinísticos.
"""
import pytest


@pytest.fixture(autouse=True)
def _limpar_cache_incc():
    """Zera o cache das funções de busca antes de cada teste (evita colisão)."""
    from src.incc import buscar_indices_incc_di, buscar_variacoes_incc_di

    buscar_indices_incc_di.clear()
    buscar_variacoes_incc_di.clear()
    yield


@pytest.fixture
def mock_bcb(mocker):
    """Factory que configura a resposta de ``src.incc.requests.get``.

    Uso: ``mock_bcb([{"data": "01/01/2024", "valor": "0.50"}], status=200)``.
    """
    def _configurar(dados: list[dict], status: int = 200):
        resposta = mocker.MagicMock()
        resposta.status_code = status
        resposta.json.return_value = dados
        resposta.raise_for_status.return_value = None
        return mocker.patch("src.incc.requests.get", return_value=resposta)

    return _configurar
