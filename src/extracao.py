"""Extração de ficha técnica de empreendimentos via IA, modo híbrido.

Lê books/flyers/PDFs (texto ou escaneado) e devolve os campos do benchmark em
JSON. Suporta dois provedores, escolhidos pela chave presente nos secrets:

* ``[gemini]``  -> Google Gemini (free tier) — tem prioridade por ser grátis.
* ``[anthropic]`` -> Claude Opus 4.8 — reforço opcional para docs difíceis.

Sem nenhuma chave, ``ia_configurada()`` é False e o app cai no preenchimento
manual. O resultado é sempre revisado pelo usuário antes de salvar (híbrido).
"""
import base64
import json

import streamlit as st

MODELO_CLAUDE = "claude-opus-4-8"
MODELO_GEMINI_PADRAO = "gemini-2.5-flash"  # multimodal e grátis; override em [gemini].model

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

# Schema usado pelo Claude (output estruturado nativo).
_SCHEMA = {
    "type": "object",
    "properties": {chave: {"type": "string"} for chave in CAMPOS_FICHA},
    "required": list(CAMPOS_FICHA),
    "additionalProperties": False,
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


def _secao(nome: str) -> dict:
    """Lê uma seção dos secrets com tolerância a ambiente sem secrets."""
    try:
        return dict(st.secrets.get(nome, {}))
    except Exception:  # noqa: BLE001 — secrets ausente em ambiente local
        return {}


def provedor_ia() -> str | None:
    """Qual IA usar: 'gemini' (prioridade, grátis), 'anthropic' ou None."""
    if _secao("gemini").get("api_key"):
        return "gemini"
    if _secao("anthropic").get("api_key"):
        return "anthropic"
    return None


def ia_configurada() -> bool:
    """True se há alguma IA (Gemini ou Claude) configurada."""
    return provedor_ia() is not None


def rotulo_provedor() -> str:
    """Nome amigável do provedor ativo (para exibir no app)."""
    return {"gemini": "Google Gemini (grátis)",
            "anthropic": "Claude Opus 4.8"}.get(provedor_ia(), "—")


def _mime(nome_arquivo: str) -> str:
    nome = nome_arquivo.lower()
    if nome.endswith(".pdf"):
        return "application/pdf"
    if nome.endswith(".png"):
        return "image/png"
    return "image/jpeg"


def _extrair_gemini(conteudo_bytes: bytes, nome_arquivo: str) -> dict:
    from google import genai
    from google.genai import types

    cfg = _secao("gemini")
    cliente = genai.Client(api_key=cfg["api_key"])
    resposta = cliente.models.generate_content(
        model=cfg.get("model", MODELO_GEMINI_PADRAO),
        contents=[
            types.Part.from_bytes(data=conteudo_bytes, mime_type=_mime(nome_arquivo)),
            _INSTRUCAO,
        ],
        config=types.GenerateContentConfig(response_mime_type="application/json"),
    )
    return json.loads(resposta.text)


def _extrair_claude(conteudo_bytes: bytes, nome_arquivo: str) -> dict:
    import anthropic

    b64 = base64.standard_b64encode(conteudo_bytes).decode()
    mime = _mime(nome_arquivo)
    if mime == "application/pdf":
        bloco = {"type": "document",
                 "source": {"type": "base64", "media_type": mime, "data": b64}}
    else:
        bloco = {"type": "image",
                 "source": {"type": "base64", "media_type": mime, "data": b64}}

    cliente = anthropic.Anthropic(api_key=_secao("anthropic")["api_key"])
    resposta = cliente.messages.create(
        model=MODELO_CLAUDE,
        max_tokens=2000,
        messages=[{"role": "user",
                   "content": [bloco, {"type": "text", "text": _INSTRUCAO}]}],
        output_config={"format": {"type": "json_schema", "schema": _SCHEMA}},
    )
    texto = next(b.text for b in resposta.content if b.type == "text")
    return json.loads(texto)


@st.cache_data(show_spinner=False, ttl=86400)
def extrair_ficha(conteudo_bytes: bytes, nome_arquivo: str) -> dict:
    """Extrai a ficha técnica do documento via IA. Cacheado por conteúdo."""
    provedor = provedor_ia()
    if provedor == "gemini":
        dados = _extrair_gemini(conteudo_bytes, nome_arquivo)
    elif provedor == "anthropic":
        dados = _extrair_claude(conteudo_bytes, nome_arquivo)
    else:
        raise RuntimeError("Nenhuma IA configurada nos secrets.")
    # garante todas as chaves presentes (string vazia se faltar)
    return {chave: str(dados.get(chave, "") or "") for chave in CAMPOS_FICHA}


def ficha_vazia() -> dict:
    """Ficha com todos os campos em branco (para preenchimento manual)."""
    return {chave: "" for chave in CAMPOS_FICHA}
