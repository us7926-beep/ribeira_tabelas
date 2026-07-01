"""Integração com o CV CRM (Ribeira). Somente leitura por enquanto.

Credenciais e URL base ficam em env vars (config.cvcrm_*). Nada
persistido: os endpoints são passthrough; a modelagem tipada
(TabelaPreco[]) fica pra PR seguinte quando o schema real do CV CRM
estiver observado.
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
    email = config.cvcrm_email()
    token = config.cvcrm_token()
    if not (email and token):
        raise RuntimeError("CVCRM_EMAIL/CVCRM_TOKEN não configurados.")
    # CV CRM usa headers custom com email + token (não é Basic/Bearer padrão).
    return {"email": email, "token": token, "accept": "application/json"}


def _get(path: str) -> Any:
    resposta = requests.get(f"{_base()}{path}", headers=_headers(), timeout=_TIMEOUT)
    if resposta.status_code == 403:
        raise RuntimeError(
            "CV CRM negou acesso (403). Verifique CVCRM_EMAIL/CVCRM_TOKEN."
        )
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


def listar_tabelas_preco() -> list[dict]:
    """GET /v1/cv/tabelasdepreco."""
    return _lista(_get("/v1/cv/tabelasdepreco"))


def listar_series_tabela_preco() -> list[dict]:
    """GET /v1/cv/seriestabelasdepreco."""
    return _lista(_get("/v1/cv/seriestabelasdepreco"))
