"""Autenticação simples por usuário/senha usando hashes SHA-256 em st.secrets."""
import hashlib
from datetime import datetime, timezone

import streamlit as st


def _hash(senha: str) -> str:
    return hashlib.sha256(senha.encode()).hexdigest()


def _credenciais_validas(usuario: str, senha: str) -> bool:
    usuarios = st.secrets.get("auth", {}).get("usuarios", {})
    hash_esperado = usuarios.get(usuario)
    if not hash_esperado:
        return False
    return _hash(senha) == hash_esperado


def esta_autenticado() -> bool:
    return st.session_state.get("autenticado", False)


def usuario_atual() -> str | None:
    return st.session_state.get("usuario")


def fazer_logout() -> None:
    for chave in ("autenticado", "usuario", "login_em"):
        st.session_state.pop(chave, None)
    st.rerun()


def _formulario_login() -> None:
    st.title("🔐 Ribeira Tabelas")
    st.caption("Acesso restrito — informe suas credenciais para continuar.")

    with st.form("login_form"):
        usuario = st.text_input("Usuário")
        senha = st.text_input("Senha", type="password")
        enviado = st.form_submit_button("Entrar", use_container_width=True)

    if enviado:
        if _credenciais_validas(usuario, senha):
            st.session_state["autenticado"] = True
            st.session_state["usuario"] = usuario
            st.session_state["login_em"] = datetime.now(timezone.utc).isoformat()
            st.rerun()
        else:
            st.error("Usuário ou senha inválidos.")


def verificar_login() -> None:
    """Bloqueia a execução do app até que o usuário esteja autenticado."""
    if esta_autenticado():
        return

    _formulario_login()
    st.stop()
