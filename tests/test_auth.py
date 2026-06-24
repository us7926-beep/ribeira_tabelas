"""Testes da autenticação: credenciais e integridade do token do cookie.

A camada de cookie em si (componente) precisa de navegador e não é testada
aqui; testamos a lógica pura de assinatura/validação, que é o que protege o app.
"""
import hashlib
import time

import pytest

from src import auth


@pytest.fixture
def secrets_leonardo(mocker):
    """Simula st.secrets com um único usuário 'leonardo' (senha 'segredo')."""
    senha_hash = hashlib.sha256("segredo".encode()).hexdigest()
    secrets = {"auth": {"usuarios": {"leonardo": senha_hash}}}
    mocker.patch("src.auth.st.secrets", secrets)
    return secrets


# --- credenciais ------------------------------------------------------------ #
def test_deve_validar_credenciais_quando_hash_confere(secrets_leonardo):
    assert auth._credenciais_validas("leonardo", "segredo") is True


def test_deve_rejeitar_credenciais_quando_senha_errada(secrets_leonardo):
    assert auth._credenciais_validas("leonardo", "errada") is False


def test_deve_rejeitar_credenciais_quando_usuario_inexistente(secrets_leonardo):
    assert auth._credenciais_validas("fulano", "segredo") is False


# --- token do cookie (caminho feliz) ---------------------------------------- #
def test_deve_aceitar_token_recem_gerado_quando_integro(secrets_leonardo):
    token = auth._gerar_token("leonardo")
    assert auth._usuario_do_token(token) == "leonardo"


# --- token: falhas esperadas ------------------------------------------------ #
def test_deve_rejeitar_token_quando_assinatura_adulterada(secrets_leonardo):
    usuario, exp, assinatura = auth._gerar_token("leonardo").split("|")
    adulterado = f"{usuario}|{exp}|{'0' * len(assinatura)}"
    assert auth._usuario_do_token(adulterado) is None


def test_deve_rejeitar_token_quando_usuario_forjado(secrets_leonardo):
    # reaproveitar a assinatura de 'leonardo' para 'ana' não deve funcionar
    _, exp, assinatura = auth._gerar_token("leonardo").split("|")
    forjado = f"ana|{exp}|{assinatura}"
    assert auth._usuario_do_token(forjado) is None


def test_deve_rejeitar_token_quando_expirado(secrets_leonardo):
    expirado = int(time.time()) - 10
    payload = f"leonardo|{expirado}"
    token = f"{payload}|{auth._assinar(payload)}"
    assert auth._usuario_do_token(token) is None


def test_deve_rejeitar_token_quando_usuario_nao_existe_mais_nos_secrets(secrets_leonardo):
    futuro = int(time.time()) + 3600
    payload = f"ana|{futuro}"  # token bem assinado, mas 'ana' não está nos secrets
    token = f"{payload}|{auth._assinar(payload)}"
    assert auth._usuario_do_token(token) is None


@pytest.mark.parametrize("invalido", [None, "", "sem-separadores", "apenas|um"])
def test_deve_rejeitar_token_quando_formato_invalido(secrets_leonardo, invalido):
    assert auth._usuario_do_token(invalido) is None
