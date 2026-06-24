"""Persistência do benchmark em Supabase (Postgres), com fallback em sessão.

Abordagem MISTA: se ``[supabase]`` estiver nos secrets, grava/lê do banco;
se faltar ou cair, opera só em ``st.session_state`` — o app nunca quebra.
Como as colunas espelham os campos da ficha, dá pra ver/editar os dados no
editor de tabelas do Supabase, igual planilha.
"""
import streamlit as st

TABELA = "benchmark_fichas"
_CHAVE_SESSAO = "fichas_benchmark"


def _config() -> dict:
    try:
        return dict(st.secrets.get("supabase", {}))
    except Exception:  # noqa: BLE001 — secrets ausente em ambiente local
        return {}


def supabase_configurado() -> bool:
    """True se há url + key do Supabase nos secrets."""
    cfg = _config()
    return bool(cfg.get("url") and cfg.get("key"))


@st.cache_resource(show_spinner=False)
def _cliente():
    from supabase import create_client

    cfg = _config()
    return create_client(cfg["url"], cfg["key"])


def _sem_internos(ficha: dict) -> dict:
    """Remove chaves internas (começam com '_') que não existem na tabela."""
    return {chave: valor for chave, valor in ficha.items() if not chave.startswith("_")}


def salvar_ficha(ficha: dict) -> str:
    """Salva uma ficha. Retorna 'supabase' ou 'sessao' conforme onde gravou."""
    if supabase_configurado():
        try:
            _cliente().table(TABELA).insert(_sem_internos(ficha)).execute()
            return "supabase"
        except Exception as exc:  # noqa: BLE001 — cai pra sessão sem quebrar
            st.warning(f"Supabase falhou, salvei na sessão: {exc}")
    st.session_state.setdefault(_CHAVE_SESSAO, []).append(ficha)
    return "sessao"


def listar_fichas() -> list[dict]:
    """Lista as fichas salvas (banco se configurado; senão, sessão)."""
    if supabase_configurado():
        try:
            resposta = (
                _cliente().table(TABELA).select("*").order("id", desc=True).execute()
            )
            return resposta.data or []
        except Exception as exc:  # noqa: BLE001 — mostra a sessão sem quebrar
            st.warning(f"Supabase indisponível, mostrando a sessão: {exc}")
    return st.session_state.get(_CHAVE_SESSAO, [])


def limpar_base() -> None:
    """Apaga toda a base (banco e sessão). Use com cuidado."""
    if supabase_configurado():
        try:
            _cliente().table(TABELA).delete().neq("id", 0).execute()
        except Exception as exc:  # noqa: BLE001
            st.warning(f"Não consegui limpar no Supabase: {exc}")
    st.session_state[_CHAVE_SESSAO] = []
