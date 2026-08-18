"""PATCH/DELETE /benchmark/eventos/{id} — admin de promoções (PR #42)."""


from tests.conftest import auth_headers, cliente, get_token  # noqa: F401

# --------------------------------------------------------------------------- #
# PATCH/DELETE /benchmark/eventos/{id} (admin de promocoes, PR #42)
# --------------------------------------------------------------------------- #
def auth_headers(cliente):
    return {"Authorization": f"Bearer {get_token(cliente)}"}


def test_patch_evento_body_vazio_retorna_400(cliente):
    """Validacao acontece antes de tocar o db — funciona sem Supabase."""
    r = cliente.patch("/benchmark/eventos/abc", headers=auth_headers(cliente), json={})
    assert r.status_code == 400


def test_patch_evento_sem_supabase_retorna_503(cliente):
    """Com body valido, cai no db.obter -> 503 sem SUPABASE_URL."""
    r = cliente.patch(
        "/benchmark/eventos/abc", headers=auth_headers(cliente), json={"descricao": "x"}
    )
    assert r.status_code == 503


def test_delete_evento_sem_supabase_retorna_503(cliente):
    r = cliente.delete("/benchmark/eventos/abc", headers=auth_headers(cliente))
    assert r.status_code == 503


def test_patch_evento_404_quando_id_inexistente(cliente, monkeypatch):
    from api import db

    monkeypatch.setattr(db, "obter", lambda _tabela, _id: None)
    r = cliente.patch(
        "/benchmark/eventos/zzz", headers=auth_headers(cliente), json={"descricao": "x"}
    )
    assert r.status_code == 404


def test_patch_evento_atualiza_quando_existe(cliente, monkeypatch):
    from api import db

    chamadas: list[tuple] = []
    monkeypatch.setattr(db, "obter", lambda tabela, id_: {"id": id_, "descricao": "antigo"})
    monkeypatch.setattr(
        db,
        "atualizar",
        lambda tabela, id_, campos: chamadas.append((tabela, id_, campos))
        or {"id": id_, **campos},
    )
    r = cliente.patch(
        "/benchmark/eventos/abc",
        headers=auth_headers(cliente),
        json={"descricao": "novo", "data_fim": "2026-12-31"},
    )
    assert r.status_code == 200
    corpo = r.json()
    assert corpo["descricao"] == "novo"
    assert corpo["data_fim"] == "2026-12-31"
    assert chamadas == [
        ("eventos_promocionais", "abc", {"descricao": "novo", "data_fim": "2026-12-31"})
    ]


def test_patch_evento_exclude_none_descarta_campos_omitidos(cliente, monkeypatch):
    """Campos nao enviados nao podem aparecer no UPDATE — protege contra
    wipe acidental (ex: nao enviei data_inicio, nao quero perder o valor)."""
    from api import db

    capturado: dict = {}

    def fake_update(_tabela, _id, campos):
        capturado.update(campos)
        return {"id": _id, **campos}

    monkeypatch.setattr(db, "obter", lambda _t, _i: {"id": "abc"})
    monkeypatch.setattr(db, "atualizar", fake_update)
    r = cliente.patch(
        "/benchmark/eventos/abc",
        headers=auth_headers(cliente),
        json={"descricao": "so a descricao muda"},
    )
    assert r.status_code == 200
    assert capturado == {"descricao": "so a descricao muda"}


def test_delete_evento_404_quando_id_inexistente(cliente, monkeypatch):
    from api import db

    monkeypatch.setattr(db, "obter", lambda _t, _i: None)
    r = cliente.delete("/benchmark/eventos/zzz", headers=auth_headers(cliente))
    assert r.status_code == 404


def test_delete_evento_remove_quando_existe(cliente, monkeypatch):
    from api import db

    deletados: list[tuple] = []
    monkeypatch.setattr(db, "obter", lambda _t, id_: {"id": id_})
    monkeypatch.setattr(
        db, "deletar", lambda tabela, id_: deletados.append((tabela, id_))
    )
    r = cliente.delete("/benchmark/eventos/abc", headers=auth_headers(cliente))
    assert r.status_code == 200
    assert r.json() == {"ok": True}
    assert deletados == [("eventos_promocionais", "abc")]
