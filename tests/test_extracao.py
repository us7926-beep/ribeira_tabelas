"""Testes da extração de ficha técnica via IA (sem chamadas reais à API)."""
from src import extracao


def test_deve_retornar_false_quando_sem_chave_anthropic(mocker):
    mocker.patch.object(extracao.st, "secrets", {})
    assert extracao.ia_configurada() is False


def test_deve_retornar_true_quando_ha_chave_anthropic(mocker):
    mocker.patch.object(extracao.st, "secrets", {"anthropic": {"api_key": "sk-x"}})
    assert extracao.ia_configurada() is True


def test_deve_ter_todos_os_campos_em_branco_quando_ficha_vazia():
    ficha = extracao.ficha_vazia()
    assert set(ficha) == set(extracao.CAMPOS_FICHA)
    assert all(valor == "" for valor in ficha.values())


def test_deve_usar_bloco_document_quando_arquivo_pdf():
    bloco = extracao._bloco_documento(b"%PDF-1.4", "book.PDF")
    assert bloco["type"] == "document"
    assert bloco["source"]["media_type"] == "application/pdf"


def test_deve_usar_bloco_image_quando_arquivo_imagem():
    bloco = extracao._bloco_documento(b"\x89PNG", "flyer.png")
    assert bloco["type"] == "image"
    assert bloco["source"]["media_type"] == "image/png"


def test_deve_parsear_json_e_completar_campos_quando_extrai_ficha(mocker):
    extracao.extrair_ficha.clear()
    mocker.patch.object(extracao.st, "secrets", {"anthropic": {"api_key": "sk-x"}})

    bloco = mocker.MagicMock(type="text",
                             text='{"nome_empreendimento": "Edifício X", "incorporadora": "Ribeira"}')
    resposta = mocker.MagicMock(content=[bloco])
    cliente = mocker.MagicMock()
    cliente.messages.create.return_value = resposta
    mocker.patch("anthropic.Anthropic", return_value=cliente)

    ficha = extracao.extrair_ficha(b"%PDF-1.4 conteudo", "book.pdf")

    assert ficha["nome_empreendimento"] == "Edifício X"
    assert ficha["incorporadora"] == "Ribeira"
    assert ficha["torres"] == ""  # campo ausente vira string vazia
    assert set(ficha) == set(extracao.CAMPOS_FICHA)
    # confirma o modelo usado
    assert cliente.messages.create.call_args.kwargs["model"] == "claude-opus-4-8"
