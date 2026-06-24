"""Persistência da base de inteligência de mercado.

Se houver credenciais em ``st.secrets["gsheets"]``, a base é lida/gravada numa
planilha do Google Sheets (histórico persistente entre sessões). Caso contrário,
funciona apenas com a sessão (``st.session_state``) — sem quebrar o app.

Formato esperado em secrets.toml:

    [gsheets]
    spreadsheet_id = "ID_DA_PLANILHA"
    [gsheets.service_account]
    type = "service_account"
    project_id = "..."
    private_key = "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
    client_email = "...@...gserviceaccount.com"
    # demais campos do JSON da service account
"""
import pandas as pd
import streamlit as st

from src.mercado import COLUNAS_BASE, base_vazia

_CHAVE_SESSAO = "base_mercado"
_FLAG_CARREGADA = "_base_mercado_carregada"
_ESCOPOS = ["https://www.googleapis.com/auth/spreadsheets"]


def sheets_configurado() -> bool:
    """True se há credenciais do Google Sheets nos secrets."""
    try:
        return "gsheets" in st.secrets and "service_account" in st.secrets["gsheets"]
    except Exception:  # noqa: BLE001 — secrets ausente em ambiente local
        return False


@st.cache_resource(show_spinner=False)
def _abrir_planilha():
    """Abre (e cacheia) a primeira aba da planilha configurada."""
    import gspread
    from google.oauth2.service_account import Credentials

    cfg = st.secrets["gsheets"]
    credenciais = Credentials.from_service_account_info(
        dict(cfg["service_account"]), scopes=_ESCOPOS
    )
    cliente = gspread.authorize(credenciais)
    return cliente.open_by_key(cfg["spreadsheet_id"]).sheet1


def _ler_do_sheets() -> pd.DataFrame:
    planilha = _abrir_planilha()
    df = pd.DataFrame(planilha.get_all_records())
    if df.empty:
        return base_vazia()
    # garante numérico onde faz sentido e mantém o schema
    for coluna in ("area", "valor", "preco_m2"):
        if coluna in df.columns:
            df[coluna] = pd.to_numeric(df[coluna], errors="coerce")
    return df.reindex(columns=COLUNAS_BASE)


def _gravar_no_sheets(base: pd.DataFrame) -> None:
    planilha = _abrir_planilha()
    planilha.clear()
    corpo = [COLUNAS_BASE] + base.fillna("").astype(str).values.tolist()
    planilha.update(corpo)


def obter_base() -> pd.DataFrame:
    """Retorna a base de trabalho, carregando do Sheets na 1ª vez (se houver)."""
    if sheets_configurado() and not st.session_state.get(_FLAG_CARREGADA):
        try:
            st.session_state[_CHAVE_SESSAO] = _ler_do_sheets()
        except Exception as exc:  # noqa: BLE001
            st.warning(f"Não consegui ler o Google Sheets ({exc}). Usando base da sessão.")
            st.session_state.setdefault(_CHAVE_SESSAO, base_vazia())
        st.session_state[_FLAG_CARREGADA] = True

    return st.session_state.setdefault(_CHAVE_SESSAO, base_vazia())


def persistir(base: pd.DataFrame) -> None:
    """Atualiza a base na sessão e, se configurado, grava no Google Sheets."""
    st.session_state[_CHAVE_SESSAO] = base
    if not sheets_configurado():
        return
    try:
        _gravar_no_sheets(base)
    except Exception as exc:  # noqa: BLE001
        st.warning(f"Não consegui salvar no Google Sheets ({exc}). Base mantida na sessão.")
