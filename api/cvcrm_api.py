"""Integração com o CV CRM (Ribeira). Somente leitura por enquanto.

Auth via Bearer Token no header Authorization (confirmado na documentação
oficial do CV CRM em desenvolvedor.cvcrm.com.br). Base URL vem da env
CVCRM_BASE_URL — na Ribeira, `https://integracao.cvcrm.com.br/api`.
"""
from typing import Any

import requests

from . import config

_TIMEOUT = 15


def _base() -> str:
    url = config.cvcrm_base_url().rstrip("/")
    if not url:
        raise RuntimeError("CVCRM_BASE_URL não configurado.")
    return url


def _headers() -> dict[str, str]:
    token = config.cvcrm_token()
    if not token:
        raise RuntimeError("CVCRM_TOKEN não configurado.")
    return {
        "Authorization": f"Bearer {token}",
        "accept": "application/json",
    }


def _get(path: str) -> Any:
    resposta = requests.get(f"{_base()}{path}", headers=_headers(), timeout=_TIMEOUT)
    if resposta.status_code == 403:
        raise RuntimeError("CV CRM negou acesso (403). Verifique CVCRM_TOKEN.")
    resposta.raise_for_status()
    try:
        return resposta.json()
    except Exception as exc:  # noqa: BLE001 — resposta não-JSON
        raise RuntimeError(f"Resposta do CV CRM inválida (não-JSON): {exc}") from exc


def _lista(dados: Any) -> list[dict]:
    """Tolera tanto ``[...]`` direto quanto ``{"data": [...]}``."""
    if isinstance(dados, list):
        return dados
    if isinstance(dados, dict) and isinstance(dados.get("data"), list):
        return dados["data"]
    return []


def listar_tabelas_preco_empreendimento(id_empreendimento: str) -> list[dict]:
    """GET /v3/cadastros/empreendimentos/{id}/tabelas-preco — por empreendimento."""
    return _lista(
        _get(f"/v3/cadastros/empreendimentos/{id_empreendimento}/tabelas-preco")
    )


def listar_series_tabela_preco() -> list[dict]:
    """GET /v1/comercial/seriestabeladepreco — global (sem parâmetro)."""
    return _lista(_get("/v1/comercial/seriestabeladepreco"))
