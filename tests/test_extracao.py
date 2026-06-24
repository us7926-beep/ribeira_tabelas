"""Testes da extração de ficha técnica via IA (sem chamadas reais à API)."""
from src import extracao


# --- seleção de provedor ---------------------------------------------------- #
def test_deve_priorizar_gemini_quando_ambas_as_chaves(mocker):
    mocker.patch.object(extracao.st, "secrets",
                        {"gemini": {"api_key": "g"}, "anthropic": {"api_key": "a"}})
    assert extracao.provedor_ia() == "gemini"


def test_deve_usar_anthropic_quando_so_chave_anthropic(mocker):
    mocker.patch.object(extracao.st, "secrets", {"anthropic": {"api_key": "a"}})
    assert extracao.provedor_ia() == "anthropic"


def test_deve_retornar_none_quando_sem_chaves(mocker):
    mocker.patch.object(extracao.st, "secrets", {})
    assert extracao.provedor_ia() is None
    assert extracao.ia_configurada() is False


# --- utilidades ------------------------------------------------------------- #
def test_deve_ter_todos_os_campos_em_branco_quando_ficha_vazia():
    ficha = extracao.ficha_vazia()
    assert set(ficha) == set(extracao.CAMPOS_FICHA)
    assert all(valor == "" for valor in ficha.values())


def test_deve_mapear_mime_por_extensao():
    assert extracao._mime("book.PDF") == "application/pdf"
    assert extracao._mime("flyer.png") == "image/png"
    assert extracao._mime("foto.jpg") == "image/jpeg"


# --- extração via Gemini ---------------------------------------------------- #
def test_deve_extrair_via_gemini_quando_chave_gemini(mocker):
    extracao.extrair_ficha.clear()
    mocker.patch.object(extracao.st, "secrets", {"gemini": {"api_key": "AIza-x"}})

    resposta = mocker.MagicMock(text='{"nome_empreendimento": "Torre Sul", "cidade": "Curitiba"}')
    cliente = mocker.MagicMock()
    cliente.models.generate_content.return_value = resposta
    mocker.patch("google.genai.Client", return_value=cliente)

    ficha = extracao.extrair_ficha(b"%PDF-1.4 conteudo", "book.pdf")

    assert ficha["nome_empreendimento"] == "Torre Sul"
    assert ficha["cidade"] == "Curitiba"
    assert ficha["torres"] == ""  # campo ausente vira string vazia
    assert set(ficha) == set(extracao.CAMPOS_FICHA)
    assert cliente.models.generate_content.call_args.kwargs["model"] == "gemini-2.5-flash"


# --- extração via Claude ---------------------------------------------------- #
def test_deve_extrair_via_claude_quando_so_chave_anthropic(mocker):
    extracao.extrair_ficha.clear()
    mocker.patch.object(extracao.st, "secrets", {"anthropic": {"api_key": "sk-x"}})

    bloco = mocker.MagicMock(type="text",
                             text='{"nome_empreendimento": "Edifício X", "incorporadora": "Ribeira"}')
    resposta = mocker.MagicMock(content=[bloco])
    cliente = mocker.MagicMock()
    cliente.messages.create.return_value = resposta
    mocker.patch("anthropic.Anthropic", return_value=cliente)

    ficha = extracao.extrair_ficha(b"%PDF-1.4 outro", "book.pdf")

    assert ficha["nome_empreendimento"] == "Edifício X"
    assert ficha["incorporadora"] == "Ribeira"
    assert ficha["torres"] == ""
    assert cliente.messages.create.call_args.kwargs["model"] == "claude-opus-4-8"
