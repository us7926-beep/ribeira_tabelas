"""GET /geocode com Nominatim + cache in-memory (PR #95)."""


from tests.conftest import auth_headers, cliente  # noqa: F401

# --------------------------------------------------------------------------- #
# GET /geocode — Nominatim + cache (PR feature/mapa-geografico)
# --------------------------------------------------------------------------- #
def test_geocode_devolve_lat_lng(cliente, monkeypatch):
    """Fluxo feliz: geocode.geocode retorna resultado, endpoint devolve JSON."""
    from api import geocode

    geocode.limpar_cache()
    monkeypatch.setattr(
        geocode, "geocode",
        lambda b, c: {"lat": -23.52, "lng": -46.19, "formatado": "Vila Mogilar, Mogi das Cruzes"},
    )
    r = cliente.get("/geocode?bairro=Vila+Mogilar&cidade=Mogi+das+Cruzes", headers=auth_headers(cliente))
    assert r.status_code == 200
    d = r.json()
    assert d["lat"] == -23.52
    assert d["lng"] == -46.19
    assert "Vila Mogilar" in d["formatado"]


def test_geocode_400_sem_cidade(cliente):
    r = cliente.get("/geocode?bairro=Centro", headers=auth_headers(cliente))
    assert r.status_code == 400


def test_geocode_404_quando_nominatim_nao_acha(cliente, monkeypatch):
    from api import geocode

    geocode.limpar_cache()
    monkeypatch.setattr(geocode, "geocode", lambda _b, _c: None)
    r = cliente.get("/geocode?cidade=CidadeInexistente", headers=auth_headers(cliente))
    assert r.status_code == 404


def test_geocode_502_quando_nominatim_explode(cliente, monkeypatch):
    from api import geocode

    def _falha(_b, _c):
        raise RuntimeError("timeout")

    geocode.limpar_cache()
    monkeypatch.setattr(geocode, "geocode", _falha)
    r = cliente.get("/geocode?cidade=Mogi", headers=auth_headers(cliente))
    assert r.status_code == 502


def test_geocode_usa_cache(monkeypatch):
    """Segunda chamada com mesma chave não bate no Nominatim."""
    from api import geocode

    geocode.limpar_cache()
    chamadas = []

    def fake_consultar(q):
        chamadas.append(q)
        return {"lat": 1.0, "lng": 2.0, "formatado": q}

    monkeypatch.setattr(geocode, "_consultar_nominatim", fake_consultar)
    r1 = geocode.geocode("Centro", "Mogi")
    r2 = geocode.geocode("Centro", "Mogi")
    assert r1 == r2
    assert len(chamadas) == 1, f"esperado 1 chamada Nominatim, recebi {len(chamadas)}: {chamadas}"


def test_geocode_fallback_para_cidade(monkeypatch):
    """Quando bairro+cidade não bate, tenta só cidade."""
    from api import geocode

    geocode.limpar_cache()

    def fake_consultar(q):
        if "InexistenteBairro" in q:
            return None
        return {"lat": -23.5, "lng": -46.2, "formatado": q}

    monkeypatch.setattr(geocode, "_consultar_nominatim", fake_consultar)
    r = geocode.geocode("InexistenteBairro", "Mogi das Cruzes")
    assert r is not None
    assert "Mogi das Cruzes" in r["formatado"]
