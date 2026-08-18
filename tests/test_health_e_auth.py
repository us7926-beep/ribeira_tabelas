"""Health check, login/JWT, /me e heartbeat pra o Supabase."""


from tests.conftest import SENHA, cliente, get_token  # noqa: F401

def test_health_responde_ok(cliente):
    resposta = cliente.get("/health")
    assert resposta.status_code == 200
    assert resposta.json()["status"] == "ok"


def test_login_invalido_retorna_401(cliente):
    assert cliente.post("/auth/login", json={"usuario": "teste", "senha": "errada"}).status_code == 401


def test_login_valido_emite_token_e_me(cliente):
    resposta = cliente.post("/auth/login", json={"usuario": "teste", "senha": SENHA})
    assert resposta.status_code == 200
    token = resposta.json()["token"]
    assert cliente.get("/me").status_code == 401  # sem token
    me = cliente.get("/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["usuario"] == "teste"


def test_endpoint_de_dados_sem_supabase_retorna_503(cliente):
    jwt = get_token(cliente)
    resposta = cliente.get("/incorporadoras", headers={"Authorization": f"Bearer {jwt}"})
    assert resposta.status_code == 503


# --------------------------------------------------------------------------- #
def test_heartbeat_ok_quando_supabase_responde(cliente, monkeypatch):
    """Bate SELECT count e devolve ok=true + contagem."""
    from api import db

    class FakeResp:
        count = 3

    class FakeQuery:
        def select(self, *_a, **_k): return self
        def limit(self, _n): return self
        def execute(self): return FakeResp()

    class FakeClient:
        def table(self, _t): return FakeQuery()

    monkeypatch.setattr(db, "cliente", lambda: FakeClient())
    r = cliente.get("/health/heartbeat")
    assert r.status_code == 200
    d = r.json()
    assert d["ok"] is True
    assert d["supabase"] is True
    assert d["incorporadoras"] == 3
    assert isinstance(d["tempo_ms"], int)


def test_heartbeat_devolve_erro_estruturado_quando_supabase_falha(cliente, monkeypatch):
    """Se supabase quebra, devolve 200 com ok=false + erro (não crasha o cron)."""
    from api import db

    def falha():
        raise RuntimeError("Supabase paused")

    monkeypatch.setattr(db, "cliente", falha)
    r = cliente.get("/health/heartbeat")
    assert r.status_code == 200
    d = r.json()
    assert d["ok"] is False
    assert d["supabase"] is False
    assert "Supabase paused" in d["erro"]


def test_heartbeat_e_publico_sem_auth(cliente):
    """Cron precisa chamar sem JWT — Vercel Cron não manda Authorization."""
    r = cliente.get("/health/heartbeat")
    # Sem auth funciona (200 mesmo com erro do supabase, pra não crashar cron).
    assert r.status_code == 200
