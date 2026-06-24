"""Extração de ficha técnica de empreendimentos via Claude (IA), modo híbrido.

Lê books/flyers/PDFs (texto ou escaneado) e devolve os campos do benchmark em
JSON estruturado. Requer uma chave da Anthropic em ``st.secrets["anthropic"]``.
Sem chave, ``ia_configurada()`` é False e o app oferece preenchimento manual.

O resultado é sempre revisado pelo usuário antes de salvar (modo híbrido).
"""
import base64
import json

import streamlit as st

MODELO = "claude-opus-4-8"  # mais capaz; lê PDF e imagem nativamente

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
    "Médio-Alto, Alto, Altíssimo (estime pelo material se não estiver explícito)."
)


def ia_configurada() -> bool:
    """True se há chave da Anthropic nos secrets."""
    try:
        return bool(st.secrets.get("anthropic", {}).get("api_key"))
    except Exception:  # noqa: BLE001 — secrets ausente em ambiente local
        return False


def _bloco_documento(conteudo_bytes: bytes, nome_arquivo: str) -> dict:
    b64 = base64.standard_b64encode(conteudo_bytes).decode()
    nome = nome_arquivo.lower()
    if nome.endswith(".pdf"):
        return {"type": "document",
                "source": {"type": "base64", "media_type": "application/pdf", "data": b64}}
    media = "image/png" if nome.endswith(".png") else "image/jpeg"
    return {"type": "image", "source": {"type": "base64", "media_type": media, "data": b64}}


@st.cache_data(show_spinner=False, ttl=86400)
def extrair_ficha(conteudo_bytes: bytes, nome_arquivo: str) -> dict:
    """Extrai a ficha técnica do documento via Claude. Cacheado por conteúdo."""
    import anthropic

    cliente = anthropic.Anthropic(api_key=st.secrets["anthropic"]["api_key"])
    resposta = cliente.messages.create(
        model=MODELO,
        max_tokens=2000,
        messages=[{
            "role": "user",
            "content": [_bloco_documento(conteudo_bytes, nome_arquivo),
                        {"type": "text", "text": _INSTRUCAO}],
        }],
        output_config={"format": {"type": "json_schema", "schema": _SCHEMA}},
    )
    texto = next(b.text for b in resposta.content if b.type == "text")
    dados = json.loads(texto)
    # garante todas as chaves presentes (string vazia se faltar)
    return {chave: str(dados.get(chave, "") or "") for chave in CAMPOS_FICHA}


def ficha_vazia() -> dict:
    """Ficha com todos os campos em branco (para preenchimento manual)."""
    return {chave: "" for chave in CAMPOS_FICHA}
