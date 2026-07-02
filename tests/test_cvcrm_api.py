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


def test_deve_levantar_erro_amigavel_quando_auth_retorna_400(mocker, monkeypatch):
    """Produção responde 400 'Usuário ou senha inválidos' (não 401)."""
    _envs(monkeypatch)
    from api import cvcrm_api
    cvcrm_api.invalidar_cache_jwt()

    mocker.patch(
        "api.cvcrm_api.requests.post", return_value=_resposta(mocker, status=400)
    )

    with pytest.raises(RuntimeError, match="CVCRM_EMAIL/CVCRM_SENHA"):
        cvcrm_api.listar_tabelas_preco_empreendimento("42")


def test_deve_extrair_jwt_quando_auth_vem_envelopado_com_timestamp(mocker, monkeypatch):
    """Formato real da produção: {status, code, data: {access_token,
    expires_in: '<unix timestamp em string>'}}."""
    _envs(monkeypatch)
    from api import cvcrm_api
    cvcrm_api.invalidar_cache_jwt()

    import time
    futuro = int(time.time()) + 21600
    mocker.patch(
        "api.cvcrm_api.requests.post",
        return_value=_resposta(mocker, dados={
            "status": "success",
            "code": 200,
            "data": {
                "access_token": "JWT-ENVELOPADO",
                "token_type": "Bearer",
                "expires_in": str(futuro),
            },
        }),
    )
    patch_get = mocker.patch(
        "api.cvcrm_api.requests.get", return_value=_resposta(mocker, dados=[])
    )

    cvcrm_api.listar_tabelas_preco_empreendimento("2")

    headers = patch_get.call_args.kwargs["headers"]
    assert headers["Authorization"] == "Bearer JWT-ENVELOPADO"
    # O timestamp absoluto foi respeitado — cache expira no futuro certo.
    assert abs(cvcrm_api._cache_jwt["expira_em"] - futuro) < 2


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


def _pagina(mocker, unidades, total_paginas=1):
    return _resposta(mocker, dados={
        "data": unidades,
        "pagination": {"totalPaginas": total_paginas},
    })


def test_deve_contar_situacao_e_calcular_vso_quando_uma_pagina(mocker, monkeypatch):
    """Espelha o TOTAL BRAZ CUBAS real: 193 vendidas / 6 disp / 1 bloq → VSO 96.5%."""
    _envs(monkeypatch)
    from api import cvcrm_api
    cvcrm_api.invalidar_cache_jwt()

    unidades = (
        [{"situacao": 3, "ativoPainel": True}] * 193
        + [{"situacao": 1, "ativoPainel": True}] * 6
        + [{"situacao": 4, "ativoPainel": True}] * 1
    )
    mocker.patch(
        "api.cvcrm_api.requests.post", return_value=_resposta_jwt(mocker, token="J")
    )
    mocker.patch(
        "api.cvcrm_api.requests.get", return_value=_pagina(mocker, unidades)
    )

    r = cvcrm_api.contar_situacao_unidades(2)
    assert r["total_unidades"] == 200
    assert r["vendidas"] == 193
    assert r["disponiveis"] == 6
    assert r["bloqueadas"] == 1
    assert r["vso"] == 96.5


def test_deve_ignorar_unidades_inativas_quando_conta_situacao(mocker, monkeypatch):
    _envs(monkeypatch)
    from api import cvcrm_api
    cvcrm_api.invalidar_cache_jwt()

    unidades = [
        {"situacao": 3, "ativoPainel": True},
        {"situacao": 3, "ativoPainel": False},   # não conta
        {"situacao": 1, "ativoPainel": True},
    ]
    mocker.patch(
        "api.cvcrm_api.requests.post", return_value=_resposta_jwt(mocker, token="J")
    )
    mocker.patch(
        "api.cvcrm_api.requests.get", return_value=_pagina(mocker, unidades)
    )

    r = cvcrm_api.contar_situacao_unidades(2)
    assert r["total_unidades"] == 2
    assert r["vendidas"] == 1
    assert r["vso"] == 50.0


def test_deve_paginar_ate_o_fim_quando_multiplas_paginas(mocker, monkeypatch):
    _envs(monkeypatch)
    from api import cvcrm_api
    cvcrm_api.invalidar_cache_jwt()

    pag1 = _pagina(mocker, [{"situacao": 3, "ativoPainel": True}] * 2, total_paginas=2)
    pag2 = _pagina(mocker, [{"situacao": 1, "ativoPainel": True}] * 3, total_paginas=2)
    mocker.patch(
        "api.cvcrm_api.requests.post", return_value=_resposta_jwt(mocker, token="J")
    )
    mocker.patch("api.cvcrm_api.requests.get", side_effect=[pag1, pag2])

    r = cvcrm_api.contar_situacao_unidades(2)
    assert r["total_unidades"] == 5
    assert r["vendidas"] == 2
    assert r["disponiveis"] == 3
    assert r["vso"] == 40.0


def test_deve_retornar_vso_zero_quando_sem_unidades(mocker, monkeypatch):
    _envs(monkeypatch)
    from api import cvcrm_api
    cvcrm_api.invalidar_cache_jwt()

    mocker.patch(
        "api.cvcrm_api.requests.post", return_value=_resposta_jwt(mocker, token="J")
    )
    mocker.patch("api.cvcrm_api.requests.get", return_value=_pagina(mocker, []))

    r = cvcrm_api.contar_situacao_unidades(2)
    assert r["total_unidades"] == 0
    assert r["vso"] == 0.0
