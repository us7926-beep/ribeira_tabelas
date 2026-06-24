"""Autenticação: verifica senha (SHA-256) e emite/valida JWT (PyJWT)."""
import hashlib
import time

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from . import config

_bearer = HTTPBearer(auto_error=False)


def hash_senha(senha: str) -> str:
    return hashlib.sha256(senha.encode()).hexdigest()


def credenciais_validas(usuario: str, senha: str) -> bool:
    esperado = config.users().get(usuario)
    return bool(esperado) and hash_senha(senha) == esperado


def criar_token(usuario: str) -> str:
    agora = int(time.time())
    payload = {"sub": usuario, "iat": agora, "exp": agora + config.jwt_expire_hours() * 3600}
    return jwt.encode(payload, config.jwt_secret(), algorithm="HS256")


def usuario_autenticado(
    credencial: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> str:
    """Dependência FastAPI: exige um Bearer JWT válido; devolve o usuário."""
    if credencial is None:
        raise HTTPException(status_code=401, detail="Token ausente")
    try:
        payload = jwt.decode(credencial.credentials, config.jwt_secret(), algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token inválido ou expirado")
    return payload["sub"]
