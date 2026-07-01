"""Integração com o CV CRM (Ribeira). Somente leitura por enquanto.

Auth via JWT Bearer conforme o fluxo v3 documentado (desenvolvedor.
cvcrm.com.br/docs/como-autenticar-nas-apis-do-cv-crm-com-bearer-token):

  1. POST /api/v3/auth/token {email, senha, painel: "gestor"}
     → devolve {access_token, token_type: "Bearer", expires_in: 21600s}
  2. Chamadas subsequentes usam `Authorization: Bearer <access_token>`.

O JWT é cacheado em memória e renovado 60s antes de expirar. Sem cache
persistente — cada processo do backend renova o próprio.
"""
import time
from typing import Any

import requests

from . import config

_TIMEOUT = 15
_RENOVAR_ANTES_SEG = 60  # renova 1 min antes de expirar

# Cache in-process: {"token": <jwt>, "expira_em": <unix ts>}
_cache_jwt: dict[str, Any] = {"token": "", "expira_em": 0.0}


def _base() -> str:
    url = config.cvcrm_base_url().rstrip("/")
    if not url:
        raise RuntimeError("CVCRM_BASE_URL não configurado.")
    return url


def _obter_jwt() -> str:
    """Devolve o JWT válido, renovando via POST /auth/token quando expirado."""
    agora = time.time()
    if _cache_jwt["token"] and _cache_jwt["expira_em"] - agora > _RENOVAR_ANTES_SEG:
        return _cache_jwt["token"]

    email = config.cvcrm_email()
    senha = config.cvcrm_senha()
    if not (email and senha):
        raise RuntimeError("CVCRM_EMAIL/CVCRM_SENHA não configurados.")

    resposta = requests.post(
        f"{_base()}/v3/auth/token",
        json={"email": email, "senha": senha, "painel": "gestor"},
        headers={"accept": "application/json"},
        timeout=_TIMEOUT,
    )
    if resposta.status_code == 401:
        raise RuntimeError("CV CRM recusou credenciais (401). Verifique CVCRM_EMAIL/CVCRM_SENHA.")
    resposta.raise_for_status()
    try:
        dados = resposta.json()
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(f"Resposta de auth do CV CRM inválida: {exc}") from exc

    token = dados.get("access_token")
    if not token:
        raise RuntimeError("CV CRM não devolveu access_token no login.")
    expires_in = int(dados.get("expires_in") or 21600)
    _cache_jwt["token"] = token
    _cache_jwt["expira_em"] = agora + expires_in
    return token


def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {_obter_jwt()}",
        "accept": "application/json",
    }


def _get(path: str) -> Any:
    resposta = requests.get(f"{_base()}{path}", headers=_headers(), timeout=_TIMEOUT)
    if resposta.status_code == 403:
        raise RuntimeError("CV CRM negou acesso (403). Verifique permissões do usuário.")
    resposta.raise_for_status()
    try:
        return resposta.json()
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(f"Resposta do CV CRM inválida (não-JSON): {exc}") from exc


def _lista(dados: Any) -> list[dict]:
    """Tolera tanto ``[...]`` direto quanto ``{"data": [...]}``."""
    if isinstance(dados, list):
        return dados
    if isinstance(dados, dict) and isinstance(dados.get("data"), list):
        return dados["data"]
    return []


def listar_tabelas_preco_empreendimento(id_empreendimento: str) -> list[dict]:
    """GET /v3/cadastros/empreendimentos/{id}/tabelas-preco."""
    return _lista(
        _get(f"/v3/cadastros/empreendimentos/{id_empreendimento}/tabelas-preco")
    )


def invalidar_cache_jwt() -> None:
    """Zera o cache — útil quando a env muda ou pra forçar renovação."""
    _cache_jwt["token"] = ""
    _cache_jwt["expira_em"] = 0.0
