"""POST/GET /empreendimentos/{id}/diagnostico competitivo (PR #89)."""

from tests.conftest import auth_headers, cliente  # noqa: F401

import json


# --------------------------------------------------------------------------- #
# Diagnóstico competitivo (Gemini) — POST/GET /empreendimentos/{id}/diagnostico
# --------------------------------------------------------------------------- #
def test_diagnostico_404_quando_empreendimento_inexistente(cliente, monkeypatch):
    from api import db

    monkeypatch.setattr(db, "obter", lambda _t, _i: None)
    r = cliente.post("/empreendimentos/zzz/diagnostico", headers=auth_headers(cliente))
    assert r.status_code == 404


def test_diagnostico_400_quando_sem_kpis(cliente, monkeypatch):
    """Sem KPIs (preço/m², ticket, VSO, VGV) a IA não tem o que analisar."""
    from api import db

    monkeypatch.setattr(db, "obter", lambda _t, _i: {"id": "abc", "nome": "X", "cidade": "SP", "padrao": "Alto"})
    monkeypatch.setattr(db, "listar", lambda _t: [])
    r = cliente.post("/empreendimentos/abc/diagnostico", headers=auth_headers(cliente))
    assert r.status_code == 400
    assert "kpi" in r.json()["detail"].lower()


def test_diagnostico_fluxo_feliz_salva_e_retorna(cliente, monkeypatch):
    """Concorrentes filtrados por cidade+padrão; ficha + KPIs + concorrentes
    chegam ao mock do Gemini; parecer é persistido em pareceres_empreendimento."""
    from api import db, gemini

    empreendimento = {
        "id": "meu", "nome": "Alegria", "cidade": "Mogi das Cruzes",
        "padrao": "Alto", "bairro": "Vila Mogilar",
        "preco_m2_medio": 9276, "ticket_medio": 545000, "vso": 100,
        "vgv_total": 3270000, "unidades_vendidas": 11, "total_unidades_calc": 6,
    }
    concorrente_similar = {
        "id": "c1", "nome": "Passeo", "cidade": "Mogi das Cruzes", "padrao": "Alto",
        "bairro": "Centro", "preco_m2_medio": 8500, "vgv_total": 5000000,
    }
    fora_da_cidade = {"id": "c2", "nome": "X", "cidade": "SP", "padrao": "Alto"}
    fora_do_padrao = {"id": "c3", "nome": "Y", "cidade": "Mogi das Cruzes", "padrao": "Medio"}

    monkeypatch.setattr(db, "obter", lambda _t, id_: empreendimento if id_ == "meu" else None)
    monkeypatch.setattr(
        db, "listar",
        lambda _t: [empreendimento, concorrente_similar, fora_da_cidade, fora_do_padrao],
    )

    capturado: dict = {}

    def fake_gemini(ficha, kpis, concorrentes):
        capturado["ficha"] = ficha
        capturado["kpis"] = kpis
        capturado["concorrentes"] = concorrentes
        return {
            "bullets": [
                {"texto": "Preço/m² 9% acima da média Alto de Mogi",
                 "tag": "risco", "kpi_referencia": "preco_m2"},
                {"texto": "VSO em 100% - estoque enxuto",
                 "tag": "forca", "kpi_referencia": "vso"},
            ],
            "resumo_executivo": "Posição premium com estoque esgotado.",
        }

    monkeypatch.setattr(gemini, "gerar_diagnostico_competitivo", fake_gemini)

    def fake_inserir(_tabela, registro):
        return {"id": "novo-parecer", "criado_em": "2026-08-15T12:00:00Z", **registro}

    monkeypatch.setattr(db, "inserir", fake_inserir)

    r = cliente.post("/empreendimentos/meu/diagnostico", headers=auth_headers(cliente))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["id"] == "novo-parecer"
    assert body["empreendimento_id"] == "meu"
    assert body["resumo_executivo"].startswith("Posição premium")
    assert len(body["bullets"]) == 2

    # Concorrentes filtrados: só o que bate cidade+padrão, exclui o próprio
    assert len(capturado["concorrentes"]) == 1
    assert capturado["concorrentes"][0]["nome"] == "Passeo"
    # Ficha só com campos preenchidos
    assert capturado["ficha"]["nome"] == "Alegria"
    assert "tipologias" not in capturado["ficha"]
    # KPIs coletados
    assert capturado["kpis"]["preco_m2_medio"] == 9276
    assert capturado["kpis"]["vso"] == 100


def test_diagnostico_get_vazio_retorna_atual_null(cliente, monkeypatch):
    from api import db

    monkeypatch.setattr(db, "listar_ordenado", lambda *a, **kw: [])
    r = cliente.get("/empreendimentos/abc/diagnostico", headers=auth_headers(cliente))
    assert r.status_code == 200
    assert r.json() == {"atual": None, "historico": []}


def test_diagnostico_get_com_historico(cliente, monkeypatch):
    from api import db

    pareceres = [
        {"id": "p3", "criado_em": "2026-08-15", "resumo_executivo": "atual"},
        {"id": "p2", "criado_em": "2026-08-01", "resumo_executivo": "antigo1"},
        {"id": "p1", "criado_em": "2026-07-01", "resumo_executivo": "antigo2"},
    ]
    monkeypatch.setattr(db, "listar_ordenado", lambda *a, **kw: pareceres)
    r = cliente.get("/empreendimentos/abc/diagnostico", headers=auth_headers(cliente))
    assert r.status_code == 200
    body = r.json()
    assert body["atual"]["id"] == "p3"
    assert [p["id"] for p in body["historico"]] == ["p2", "p1"]


def test_gemini_diagnostico_normaliza_tag_invalida_e_limita_5(monkeypatch):
    """Unit test do gemini.py: garante que tags fora do enum caem em 'neutro'
    e que a lista é truncada em 5 bullets. Mocka via monkeypatch (reversível)."""
    from google import genai

    from api import gemini as gemini_mod

    class _Resp:
        text = json.dumps({
            "resumo_executivo": "ok",
            "bullets": [
                {"texto": "b1", "tag": "forca"},
                {"texto": "b2", "tag": "TAG_ESQUISITA"},
                {"texto": "b3", "tag": "oportunidade", "kpi_referencia": "vso"},
                {"texto": "b4", "tag": "risco"},
                {"texto": "b5", "tag": "fraqueza"},
                {"texto": "b6-excedente", "tag": "neutro"},
                {"texto": "", "tag": "forca"},  # sem texto -> ignorado
            ],
        })

    class _Models:
        def generate_content(self, **_kw):
            return _Resp()

    class _Client:
        def __init__(self, api_key):  # noqa: ARG002
            self.models = _Models()

    monkeypatch.setattr(genai, "Client", _Client)
    monkeypatch.setenv("GEMINI_API_KEY", "fake")

    parecer = gemini_mod.gerar_diagnostico_competitivo(
        {"nome": "X"}, {"vso": 90}, [{"nome": "Concorrente"}]
    )
    assert parecer["resumo_executivo"] == "ok"
    assert len(parecer["bullets"]) == 5  # truncado
    tags = [b["tag"] for b in parecer["bullets"]]
    assert "neutro" in tags
    assert all(b["texto"] for b in parecer["bullets"])
