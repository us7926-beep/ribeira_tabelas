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


_MIME_SUPORTADOS = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
}


def _mime(nome: str) -> str:
    ext = ("." + nome.lower().rsplit(".", 1)[-1]) if "." in nome else ""
    mime = _MIME_SUPORTADOS.get(ext)
    if not mime:
        extensoes = ", ".join(_MIME_SUPORTADOS)
        raise ValueError(f"Tipo de arquivo não suportado. Use: {extensoes}.")
    return mime


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
        except (errors.ServerError, json.JSONDecodeError) as exc:
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


_PROMPT_TABELA_PRECOS = (
    "Voce e um analista imobiliario. Este documento e uma tabela de precos de "
    "lancamento de um empreendimento. Extraia TUDO em um unico objeto JSON com "
    "exatamente estas chaves: nome_empreendimento, incorporadora, cidade, bairro, "
    "padrao, total_unidades, unidades, promocoes. "
    "'padrao' deve ser exatamente uma destas opcoes: 'Economico', 'Medio', 'Alto', "
    "'Luxo' (infira pelo preco/m2 e area). "
    "'unidades' e um array com TODAS as linhas da tabela. Cada item tem: "
    "andar (string), unidade (string identificando o apartamento, ex.: 'Terreo 1;5'), "
    "area_m2 (number), vaga (string), entrada (number), parcelas_mensais (number), "
    "financiamento (number), preco_total (number), avaliacao (number). "
    "Use null quando o campo nao constar. NUNCA pule linhas, extraia TODAS as unidades. "
    "'promocoes' e um array de objetos com descricao (string), data_inicio "
    "(DD/MM/AAAA ou vazio), data_fim (DD/MM/AAAA ou vazio), condicoes (string). "
    "Liste APENAS promocoes com prazo definido ou condicao especial limitada (ex.: "
    "ITBI por conta da incorporadora ate uma data, desconto a vista limitado). NAO "
    "liste regras gerais do contrato (juros, INCC, IPCA, regras de financiamento). "
    "Responda APENAS o JSON, sem comentarios nem markdown."
)


def extrair_tabela_precos(conteudo: bytes, nome: str) -> dict:
    """Extrai tabela de unidades + promoes de um PDF/imagem de lançamento.

    Retorna: nome_empreendimento, incorporadora, cidade, bairro, padrao,
    total_unidades, unidades (lista), promocoes (lista).
    """
    dados = _gerar(conteudo, nome, _PROMPT_TABELA_PRECOS)
    return {
        "nome_empreendimento": _texto(dados.get("nome_empreendimento")),
        "incorporadora": _texto(dados.get("incorporadora")),
        "cidade": _texto(dados.get("cidade")),
        "bairro": _texto(dados.get("bairro")),
        "padrao": _texto(dados.get("padrao")),
        "total_unidades": dados.get("total_unidades"),
        "unidades": dados.get("unidades") or [],
        "promocoes": dados.get("promocoes") or [],
    }


_PROMPT_FICHA_DOSSIE = (
    "Voce e um analista imobiliario. Extraia a ficha tecnica do empreendimento "
    "deste documento (book, memorial descritivo, tabela ou flyer) e responda "
    "APENAS um objeto JSON com estas chaves: "
    "nome, bairro, cidade, padrao, tipologias, metragens, total_unidades, "
    "unidades_residenciais, unidades_comerciais, tipo_uso, pavimentos, torres, "
    "elevadores_por_torre, vagas_comunidade, vagas_venda, vagas_cobertas, "
    "distancia_metro_km, data_lancamento, data_entrega, cnpj_spe, ri. "
    "Regras: "
    "padrao em uma destas opcoes: Economico, Medio, Alto, Luxo. "
    "tipologias em texto curto (ex.: '1 e 2 dorms'). "
    "metragens como array de strings (ex.: ['49 m2','64 m2','73 m2']). "
    "tipo_uso em uma destas opcoes: residencial, comercial, misto. "
    "distancia_metro_km como numero em km (ex.: 0.8 para 800 m). "
    "data_lancamento e data_entrega no formato YYYY-MM-DD. "
    "Use string vazia ou null nos campos nao encontrados (nunca invente). "
    "Numeros como tipo number, nao string."
)


def _parse_numero(valor) -> float | None:
    if valor in (None, "", []):
        return None
    if isinstance(valor, (int, float)):
        return float(valor)
    try:
        return float(str(valor).replace(",", ".").strip())
    except (TypeError, ValueError):
        return None


def extrair_ficha_dossie(conteudo: bytes, nome: str) -> dict:
    """Extrai ficha tecnica de um documento (PDF/imagem), com chaves alinhadas
    ao schema atual de `empreendimentos`.

    Retorna apenas as chaves preenchidas (omite vazias/None) — frontend so
    aplica o que veio. Numeros normalizados (float ou int), metragens como
    lista de strings.
    """
    dados = _gerar(conteudo, nome, _PROMPT_FICHA_DOSSIE)
    if not isinstance(dados, dict):
        return {}

    chaves_inteiro = {
        "total_unidades", "unidades_residenciais", "unidades_comerciais",
        "pavimentos", "torres", "elevadores_por_torre",
        "vagas_comunidade", "vagas_venda", "vagas_cobertas",
    }
    chaves_decimal = {"distancia_metro_km"}
    chaves_texto = {"nome", "bairro", "cidade", "padrao", "tipologias",
                    "tipo_uso", "data_lancamento", "data_entrega",
                    "cnpj_spe", "ri"}

    saida: dict = {}
    for chave, valor in dados.items():
        if valor in (None, "", []):
            continue
        if chave == "metragens":
            if isinstance(valor, list):
                normalizado = [str(item).strip() for item in valor if str(item).strip()]
            else:
                texto = str(valor).strip()
                normalizado = [texto] if texto else []
            if normalizado:
                saida["metragens"] = normalizado
        elif chave in chaves_inteiro:
            num = _parse_numero(valor)
            if num is not None:
                saida[chave] = int(num)
        elif chave in chaves_decimal:
            num = _parse_numero(valor)
            if num is not None:
                saida[chave] = round(num, 1)
        elif chave in chaves_texto:
            texto = str(valor).strip()
            if texto:
                saida[chave] = texto
    return saida


_PROMPT_BUSCA_EMPREENDIMENTO = (
    "Voce e um analista imobiliario. Pesquise dados publicos sobre o "
    "empreendimento abaixo e responda APENAS um objeto JSON com as chaves: "
    "cnpj_spe, ri, data_lancamento, data_entrega, total_unidades, pavimentos, "
    "torres, metragens (array de strings, ex.: ['49 m2','64 m2']), tipologias, "
    "bairro, distancia_metro_km (numero, em km), padrao (uma das opcoes: "
    "Economico, Medio, Alto, Luxo), fontes (array de URLs). "
    "Datas em DD/MM/AAAA. Use string vazia ou null nos campos que voce nao "
    "encontrar (nunca invente)."
)


def buscar_dados_empreendimento(
    nome: str, incorporadora: str = "", cidade: str = ""
) -> dict:
    """Busca ficha tecnica publica via Gemini.

    Tenta primeiro com Google Search grounding (gemini-2.0+/2.5 com tool). Se a
    SDK ou o modelo nao suportarem, faz fallback para prompt direto sem
    grounding. Retorna dict com os campos encontrados (faltantes ausentes).
    """
    from google import genai
    from google.genai import errors, types

    if not config.gemini_api_key():
        raise RuntimeError("GEMINI_API_KEY ausente no ambiente.")

    cliente = genai.Client(api_key=config.gemini_api_key())
    prompt = (
        f"{_PROMPT_BUSCA_EMPREENDIMENTO}\n\n"
        f"Nome: {nome}\n"
        f"Incorporadora: {incorporadora or '(nao informada)'}\n"
        f"Cidade: {cidade or '(nao informada)'}"
    )

    def _chamar(usar_grounding: bool) -> dict:
        if usar_grounding:
            tools = [types.Tool(google_search=types.GoogleSearch())]
            cfg = types.GenerateContentConfig(tools=tools)
        else:
            cfg = types.GenerateContentConfig(response_mime_type="application/json")
        resposta = cliente.models.generate_content(
            model=config.gemini_model(), contents=[prompt], config=cfg
        )
        bruto = (resposta.text or "").strip()
        try:
            return json.loads(bruto)
        except json.JSONDecodeError:
            # Quando grounding ativo, modelo costuma incluir prosa antes do JSON.
            inicio = bruto.find("{")
            fim = bruto.rfind("}")
            if inicio >= 0 and fim > inicio:
                return json.loads(bruto[inicio : fim + 1])
            raise

    # 1) Tentativa com Google Search grounding (mais preciso, com fontes).
    try:
        dados = _chamar(usar_grounding=True)
    except (errors.ServerError, errors.ClientError, json.JSONDecodeError, AttributeError, ValueError):
        # 2) Fallback sem grounding.
        try:
            dados = _chamar(usar_grounding=False)
        except (errors.ServerError, json.JSONDecodeError) as exc:
            raise RuntimeError(f"Falha na busca: {exc}") from exc

    if not isinstance(dados, dict):
        return {}
    chaves_lista = {"metragens", "fontes"}
    saida: dict = {}
    for chave, valor in dados.items():
        if valor in (None, "", []):
            continue
        if chave in chaves_lista:
            saida[chave] = valor if isinstance(valor, list) else [str(valor)]
        else:
            saida[chave] = valor
    return saida
