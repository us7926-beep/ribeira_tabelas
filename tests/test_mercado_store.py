"""Testes da camada de persistência da base de mercado (fallback sem Sheets)."""
import pandas as pd

from src import mercado_store


def test_deve_indicar_nao_configurado_quando_secrets_sem_gsheets(mocker):
    mocker.patch.object(mercado_store.st, "secrets", {})
    assert mercado_store.sheets_configurado() is False


def test_deve_indicar_configurado_quando_secrets_tem_service_account(mocker):
    mocker.patch.object(
        mercado_store.st,
        "secrets",
        {"gsheets": {"spreadsheet_id": "x", "service_account": {"client_email": "a@b"}}},
    )
    assert mercado_store.sheets_configurado() is True


def test_deve_usar_sessao_quando_sheets_nao_configurado(mocker):
    mocker.patch.object(mercado_store.st, "secrets", {})
    sessao: dict = {}
    mocker.patch.object(mercado_store.st, "session_state", sessao)

    base = mercado_store.obter_base()
    assert isinstance(base, pd.DataFrame)
    assert base.empty

    nova = pd.DataFrame({"valor": [1]})
    mercado_store.persistir(nova)
    assert sessao[mercado_store._CHAVE_SESSAO] is nova  # gravou só na sessão
