"""PATCH /incorporadoras/{id} — renomear (PR #63)."""


from tests.conftest import auth_headers, cliente  # noqa: F401

# --------------------------------------------------------------------------- #
# PATCH /incorporadoras/{id} (renomear, PR feature/editar-incorporadora-card)
# --------------------------------------------------------------------------- #
def test_patch_incorporadora_body_vazio_retorna_400(cliente):
    r = cliente.patch("/incorporadoras/abc", headers=auth_headers(cliente), json={})
    assert r.status_code == 400


def test_patch_incorporadora_nome_vazio_retorna_400(cliente):
    """Sem nome efetivo (so espacos), tambem rejeita — evita gravar lixo."""
    r = cliente.patch(
        "/incorporadoras/abc", headers=auth_headers(cliente), json={"nome": "   "}
    )
    assert r.status_code == 400


def test_patch_incorporadora_404_quando_id_inexistente(cliente, monkeypatch):
    from api import db

    monkeypatch.setattr(db, "obter", lambda _t, _i: None)
    r = cliente.patch(
        "/incorporadoras/zzz", headers=auth_headers(cliente), json={"nome": "Novo"}
    )
    assert r.status_code == 404


def test_patch_incorporadora_renomeia_quando_existe(cliente, monkeypatch):
    from api import db

    chamadas: list[tuple] = []
    monkeypatch.setattr(
        db, "obter", lambda _t, id_: {"id": id_, "nome": "Antigo"}
    )
    monkeypatch.setattr(
        db,
        "atualizar",
        lambda tabela, id_, campos: chamadas.append((tabela, id_, campos))
        or {"id": id_, **campos},
    )
    r = cliente.patch(
        "/incorporadoras/abc", headers=auth_headers(cliente), json={"nome": "Novo Nome"}
    )
    assert r.status_code == 200
    assert r.json()["nome"] == "Novo Nome"
    assert chamadas == [("incorporadoras", "abc", {"nome": "Novo Nome"})]
