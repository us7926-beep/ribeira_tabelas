"""Autenticação por usuário/senha (SHA-256) com persistência via cookie.

A sessão fica em ``st.session_state`` (válida enquanto a aba está aberta) e
também num cookie assinado. O Streamlit descarta o ``session_state`` a cada
F5/refresh; o cookie sobrevive e re-autentica o usuário automaticamente, então
o refresh deixa de deslogar.

O cookie guarda um token ``usuario|expiração|assinatura``. A assinatura é um
HMAC-SHA256 cuja chave deriva dos hashes em ``st.secrets`` — que não estão no
código público — impedindo que o token seja forjado.
"""
import hashlib
import hmac
import time
from datetime import datetime, timedelta, timezone

import extra_streamlit_components as stx
import streamlit as st

COOKIE_NOME = "ribeira_auth"
VALIDADE_HORAS = 12


# --------------------------------------------------------------------------- #
# Cookie / token assinado
# --------------------------------------------------------------------------- #
def get_cookie_manager() -> stx.CookieManager:
    """Gerenciador de cookies. Deve ser instanciado uma única vez por execução."""
    return stx.CookieManager(key="ribeira_cookie_manager")


def _segredo_assinatura() -> str:
    """Chave HMAC derivada dos hashes em secrets (ausentes do código público)."""
    usuarios = st.secrets.get("auth", {}).get("usuarios", {})
    base = "|".join(f"{u}:{h}" for u, h in sorted(usuarios.items()))
    return base or "ribeira-fallback-secret"


def _assinar(payload: str) -> str:
    return hmac.new(_segredo_assinatura().encode(), payload.encode(), hashlib.sha256).hexdigest()


def _gerar_token(usuario: str) -> str:
    expira_em = int(time.time()) + VALIDADE_HORAS * 3600
    payload = f"{usuario}|{expira_em}"
    return f"{payload}|{_assinar(payload)}"


def _usuario_do_token(token: str | None) -> str | None:
    """Devolve o usuário se o token for íntegro, não expirado e ainda existir."""
    if not token or token.count("|") != 2:
        return None
    usuario, expira_em, assinatura = token.split("|")
    if not hmac.compare_digest(assinatura, _assinar(f"{usuario}|{expira_em}")):
        return None
    try:
        if int(expira_em) < time.time():
            return None
    except ValueError:
        return None
    if usuario not in st.secrets.get("auth", {}).get("usuarios", {}):
        return None
    return usuario


# --------------------------------------------------------------------------- #
# Credenciais e estado de sessão
# --------------------------------------------------------------------------- #
def _hash(senha: str) -> str:
    return hashlib.sha256(senha.encode()).hexdigest()


def _credenciais_validas(usuario: str, senha: str) -> bool:
    usuarios = st.secrets.get("auth", {}).get("usuarios", {})
    hash_esperado = usuarios.get(usuario)
    return bool(hash_esperado) and _hash(senha) == hash_esperado


def _marcar_autenticado(usuario: str) -> None:
    st.session_state["autenticado"] = True
    st.session_state["usuario"] = usuario
    st.session_state.setdefault("login_em", datetime.now(timezone.utc).isoformat())


def esta_autenticado() -> bool:
    return st.session_state.get("autenticado", False)


def usuario_atual() -> str | None:
    return st.session_state.get("usuario")


def fazer_logout(cookies: stx.CookieManager) -> None:
    for chave in ("autenticado", "usuario", "login_em"):
        st.session_state.pop(chave, None)
    # Sem st.rerun() aqui também: deixar o delete() apagar o cookie no navegador
    # antes do rerun que ele próprio dispara (senão o cookie sobreviveria e o
    # usuário voltaria a logar automaticamente).
    try:
        cookies.delete(COOKIE_NOME)
    except Exception:  # noqa: BLE001 — cookie pode nem existir; logout não deve falhar
        pass


# --------------------------------------------------------------------------- #
# Fluxo de login
# --------------------------------------------------------------------------- #
_PAINEL_MARCA = """
<div class="login-brand">
  <div class="lb-logo"><div class="sb-logo">T</div>
    <div><b style="font-size:17px">TabLM</b><br>
    <small style="color:rgba(255,255,255,.7);letter-spacing:1.5px;font-size:11px">
    RIBEIRA EMPREENDIMENTOS</small></div></div>
  <h1>Inteligência de tabelas para o seu portfólio imobiliário.</h1>
  <div class="sub">Dashboards de vendas, comparação de concorrência, reajuste por
  INCC e detecção de padrões — tudo em um só lugar.</div>
  <div class="login-stats">
    <div><b>5</b><span>módulos</span></div>
    <div><b>INCC-DI</b><span>fonte oficial</span></div>
    <div><b>Decimal</b><span>precisão exata</span></div>
  </div>
</div>
"""


def _formulario_login(cookies: stx.CookieManager) -> None:
    col_marca, col_form = st.columns([46, 54], gap="large")
    with col_marca:
        st.markdown(_PAINEL_MARCA, unsafe_allow_html=True)

    with col_form:
        st.markdown('<div class="login-eyebrow">BEM-VINDO DE VOLTA</div>', unsafe_allow_html=True)
        st.markdown('<div class="login-title">Entrar na sua conta</div>', unsafe_allow_html=True)
        with st.form("login_form"):
            usuario = st.text_input("Usuário")
            senha = st.text_input("Senha", type="password")
            manter = st.checkbox("Manter conectado", value=True)
            enviado = st.form_submit_button("Entrar", use_container_width=True, type="primary")

    if not enviado:
        return

    if not _credenciais_validas(usuario, senha):
        with col_form:
            st.error("Usuário ou senha inválidos.")
        return

    _marcar_autenticado(usuario)
    # IMPORTANTE: não chamar st.rerun() aqui. O cookie é gravado quando o
    # componente do set() renderiza no navegador; um st.rerun() imediato
    # interrompe esse render e o cookie nunca chega ao navegador (era o bug do
    # "desloga no F5"). O próprio set() dispara o rerun depois de gravar.
    if manter:
        try:
            cookies.set(
                COOKIE_NOME,
                _gerar_token(usuario),
                expires_at=datetime.now() + timedelta(hours=VALIDADE_HORAS),
            )
        except Exception:  # noqa: BLE001 — sem cookie a sessão ainda vale; só não persiste no refresh
            pass


def verificar_login(cookies: stx.CookieManager) -> None:
    """Bloqueia o app até autenticar, restaurando a sessão pelo cookie se houver."""
    if not esta_autenticado():
        usuario = _usuario_do_token(cookies.get(COOKIE_NOME))
        if usuario:
            _marcar_autenticado(usuario)

    if esta_autenticado():
        return

    _formulario_login(cookies)
    st.stop()
