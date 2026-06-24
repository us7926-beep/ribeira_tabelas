"""Análise de documentos via Google Gemini (nativo do backend, lê env vars).

Independente do Streamlit. Dois usos:
- ``analisar_flyer``: detecção rápida para o fluxo de upload (nome, incorporadora,
  evento/promoção, condições comerciais) — alimenta o modal de confirmação.
- ``extrair_ficha``: ficha técnica completa (mesmos campos da aba Extração).
"""
import json
import time

from . import config

_TENTATIVAS = 3

CAMPOS_FICHA = [
    "nome_empreendimento", "incorporadora", "cidade", "bairro", "padrao",
    "tipologias", "vagas_por_unidade", "vagas_cobertura", "vagas_extra_venda",
    "vagas_visitante", "distancia_estacao", "data_lancamento", "data_entrega",
    "total_unidades", "tipo_projeto", "pavimentos", "elevadores_por_torre",
    "torres", "cnpj_spe", "ri",
]

_PROMPT_FLYER = (
    "Analise este flyer/material promocional imobiliário e responda APENAS um "
    "objeto JSON com as chaves: nome_empreendimento, incorporadora, evento, "
    "data_inicio, data_fim, condicoes_comerciais. 'evento' descreve qualquer "
    "evento ou promoção pontual mencionada (lançamento, plantão, condição "
    "especial); vazio se não houver. Datas em DD/MM/AAAA. Use string vazia "
    "quando o campo não constar (não invente)."
)

_PROMPT_FICHA = (
    "Você é um analista de inteligência de mercado imobiliário. Extraia a ficha "
    "técnica do empreendimento e responda APENAS um objeto JSON com exatamente "
    "estas chaves: " + ", ".join(CAMPOS_FICHA) + ". Datas em DD/MM/AAAA; "
    "distância da estação em metros se < 1 km, senão km com 1 casa decimal; "
    "tipo_projeto = Residencial/Comercial/Misto; string vazia quando faltar."
)


def _mime(nome: str) -> str:
    nome = nome.lower()
    if nome.endswith(".pdf"):
        return "application/pdf"
    if nome.endswith(".png"):
        return "image/png"
    return "image/jpeg"


def _gerar(conteudo: bytes, nome: str, prompt: str) -> dict:
    from google import genai
    from google.genai import errors, types

    if not config.gemini_api_key():
        raise RuntimeError("GEMINI_API_KEY ausente no ambiente.")
    cliente = genai.Client(api_key=config.gemini_api_key())
    parte = types.Part.from_bytes(data=conteudo, mime_type=_mime(nome))
    cfg = types.GenerateContentConfig(response_mime_type="application/json")

    ultimo: Exception | None = None
    for tentativa in range(_TENTATIVAS):
        try:
            resposta = cliente.models.generate_content(
                model=config.gemini_model(), contents=[parte, prompt], config=cfg
            )
            return json.loads(resposta.text)
        except errors.ServerError as exc:  # 503 transitório do free tier
            ultimo = exc
            time.sleep(2 * (tentativa + 1))
    raise RuntimeError(f"Gemini indisponível após {_TENTATIVAS} tentativas: {ultimo}")


def _texto(valor) -> str:
    if isinstance(valor, list):
        return "; ".join(str(item) for item in valor if str(item).strip())
    return str(valor or "")


def analisar_flyer(conteudo: bytes, nome: str) -> dict:
    """Detecção para o fluxo de upload (nome, incorporadora, evento, condições)."""
    dados = _gerar(conteudo, nome, _PROMPT_FLYER)
    chaves = ["nome_empreendimento", "incorporadora", "evento",
              "data_inicio", "data_fim", "condicoes_comerciais"]
    return {chave: _texto(dados.get(chave)) for chave in chaves}


def extrair_ficha(conteudo: bytes, nome: str) -> dict:
    """Ficha técnica completa (mesmos campos da aba Extração do Streamlit)."""
    dados = _gerar(conteudo, nome, _PROMPT_FICHA)
    return {chave: _texto(dados.get(chave)) for chave in CAMPOS_FICHA}
