"""Geocoding via Nominatim (OpenStreetMap) — gratuito, sem API key.

Regras da API pública do Nominatim (https://operations.osmfoundation.org/policies/nominatim/):
- Máximo 1 request por segundo.
- User-Agent com identificação obrigatório.
- Não usar pra bulk geocoding pesado (mais de alguns milhares de queries/dia).

Este módulo respeita ambas as regras:
- ``_lock`` serializa chamadas simultâneas.
- Cache in-memory por chave ("bairro|cidade") evita repetir queries.
- ``User-Agent`` fixo "TabLM/1.0 (https://github.com/us7926-beep/ribeira_tabelas)".

Uso: chame ``geocode("Vila Mogilar", "Mogi das Cruzes")`` e receba
``{"lat": -23.52, "lng": -46.19, "formatado": "..."}`` ou None quando o
endereço não foi resolvido.
"""
from __future__ import annotations

import threading
import time
from typing import Any

import requests

_ENDPOINT = "https://nominatim.openstreetmap.org/search"
_USER_AGENT = "TabLM/1.0 (https://github.com/us7926-beep/ribeira_tabelas)"
_TIMEOUT = 10
_MIN_INTERVALO = 1.05  # segundos entre requests (folga sobre o 1 rps oficial)

_lock = threading.Lock()
_ultima_chamada = 0.0
_cache: dict[str, dict | None] = {}


def _chave(bairro: str, cidade: str) -> str:
    return f"{(bairro or '').strip().lower()}|{(cidade or '').strip().lower()}"


def _consultar_nominatim(query: str) -> dict | None:
    """Faz UMA chamada ao Nominatim respeitando o rate limit. Retorna
    o primeiro resultado ou None. Sob o lock — serializa chamadas."""
    global _ultima_chamada
    with _lock:
        agora = time.time()
        atraso = _MIN_INTERVALO - (agora - _ultima_chamada)
        if atraso > 0:
            time.sleep(atraso)
        _ultima_chamada = time.time()
        resposta = requests.get(
            _ENDPOINT,
            params={
                "q": query,
                "format": "json",
                "limit": 1,
                "countrycodes": "br",
                "accept-language": "pt-BR",
            },
            headers={"User-Agent": _USER_AGENT},
            timeout=_TIMEOUT,
        )
    if resposta.status_code != 200:
        return None
    try:
        dados: list[Any] = resposta.json()
    except Exception:  # noqa: BLE001
        return None
    if not dados:
        return None
    primeiro = dados[0]
    try:
        return {
            "lat": float(primeiro["lat"]),
            "lng": float(primeiro["lon"]),
            "formatado": str(primeiro.get("display_name") or "").strip(),
        }
    except (KeyError, TypeError, ValueError):
        return None


def geocode(bairro: str, cidade: str) -> dict | None:
    """Resolve endereço → {lat, lng, formatado}. Cacheado por processo.

    Tenta 3 formatos em ordem de especificidade:
    1. "{bairro}, {cidade}, Brasil"
    2. "{cidade}, Brasil" (fallback quando bairro sozinho não bate)
    3. Só cidade (mesma consulta que 2; retorna resultado da 2 se cachear)

    Retorna None quando ninguém achou.
    """
    chave = _chave(bairro, cidade)
    if chave in _cache:
        return _cache[chave]

    bairro_l = (bairro or "").strip()
    cidade_l = (cidade or "").strip()
    if not cidade_l:
        _cache[chave] = None
        return None

    if bairro_l:
        resultado = _consultar_nominatim(f"{bairro_l}, {cidade_l}, Brasil")
        if resultado is not None:
            _cache[chave] = resultado
            return resultado

    # Fallback: só cidade — vai cair no centro da cidade quando não achamos
    # o bairro. Ainda útil pro mapa (agrupa em cluster no centro).
    resultado = _consultar_nominatim(f"{cidade_l}, Brasil")
    _cache[chave] = resultado
    return resultado


def limpar_cache() -> None:
    """Zera o cache — útil em testes."""
    _cache.clear()
