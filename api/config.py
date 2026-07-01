"""Configuração do backend via variáveis de ambiente.

Nada de segredo no código (repo público). No deploy (Railway/Render) defina:
- TABLM_USERS   : JSON {"usuario": "<hash sha256 da senha>"} (mesmo hash do Streamlit)
- JWT_SECRET    : segredo para assinar o JWT
- GEMINI_API_KEY: chave do Google Gemini
- SUPABASE_URL / SUPABASE_KEY (service_role)
- CORS_ORIGINS  : origens permitidas, separadas por vírgula (ex.: o domínio do Vercel)
"""
import json
import os
from pathlib import Path

from dotenv import load_dotenv

# Carrega api/.env em desenvolvimento (gitignored). Em produção, as variáveis
# vêm do painel (Railway/Render) e este load não acha arquivo — sem efeito.
load_dotenv(Path(__file__).resolve().parent / ".env")


def users() -> dict:
    """Mapa {usuario: hash_sha256} lido de TABLM_USERS (JSON)."""
    bruto = os.environ.get("TABLM_USERS", "").strip()
    if not bruto:
        return {}
    try:
        return json.loads(bruto)
    except json.JSONDecodeError:
        return {}


def jwt_secret() -> str:
    v = os.environ.get("JWT_SECRET", "")
    if not v:
        raise RuntimeError("JWT_SECRET não configurado — defina a variável de ambiente.")
    return v


def jwt_expire_hours() -> int:
    try:
        return int(os.environ.get("JWT_EXPIRE_HOURS", "12"))
    except ValueError:
        return 12


def gemini_api_key() -> str:
    return os.environ.get("GEMINI_API_KEY", "")


def gemini_model() -> str:
    return os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")


def supabase_url() -> str:
    return os.environ.get("SUPABASE_URL", "")


def supabase_key() -> str:
    return os.environ.get("SUPABASE_KEY", "")


def cors_origins() -> list[str]:
    bruto = os.environ.get("CORS_ORIGINS", "http://localhost:3000")
    return [origem.strip() for origem in bruto.split(",") if origem.strip()]


# --------------------------------------------------------------------------- #
# Notificações por email (Resend) — disparadas via Vercel Cron diariamente.
# --------------------------------------------------------------------------- #
def resend_api_key() -> str:
    return os.environ.get("RESEND_API_KEY", "")


def cron_secret() -> str:
    """Segredo compartilhado entre o cron do Vercel e o endpoint de disparo.
    Sem ele configurado, o endpoint recusa tudo (não envia em desenvolvimento)."""
    return os.environ.get("CRON_SECRET", "")


def notificacoes_destino() -> str:
    return os.environ.get("NOTIFICACOES_EMAIL_DESTINO", "")


def notificacoes_remetente() -> str:
    """Quando vazio, cai no padrão de teste do Resend (não exige domínio
    verificado, mas vai pra Spam fácil)."""
    return os.environ.get("NOTIFICACOES_EMAIL_REMETENTE", "TabLM <onboarding@resend.dev>")


# --------------------------------------------------------------------------- #
# CV CRM (Ribeira) — auth v3 (JWT) via email+senha do usuário técnico.
# --------------------------------------------------------------------------- #
def cvcrm_base_url() -> str:
    return os.environ.get("CVCRM_BASE_URL", "")


def cvcrm_email() -> str:
    return os.environ.get("CVCRM_EMAIL", "")


def cvcrm_senha() -> str:
    """Senha do usuário técnico. NUNCA logar/expor.
    Usada só pra chamar POST /v3/auth/token → recebe JWT (6h de validade).
    """
    return os.environ.get("CVCRM_SENHA", "")
