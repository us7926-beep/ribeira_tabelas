"""Testes do api/cvcrm_api.py (integração com o CV CRM, mockada via pytest-mock)."""
import pytest


def _envs(monkeypatch):
    monkeypatch.setenv("CVCRM_BASE_URL", "https://exemplo.cvcrm.com.br/api")
    monkeypatch.setenv("CVCRM_EMAIL", "tec@ribeira.com.br")
    monkeypatch.setenv("CVCRM_TOKEN", "abc123")


def _resposta(mocker, dados=None, status=200):
    resposta = mocker.MagicMock()
    resposta.status_code = status
    resposta.json.return_value = dados if dados is not None else []
    resposta.raise_for_status.return_value = None
    return resposta


def test_deve_retornar_lista_quando_cvcrm_responde_ok(mocker, monkeypatch):
    _envs(monkeypatch)
    from api import cvcrm_api

    mocker.patch(
        "api.cvcrm_api.requests.get",
        return_value=_resposta(mocker, dados=[{"id": 1, "nome": "Tabela A"}]),
    )

    assert cvcrm_api.listar_tabelas_preco() == [{"id": 1, "nome": "Tabela A"}]


def test_deve_levantar_erro_amigavel_quando_cvcrm_retorna_403(mocker, monkeypatch):
    _envs(monkeypatch)
    from api import cvcrm_api

    mocker.patch(
        "api.cvcrm_api.requests.get",
        return_value=_resposta(mocker, status=403),
    )

    with pytest.raises(RuntimeError, match="403"):
        cvcrm_api.listar_tabelas_preco()


def test_deve_levantar_runtime_error_quando_env_ausente(monkeypatch):
    monkeypatch.setenv("CVCRM_BASE_URL", "https://exemplo.cvcrm.com.br/api")
    monkeypatch.delenv("CVCRM_EMAIL", raising=False)
    monkeypatch.delenv("CVCRM_TOKEN", raising=False)
    from api import cvcrm_api

    with pytest.raises(RuntimeError, match="CVCRM_EMAIL"):
        cvcrm_api.listar_tabelas_preco()


def test_deve_extrair_data_quando_resposta_vem_envelopada(mocker, monkeypatch):
    _envs(monkeypatch)
    from api import cvcrm_api

    mocker.patch(
        "api.cvcrm_api.requests.get",
        return_value=_resposta(mocker, dados={"data": [{"id": 7}]}),
    )

    assert cvcrm_api.listar_series_tabela_preco() == [{"id": 7}]
