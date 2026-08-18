"""POST /books/extrair (dry-run pra fila de análise em lote, PR #91)."""


from tests.conftest import auth_headers, cliente  # noqa: F401

# --------------------------------------------------------------------------- #
# POST /books/extrair — dry-run pra fila de análise em lote
# --------------------------------------------------------------------------- #
def test_books_extrair_devolve_ficha_e_tabela(cliente, monkeypatch):
    """Fluxo feliz: Gemini extrai ficha + tabela, endpoint devolve ambos."""
    from api import gemini

    monkeypatch.setattr(gemini, "extrair_ficha_dossie", lambda _b, _n: {"nome": "Alegria", "cidade": "Mogi"})
    monkeypatch.setattr(
        gemini, "extrair_tabela_precos",
        lambda _b, _n: {
            "nome_empreendimento": "Alegria",
            "incorporadora": "Ribeira",
            "unidades": [{"unidade": "101", "area_m2": 50, "preco_total": 500000}],
            "promocoes": [],
            "padrao": "Alto",
            "cidade": "Mogi",
            "bairro": "",
            "total_unidades": 1,
        },
    )
    r = cliente.post(
        "/books/extrair",
        headers=auth_headers(cliente),
        files={"arquivo": ("book.pdf", b"%PDF-1.4 fake", "application/pdf")},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["arquivo_nome"] == "book.pdf"
    assert body["ficha"]["nome"] == "Alegria"
    assert body["tabela"]["nome_empreendimento"] == "Alegria"
    assert body["tabela"]["unidades"][0]["unidade"] == "101"
    assert body["erros"] == {}


def test_books_extrair_tolera_falha_de_tabela(cliente, monkeypatch):
    """Ficha OK + tabela falha: retorna 200 com ficha + erros.tabela."""
    from api import gemini

    monkeypatch.setattr(gemini, "extrair_ficha_dossie", lambda _b, _n: {"nome": "X"})

    def fake_tabela(_b, _n):
        raise RuntimeError("Gemini timeout")

    monkeypatch.setattr(gemini, "extrair_tabela_precos", fake_tabela)
    r = cliente.post(
        "/books/extrair",
        headers=auth_headers(cliente),
        files={"arquivo": ("book.pdf", b"%PDF-1.4", "application/pdf")},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["ficha"]["nome"] == "X"
    assert body["erros"]["tabela"] == "Gemini timeout"


def test_books_extrair_502_quando_ambos_falham(cliente, monkeypatch):
    """Ficha E tabela falham: 502."""
    from api import gemini

    def _falha(_b, _n):
        raise RuntimeError("boom")

    monkeypatch.setattr(gemini, "extrair_ficha_dossie", _falha)
    monkeypatch.setattr(gemini, "extrair_tabela_precos", _falha)
    r = cliente.post(
        "/books/extrair",
        headers=auth_headers(cliente),
        files={"arquivo": ("book.pdf", b"%PDF-1.4", "application/pdf")},
    )
    assert r.status_code == 502
    assert "boom" in r.json()["detail"]


def test_books_extrair_413_quando_arquivo_excede_25mb(cliente, monkeypatch):
    """Guarda de tamanho é comum a todos os uploads — herda de _ler_upload."""
    conteudo = b"x" * (26 * 1024 * 1024)  # 26 MB
    r = cliente.post(
        "/books/extrair",
        headers=auth_headers(cliente),
        files={"arquivo": ("book.pdf", conteudo, "application/pdf")},
    )
    assert r.status_code == 413
