"""Extração de ficha técnica de empreendimentos via Google Gemini (free tier).

Lê books/flyers/PDFs (texto ou escaneado) e devolve os campos do benchmark em
JSON. Requer ``[gemini] api_key`` nos secrets. Sem chave, ``ia_configurada()``
é False e o app cai no preenchimento manual. O resultado é sempre revisado
pelo usuário antes de salvar (modo híbrido).
"""
import json
import time

import streamlit as st

MODELO_PADRAO = "gemini-2.5-flash"  # multimodal e grátis; override em [gemini].model
_TENTATIVAS = 3  # retries para 503 (free tier sobrecarrega de vez em quando)

# Campos da ficha técnica (rótulo legível -> chave). Strings em quase tudo:
# flyers trazem valores livres ("2 a 4 vagas", "cobertas e descobertas").
CAMPOS_FICHA = {
    "nome_empreendimento": "Empreendimento",
    "incorporadora": "Incorporadora/Construtora",
    "cidade": "Cidade",
    "bairro": "Bairro",
    "padrao": "Padrão (Econômico→Altíssimo)",
    "tipologias": "Tipologias / metragens",
    "vagas_por_unidade": "Vagas por unidade",
    "vagas_cobertura": "Coberto ou descoberto",
    "vagas_extra_venda": "Vagas extra à venda",
    "vagas_visitante": "Vagas de visitante",
    "distancia_estacao": "Distância da estação de trem",
    "data_lancamento": "Data de lançamento",
    "data_entrega": "Data de entrega prevista",
    "total_unidades": "Total de unidades",
    "tipo_projeto": "Residencial / comercial / misto",
    "pavimentos": "Pavimentos",
    "elevadores_por_torre": "Elevadores por torre",
    "torres": "Torres",
    "cnpj_spe": "CNPJ da SPE",
    "ri": "R.I. (Registro de Incorporação)",
}

_INSTRUCAO = (
    "Você é um analista de inteligência de mercado imobiliário. Extraia do "
    "documento (book/flyer/tabela) os campos da ficha técnica do empreendimento. "
    "Regras: use exatamente o texto do material; quando um campo não constar, "
    "deixe string vazia (não invente). Datas no formato DD/MM/AAAA. Distância da "
    "estação em metros se for menos de 1 km (ex.: '650 m'), senão em km com no "
    "máximo uma casa decimal (ex.: '1,4 km'). 'tipo_projeto' deve ser "
    "'Residencial', 'Comercial' ou 'Misto' (Misto = também tem lojas ou salas/"
    "lajes comerciais à venda). 'padrao' deve ser um de: Econômico, Médio, "
    "Médio-Alto, Alto, Altíssimo (estime pelo material se não estiver explícito). "
    "Responda APENAS com um objeto JSON com exatamente estas chaves: "
    + ", ".join(CAMPOS_FICHA) + "."
)


def _config() -> dict:
    """Lê a seção [gemini] dos secrets com tolerância a ambiente sem secrets."""
    try:
        return dict(st.secrets.get("gemini", {}))
    except Exception:  # noqa: BLE001 — secrets ausente em ambiente local
        return {}


def ia_configurada() -> bool:
    """True se há chave do Gemini configurada."""
    return bool(_config().get("api_key"))


def _normalizar_valor(valor) -> str:
    """Converte o valor do JSON em texto. Listas viram 'a; b; c'."""
    if isinstance(valor, list):
        return "; ".join(str(item) for item in valor if str(item).strip())
    return str(valor or "")


def _mime(nome_arquivo: str) -> str:
    nome = nome_arquivo.lower()
    if nome.endswith(".pdf"):
        return "application/pdf"
    if nome.endswith(".png"):
        return "image/png"
    return "image/jpeg"


@st.cache_data(show_spinner=False, ttl=86400)
def extrair_ficha(conteudo_bytes: bytes, nome_arquivo: str) -> dict:
    """Extrai a ficha técnica do documento via Gemini. Cacheado por conteúdo.

    Faz retry em erro 5xx transitório (free tier sobrecarrega às vezes).
    """
    from google import genai
    from google.genai import errors, types

    cfg = _config()
    if not cfg.get("api_key"):
        raise RuntimeError("Gemini não configurado nos secrets.")

    cliente = genai.Client(api_key=cfg["api_key"])
    parte = types.Part.from_bytes(data=conteudo_bytes, mime_type=_mime(nome_arquivo))
    config = types.GenerateContentConfig(response_mime_type="application/json")

    ultimo_erro: Exception | None = None
    for tentativa in range(_TENTATIVAS):
        try:
            resposta = cliente.models.generate_content(
                model=cfg.get("model", MODELO_PADRAO),
                contents=[parte, _INSTRUCAO],
                config=config,
            )
            dados = json.loads(resposta.text)
            # garante todas as chaves presentes (string vazia se faltar; lista vira "a; b")
            return {chave: _normalizar_valor(dados.get(chave)) for chave in CAMPOS_FICHA}
        except errors.ServerError as exc:  # 5xx (ex.: 503 high demand) -> tenta de novo
            ultimo_erro = exc
            time.sleep(2 * (tentativa + 1))
    raise RuntimeError(f"Gemini indisponível após {_TENTATIVAS} tentativas: {ultimo_erro}")


def ficha_vazia() -> dict:
    """Ficha com todos os campos em branco (para preenchimento manual)."""
    return {chave: "" for chave in CAMPOS_FICHA}
