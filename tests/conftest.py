"""Fixtures compartilhadas entre todos os arquivos de teste (backend + INCC).

pytest descobre este arquivo automaticamente — não precisa importar.

Divide em 3 grupos:
- ``cliente``, ``get_token``, ``auth_headers``, ``SENHA``: backend FastAPI.
- ``mock_bcb``: mocka ``src.incc.requests.get`` (API do BCB).
- ``_limpar_cache_incc``: zera o cache do st.cache_data antes de cada teste
  pra os testes do módulo `src.incc` serem determinísticos.
"""
import hashlib
import json

import pytest
from fastapi.testclient import TestClient

# --------------------------------------------------------------------------- #
# Backend FastAPI
# --------------------------------------------------------------------------- #
SENHA = "segredo123"


@pytest.fixture
def cliente(monkeypatch):
    """TestClient do FastAPI com env de teste. Ausência deliberada de
    Supabase (assim endpoints que tocam DB devolvem 503 quando não são
    mockados)."""
    monkeypatch.setenv("TABLM_USERS", json.dumps({"teste": hashlib.sha256(SENHA.encode()).hexdigest()}))
    monkeypatch.setenv("JWT_SECRET", "segredo-de-teste-com-tamanho-suficiente-123")
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_KEY", raising=False)
    from api.main import app
    return TestClient(app)


def get_token(cliente) -> str:
    """JWT válido pra os endpoints autenticados."""
    return cliente.post("/auth/login", json={"usuario": "teste", "senha": SENHA}).json()["token"]


def auth_headers(cliente) -> dict:
    """Header Authorization pronto — usa em testes com endpoint autenticado."""
    return {"Authorization": f"Bearer {get_token(cliente)}"}


def post_vendas(cliente, csv: bytes) -> dict:
    """POST /vendas/kpis com CSV inline. Retorna o body JSON."""
    resposta = cliente.post(
        "/vendas/kpis",
        headers=auth_headers(cliente),
        files={"arquivo": ("tabela.csv", csv, "text/csv")},
    )
    assert resposta.status_code == 200, resposta.text
    return resposta.json()


# --------------------------------------------------------------------------- #
# INCC / BCB (src.incc)
# --------------------------------------------------------------------------- #
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
        return mocker.patch("src.incc.requests.get", return_value=resposta)

    return _configurar
