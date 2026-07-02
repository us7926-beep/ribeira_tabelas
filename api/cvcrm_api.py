"""Integração com o CV CRM (Ribeira). Somente leitura por enquanto.

Auth via JWT Bearer conforme o fluxo v3 documentado (desenvolvedor.
cvcrm.com.br/docs/como-autenticar-nas-apis-do-cv-crm-com-bearer-token):

  1. POST {CVCRM_BASE_URL}/v3/auth/token {email, senha, painel: "gestor"}
  2. Chamadas subsequentes usam `Authorization: Bearer <access_token>`.

Confirmado em produção (2026-07-01) contra a instância da Ribeira:
- A base é o DOMÍNIO DO CLIENTE (https://ribeira.cvcrm.com.br/api).
  O host integracao.cvcrm.com.br responde 403 "Token de acesso
  inválido" para JWTs v3 — só serve pro fluxo v1 (email+token).
- O response de auth vem ENVELOPADO: {status, code, data: {access_token,
  token_type, expires_in}}. A doc mostra sem envelope; toleramos ambos.
- `expires_in` chega como TIMESTAMP UNIX ABSOLUTO em string (ex.:
  "1782980700"), não duração em segundos como diz a doc.

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
    if resposta.status_code in (400, 401):
        raise RuntimeError(
            "CV CRM recusou credenciais. Verifique CVCRM_EMAIL/CVCRM_SENHA "
            "e se CVCRM_BASE_URL aponta pro domínio do cliente "
            "(ex.: https://ribeira.cvcrm.com.br/api)."
        )
    resposta.raise_for_status()
    try:
        dados = resposta.json()
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(f"Resposta de auth do CV CRM inválida: {exc}") from exc

    # Produção envelopa em {"data": {...}}; a doc mostra sem envelope.
    corpo = dados.get("data") if isinstance(dados.get("data"), dict) else dados
    token = corpo.get("access_token")
    if not token:
        raise RuntimeError("CV CRM não devolveu access_token no login.")
    expires_in = int(corpo.get("expires_in") or 21600)
    # Produção manda timestamp unix absoluto; a doc diz duração em segundos.
    if expires_in > 1_000_000_000:
        expira_em = float(expires_in)
    else:
        expira_em = agora + expires_in
    _cache_jwt["token"] = token
    _cache_jwt["expira_em"] = expira_em
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


# Códigos de `situacao` das unidades no CV CRM (confirmado no Mapa de
# Disponibilidade da Ribeira, 2026-07-01): a legenda do painel é
# Disponível/Reservada/Vendida/Bloqueada e a única unidade "Bloqueada
# (FORA VENDA)" bate com situacao=4 na API.
SITUACAO_DISPONIVEL = 1
SITUACAO_RESERVADA = 2
SITUACAO_VENDIDA = 3
SITUACAO_BLOQUEADA = 4

_UNIDADES_POR_PAGINA = 100
_MAX_PAGINAS = 50  # trava de segurança (5000 unidades)


def contar_situacao_unidades(id_empreendimento: str | int) -> dict:
    """Pagina todas as unidades ativas do empreendimento no CV CRM e conta
    por situação. Devolve dict com total + contagens + vso derivado.

    Só considera `ativoPainel = true` (unidades visíveis, igual ao painel).
    """
    contagem: dict[int, int] = {}
    total = 0
    pagina = 1
    while pagina <= _MAX_PAGINAS:
        dados = _get(
            f"/v4/cadastros/empreendimentos/{id_empreendimento}/unidades"
            f"?pagina={pagina}&registros_por_pagina={_UNIDADES_POR_PAGINA}"
        )
        linhas = _lista(dados)
        if not linhas:
            break
        for u in linhas:
            if not u.get("ativoPainel", True):
                continue
            total += 1
            sit = u.get("situacao")
            contagem[sit] = contagem.get(sit, 0) + 1
        total_paginas = 1
        if isinstance(dados, dict):
            total_paginas = int(dados.get("pagination", {}).get("totalPaginas", 1) or 1)
        if pagina >= total_paginas:
            break
        pagina += 1

    vendidas = contagem.get(SITUACAO_VENDIDA, 0)
    disponiveis = contagem.get(SITUACAO_DISPONIVEL, 0)
    reservadas = contagem.get(SITUACAO_RESERVADA, 0)
    bloqueadas = contagem.get(SITUACAO_BLOQUEADA, 0)
    outras = total - vendidas - disponiveis - reservadas - bloqueadas
    vso = round(vendidas / total * 100, 2) if total else 0.0
    return {
        "total_unidades": total,
        "vendidas": vendidas,
        "disponiveis": disponiveis,
        "reservadas": reservadas,
        "bloqueadas": bloqueadas,
        "outras": outras,
        "vso": vso,
    }


def invalidar_cache_jwt() -> None:
    """Zera o cache — útil quando a env muda ou pra forçar renovação."""
    _cache_jwt["token"] = ""
    _cache_jwt["expira_em"] = 0.0
