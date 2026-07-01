"""Testes do api/cvcrm_api.py (integração CV CRM via JWT v3).

Fluxo real: POST /v3/auth/token {email, senha, painel: "gestor"} →
recebe {access_token, expires_in}. Cache in-process com TTL. Chamadas
subsequentes usam `Authorization: Bearer <access_token>`.
"""
import pytest


def _envs(monkeypatch):
    monkeypatch.setenv("CVCRM_BASE_URL", "https://exemplo.cvcrm.com.br/api")
    monkeypatch.setenv("CVCRM_EMAIL", "tec@ribeira.com.br")
    monkeypatch.setenv("CVCRM_SENHA", "s3nh4-forte")


def _resposta(mocker, dados=None, status=200):
    resposta = mocker.MagicMock()
    resposta.status_code = status
    resposta.json.return_value = dados if dados is not None else {}
    resposta.raise_for_status.return_value = None
    return resposta


def _resposta_jwt(mocker, token="JWT-FAKE", expires_in=21600):
    return _resposta(mocker, dados={
        "access_token": token,
        "token_type": "Bearer",
        "expires_in": expires_in,
    })


def test_deve_gerar_jwt_e_retornar_tabelas_quando_cvcrm_responde_ok(mocker, monkeypatch):
    _envs(monkeypatch)
    from api import cvcrm_api
    cvcrm_api.invalidar_cache_jwt()

    mocker.patch("api.cvcrm_api.requests.post", return_value=_resposta_jwt(mocker, token="JWT-X"))
    mocker.patch(
        "api.cvcrm_api.requests.get",
        return_value=_resposta(mocker, dados=[{"id": 1, "nome": "Tabela A"}]),
    )

    assert cvcrm_api.listar_tabelas_preco_empreendimento("42") == [
        {"id": 1, "nome": "Tabela A"}
    ]


def test_deve_reutilizar_jwt_cacheado_quando_ainda_valido(mocker, monkeypatch):
    _envs(monkeypatch)
    from api import cvcrm_api
    cvcrm_api.invalidar_cache_jwt()

    patch_post = mocker.patch(
        "api.cvcrm_api.requests.post", return_value=_resposta_jwt(mocker, token="JWT-Y")
    )
    mocker.patch(
        "api.cvcrm_api.requests.get", return_value=_resposta(mocker, dados=[])
    )

    cvcrm_api.listar_tabelas_preco_empreendimento("A")
    cvcrm_api.listar_tabelas_preco_empreendimento("B")

    # Só um POST /auth/token — o segundo GET reusou o cache.
    assert patch_post.call_count == 1


def test_deve_montar_authorization_bearer_com_jwt_no_get(mocker, monkeypatch):
    _envs(monkeypatch)
    from api import cvcrm_api
    cvcrm_api.invalidar_cache_jwt()

    mocker.patch(
        "api.cvcrm_api.requests.post", return_value=_resposta_jwt(mocker, token="JWT-Z")
    )
    patch_get = mocker.patch(
        "api.cvcrm_api.requests.get", return_value=_resposta(mocker, dados=[])
    )

    cvcrm_api.listar_tabelas_preco_empreendimento("EMP-99")

    headers = patch_get.call_args.kwargs["headers"]
    assert headers["Authorization"] == "Bearer JWT-Z"
    url = patch_get.call_args.args[0]
    assert url.endswith("/v3/cadastros/empreendimentos/EMP-99/tabelas-preco")


def test_deve_levantar_erro_amigavel_quando_auth_retorna_401(mocker, monkeypatch):
    _envs(monkeypatch)
    from api import cvcrm_api
    cvcrm_api.invalidar_cache_jwt()

    mocker.patch(
        "api.cvcrm_api.requests.post", return_value=_resposta(mocker, status=401)
    )

    with pytest.raises(RuntimeError, match="CVCRM_EMAIL/CVCRM_SENHA"):
        cvcrm_api.listar_tabelas_preco_empreendimento("42")


def test_deve_levantar_runtime_error_quando_senha_ausente(monkeypatch):
    monkeypatch.setenv("CVCRM_BASE_URL", "https://exemplo.cvcrm.com.br/api")
    monkeypatch.setenv("CVCRM_EMAIL", "tec@ribeira.com.br")
    monkeypatch.delenv("CVCRM_SENHA", raising=False)
    from api import cvcrm_api
    cvcrm_api.invalidar_cache_jwt()

    with pytest.raises(RuntimeError, match="CVCRM_EMAIL/CVCRM_SENHA"):
        cvcrm_api.listar_tabelas_preco_empreendimento("42")


def test_deve_levantar_erro_amigavel_quando_get_retorna_403(mocker, monkeypatch):
    _envs(monkeypatch)
    from api import cvcrm_api
    cvcrm_api.invalidar_cache_jwt()

    mocker.patch(
        "api.cvcrm_api.requests.post", return_value=_resposta_jwt(mocker, token="J")
    )
    mocker.patch(
        "api.cvcrm_api.requests.get", return_value=_resposta(mocker, status=403)
    )

    with pytest.raises(RuntimeError, match="403"):
        cvcrm_api.listar_tabelas_preco_empreendimento("42")


def test_deve_extrair_data_quando_resposta_vem_envelopada(mocker, monkeypatch):
    _envs(monkeypatch)
    from api import cvcrm_api
    cvcrm_api.invalidar_cache_jwt()

    mocker.patch(
        "api.cvcrm_api.requests.post", return_value=_resposta_jwt(mocker, token="J")
    )
    mocker.patch(
        "api.cvcrm_api.requests.get",
        return_value=_resposta(mocker, dados={"data": [{"id": 7}]}),
    )

    assert cvcrm_api.listar_tabelas_preco_empreendimento("42") == [{"id": 7}]
