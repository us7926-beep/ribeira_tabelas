"""Testes da extração de ficha técnica via Gemini (sem chamadas reais à API)."""
from google.genai import errors

from src import extracao


def _erro_servidor():
    """Constrói um ServerError mínimo do SDK para simular 503."""
    return errors.ServerError(503, {"error": {"message": "high demand"}})


# --- configuração ----------------------------------------------------------- #
def test_deve_retornar_false_quando_sem_chave(mocker):
    mocker.patch.object(extracao.st, "secrets", {})
    assert extracao.ia_configurada() is False


def test_deve_retornar_true_quando_ha_chave_gemini(mocker):
    mocker.patch.object(extracao.st, "secrets", {"gemini": {"api_key": "AIza-x"}})
    assert extracao.ia_configurada() is True


def test_deve_ter_todos_os_campos_em_branco_quando_ficha_vazia():
    ficha = extracao.ficha_vazia()
    assert set(ficha) == set(extracao.CAMPOS_FICHA)
    assert all(valor == "" for valor in ficha.values())


def test_deve_mapear_mime_por_extensao():
    assert extracao._mime("book.PDF") == "application/pdf"
    assert extracao._mime("flyer.png") == "image/png"
    assert extracao._mime("foto.jpg") == "image/jpeg"


# --- extração --------------------------------------------------------------- #
def test_deve_parsear_json_e_completar_campos_quando_extrai(mocker):
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


def test_deve_juntar_lista_com_ponto_e_virgula_quando_campo_e_lista(mocker):
    extracao.extrair_ficha.clear()
    mocker.patch.object(extracao.st, "secrets", {"gemini": {"api_key": "AIza-x"}})

    resposta = mocker.MagicMock(text='{"tipologias": ["2 dorm 49 m²", "2 dorm 50 m²"]}')
    cliente = mocker.MagicMock()
    cliente.models.generate_content.return_value = resposta
    mocker.patch("google.genai.Client", return_value=cliente)

    ficha = extracao.extrair_ficha(b"%PDF w", "book.pdf")
    assert ficha["tipologias"] == "2 dorm 49 m²; 2 dorm 50 m²"


def test_deve_usar_modelo_override_quando_configurado(mocker):
    extracao.extrair_ficha.clear()
    mocker.patch.object(extracao.st, "secrets",
                        {"gemini": {"api_key": "AIza-x", "model": "gemini-flash-latest"}})
    resposta = mocker.MagicMock(text='{"nome_empreendimento": "X"}')
    cliente = mocker.MagicMock()
    cliente.models.generate_content.return_value = resposta
    mocker.patch("google.genai.Client", return_value=cliente)

    extracao.extrair_ficha(b"%PDF x", "book.pdf")
    assert cliente.models.generate_content.call_args.kwargs["model"] == "gemini-flash-latest"


def test_deve_retentar_quando_erro_503_e_depois_suceder(mocker):
    extracao.extrair_ficha.clear()
    mocker.patch.object(extracao.st, "secrets", {"gemini": {"api_key": "AIza-x"}})
    mocker.patch.object(extracao.time, "sleep")  # não espera de verdade

    resposta_ok = mocker.MagicMock(text='{"nome_empreendimento": "Resiliente"}')
    cliente = mocker.MagicMock()
    cliente.models.generate_content.side_effect = [_erro_servidor(), resposta_ok]
    mocker.patch("google.genai.Client", return_value=cliente)

    ficha = extracao.extrair_ficha(b"%PDF y", "book.pdf")
    assert ficha["nome_empreendimento"] == "Resiliente"
    assert cliente.models.generate_content.call_count == 2


def test_deve_levantar_erro_quando_503_persistente(mocker):
    extracao.extrair_ficha.clear()
    mocker.patch.object(extracao.st, "secrets", {"gemini": {"api_key": "AIza-x"}})
    mocker.patch.object(extracao.time, "sleep")

    cliente = mocker.MagicMock()
    cliente.models.generate_content.side_effect = _erro_servidor()
    mocker.patch("google.genai.Client", return_value=cliente)

    try:
        extracao.extrair_ficha(b"%PDF z", "book.pdf")
        assert False, "deveria ter levantado RuntimeError"
    except RuntimeError as exc:
        assert "indispon" in str(exc).lower()
    assert cliente.models.generate_content.call_count == 3
