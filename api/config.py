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
    return os.environ.get("JWT_SECRET", "dev-inseguro-troque-no-deploy")


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
