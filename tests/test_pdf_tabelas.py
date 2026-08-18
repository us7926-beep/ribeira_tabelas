"""pdf_tabelas: _num_br, _colunas_por_palavra_chave, _tem_header_valido, mesclar_com_gemini (PR #93)."""


from tests.conftest import cliente  # noqa: F401

# --------------------------------------------------------------------------- #
# pdf_tabelas — extração híbrida com pdfplumber (PR feature/pdfplumber-hibrido)
# --------------------------------------------------------------------------- #
def test_pdf_tabelas_num_br_lida_com_reais_brasileiros():
    from api.pdf_tabelas import _num_br

    assert _num_br("R$ 357.934,53") == 357934.53
    assert _num_br("40,900 m²") == 40.9
    assert _num_br("R$\n1.234,56") == 1234.56  # com quebra de linha do pdfplumber
    assert _num_br("1000") == 1000.0
    assert _num_br("47.44") == 47.44  # US style
    assert _num_br(None) is None
    assert _num_br("—") is None
    assert _num_br("") is None


def test_pdf_tabelas_colunas_por_palavra_chave():
    from api.pdf_tabelas import _colunas_por_palavra_chave

    # Formato CV CRM: UNIDADE / ÁREA / SITUAÇÃO / VALOR / ATO / SINAIS... / FINANCIAMENTO
    header = ["UNIDADE", "ÁREA PRIVATIVA", "SITUAÇÃO", "VALOR TOTAL",
              "ATO (1x)", "SINAL 30d", "FINANCIAMENTO"]
    mapa = _colunas_por_palavra_chave(header)
    assert mapa["unidade"] == 0
    assert mapa["area_m2"] == 1
    assert mapa["preco_total"] == 3
    assert mapa["entrada"] == 4
    assert mapa["financiamento"] == 6


def test_pdf_tabelas_tem_header_valido():
    from api.pdf_tabelas import _tem_header_valido

    assert _tem_header_valido(["UNIDADE", "ÁREA", "VALOR"])
    assert _tem_header_valido(["Apto", "Metragem", "Preço"])
    # Metadata (não é header): nome da tabela, logo
    assert not _tem_header_valido(["MÁXIMO BRAZ CUBAS", None, None, "Tabela: 07.2026"])
    # Linha de dados (não é header)
    assert not _tem_header_valido(["18-A", "33,03 m²", "Disponível"])
    assert not _tem_header_valido([])


def test_mesclar_com_gemini_substitui_so_area_e_preco():
    """Merge não sobrescreve entrada/parcelas/financiamento porque
    semântica desses campos depende de contexto (Gemini decide)."""
    from api.pdf_tabelas import mesclar_com_gemini

    gemini_out = [
        {
            "unidade": "5-A",
            "area_m2": 45.0,  # arredondamento do Gemini
            "preco_total": 396800,  # também arredondado
            "entrada": 23810.24,  # soma de ATO + SINAIS (interpretação do Gemini)
            "parcelas_mensais": 1825.45,
            "financiamento": 297429.4,
        },
    ]
    pdf_out = [
        {
            "unidade": "5-A",
            "area_m2": 45.05,  # valor exato do PDF
            "preco_total": 396837.10,  # valor exato do PDF
            "entrada": 5952.56,  # só o ATO (semântica errada)
            "parcelas_mensais": 1825.45,
            "financiamento": 297429.4,
        },
    ]
    mesclado = mesclar_com_gemini(gemini_out, pdf_out)
    assert len(mesclado) == 1
    u = mesclado[0]
    # area e preço vêm do PDF (mais precisos)
    assert u["area_m2"] == 45.05
    assert u["preco_total"] == 396837.10
    # entrada mantém interpretação do Gemini
    assert u["entrada"] == 23810.24


def test_mesclar_com_gemini_vazio_devolve_gemini():
    from api.pdf_tabelas import mesclar_com_gemini

    gem = [{"unidade": "1", "preco_total": 100}]
    assert mesclar_com_gemini(gem, []) == gem
    assert mesclar_com_gemini([], [{"unidade": "1"}]) == []


def test_mesclar_com_gemini_ignora_unidades_pdf_orfas():
    """Unidade que só aparece no pdfplumber (não no Gemini) fica de
    fora — protege contra pdfplumber pegar tabela irrelevante."""
    from api.pdf_tabelas import mesclar_com_gemini

    gem = [{"unidade": "1", "preco_total": 100}]
    pdf = [{"unidade": "1", "preco_total": 200}, {"unidade": "999", "preco_total": 999}]
    mesclado = mesclar_com_gemini(gem, pdf)
    assert len(mesclado) == 1  # não veio a "999"
    assert mesclado[0]["preco_total"] == 200


def test_extrair_tabela_precos_desativa_hibrido():
    """hibrido=False bloqueia pdfplumber (útil pra testes ou imagens)."""
    from unittest.mock import patch
    from api import gemini

    with patch("api.gemini._gerar", return_value={
        "nome_empreendimento": "X",
        "unidades": [{"unidade": "1", "area_m2": 50, "preco_total": 500000}],
    }):
        with patch("api.pdf_tabelas.extrair_tabelas_pdf") as mock_pdf:
            r = gemini.extrair_tabela_precos(b"pdf", "book.pdf", hibrido=False)
    mock_pdf.assert_not_called()
    assert r["unidades"][0]["preco_total"] == 500000
