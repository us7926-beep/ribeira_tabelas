"""Análise de documentos via Google Gemini (nativo do backend, lê env vars).

Independente do Streamlit. Usos principais:
- ``analisar_flyer``: detecção rápida para o fluxo de upload (nome, incorporadora,
  evento/promoção, condições comerciais) — alimenta o modal de confirmação.
- ``extrair_ficha_dossie``: ficha técnica completa para o dossiê (chaves
  alinhadas ao schema atual de empreendimentos).
- ``extrair_tabela_precos``: tabela de unidades + condições + promoções (PR #10).
- ``buscar_dados_empreendimento``: busca pública via Google Search grounding.
"""
import json
import time

from . import config

_TENTATIVAS = 3

_PROMPT_FLYER = (
    "Analise este flyer/material promocional imobiliário e responda APENAS um "
    "objeto JSON com as chaves: nome_empreendimento, incorporadora, evento, "
    "data_inicio, data_fim, condicoes_comerciais. 'evento' descreve qualquer "
    "evento ou promoção pontual mencionada (lançamento, plantão, condição "
    "especial); vazio se não houver. Datas em DD/MM/AAAA. Use string vazia "
    "quando o campo não constar (não invente)."
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
    "Numeros como tipo number, nao string. "
    "\n\nEXEMPLOS de resposta valida:\n"
    "1) Book completo (Alegria Patteo Mogilar da Helbor):\n"
    '{"nome":"Alegria Patteo Mogilar","bairro":"Vila Mogilar","cidade":"Mogi das Cruzes",'
    '"padrao":"Alto","tipologias":"2 e 3 dorms","metragens":["64 m2","82 m2","98 m2"],'
    '"total_unidades":180,"unidades_residenciais":180,"unidades_comerciais":null,'
    '"tipo_uso":"residencial","pavimentos":22,"torres":2,"elevadores_por_torre":4,'
    '"vagas_comunidade":null,"vagas_venda":220,"vagas_cobertas":220,'
    '"distancia_metro_km":null,"data_lancamento":"2025-09-15","data_entrega":"2028-12-30",'
    '"cnpj_spe":"12.345.678/0001-90","ri":"12345-RIM"}\n'
    "2) Book pobre (so tem o nome e uma pista de padrao, o resto nao aparece):\n"
    '{"nome":"Torres do Parque","bairro":null,"cidade":null,"padrao":"Medio",'
    '"tipologias":null,"metragens":[],"total_unidades":null,'
    '"unidades_residenciais":null,"unidades_comerciais":null,"tipo_uso":null,'
    '"pavimentos":null,"torres":null,"elevadores_por_torre":null,'
    '"vagas_comunidade":null,"vagas_venda":null,"vagas_cobertas":null,'
    '"distancia_metro_km":null,"data_lancamento":null,"data_entrega":null,'
    '"cnpj_spe":null,"ri":null}\n'
    "Observe: prefira null a inventar. Nunca chute uma data ou um CNPJ."
)


# Campos que sao essenciais pra chamar a ficha de "bem extraida". Se vier
# menos que _MIN_ESSENCIAIS preenchidos, disparamos retry com prompt de
# reforco. Escolhidos por serem o que a IA erra menos e o que mais dor
# quando falta.
_CAMPOS_ESSENCIAIS = ("nome", "bairro", "cidade", "padrao", "tipologias")
_MIN_ESSENCIAIS = 3


_PROMPT_FICHA_REFORCO = (
    "Voce ja tentou extrair a ficha deste documento uma vez, mas veio incompleta. "
    "Os seguintes campos ficaram vazios ou nulos: {faltantes}. "
    "Procure de novo, agora com atencao a esses campos especificamente. "
    "Olhe cabecalhos, rodapes, tabelas de fluxo comercial, seccoes de 'MEMORIAL', "
    "logos, endereco no rodape, dados de registro imobiliario no final do PDF, "
    "textos em letra pequena. Dados podem estar em qualquer lugar do documento. "
    "Responda APENAS um objeto JSON com as MESMAS chaves da tentativa anterior "
    "({todas_chaves}). Preencha os campos que voce ja achou antes (repita os "
    "valores) e os novos que conseguiu extrair agora. Se um campo continuar sem "
    "aparecer mesmo depois de olhar tudo, use null. "
    "REGRAS DE FORMATACAO: padrao entre Economico/Medio/Alto/Luxo; tipo_uso "
    "entre residencial/comercial/misto; datas em YYYY-MM-DD; metragens como "
    "array de strings; distancia_metro_km em km (numero); numeros como number."
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


_FICHA_CHAVES_INTEIRO = {
    "total_unidades", "unidades_residenciais", "unidades_comerciais",
    "pavimentos", "torres", "elevadores_por_torre",
    "vagas_comunidade", "vagas_venda", "vagas_cobertas",
}
_FICHA_CHAVES_DECIMAL = {"distancia_metro_km"}
_FICHA_CHAVES_TEXTO = {"nome", "bairro", "cidade", "padrao", "tipologias",
                       "tipo_uso", "data_lancamento", "data_entrega",
                       "cnpj_spe", "ri"}
_FICHA_TODAS_CHAVES = (
    _FICHA_CHAVES_TEXTO | _FICHA_CHAVES_INTEIRO | _FICHA_CHAVES_DECIMAL | {"metragens"}
)


def _normalizar_ficha(dados: dict) -> dict:
    """Aplica tipagem + limpeza. Omite chaves vazias/None."""
    saida: dict = {}
    if not isinstance(dados, dict):
        return saida
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
        elif chave in _FICHA_CHAVES_INTEIRO:
            num = _parse_numero(valor)
            if num is not None:
                saida[chave] = int(num)
        elif chave in _FICHA_CHAVES_DECIMAL:
            num = _parse_numero(valor)
            if num is not None:
                saida[chave] = round(num, 1)
        elif chave in _FICHA_CHAVES_TEXTO:
            texto = str(valor).strip()
            if texto:
                saida[chave] = texto
    return saida


def _essenciais_preenchidos(ficha: dict) -> int:
    """Quantos campos essenciais vieram preenchidos (0-5)."""
    return sum(1 for c in _CAMPOS_ESSENCIAIS if ficha.get(c))


def extrair_ficha_dossie(conteudo: bytes, nome: str, retry_vazios: bool = True) -> dict:
    """Extrai ficha tecnica de um documento (PDF/imagem), com chaves alinhadas
    ao schema atual de `empreendimentos`.

    Retorna apenas as chaves preenchidas (omite vazias/None) — frontend so
    aplica o que veio. Numeros normalizados (float ou int), metragens como
    lista de strings.

    Quando ``retry_vazios=True`` (default), refaz UMA VEZ com prompt de
    reforco se a extracao veio com menos que ``_MIN_ESSENCIAIS`` campos
    essenciais preenchidos (nome/bairro/cidade/padrao/tipologias). O merge
    prioriza os valores da 1a tentativa — o retry so preenche o que ficou
    vazio, nunca sobrescreve.
    """
    dados = _gerar(conteudo, nome, _PROMPT_FICHA_DOSSIE)
    saida = _normalizar_ficha(dados)

    if not retry_vazios:
        return saida
    if _essenciais_preenchidos(saida) >= _MIN_ESSENCIAIS:
        return saida

    # Reforco: pergunta especificamente pelos campos que ficaram sem.
    faltantes = [c for c in _FICHA_TODAS_CHAVES if not saida.get(c)]
    if not faltantes:
        return saida
    prompt_reforco = _PROMPT_FICHA_REFORCO.format(
        faltantes=", ".join(sorted(faltantes)),
        todas_chaves=", ".join(sorted(_FICHA_TODAS_CHAVES)),
    )
    try:
        dados_reforco = _gerar(conteudo, nome, prompt_reforco)
    except RuntimeError:
        # Reforco eh best-effort — se falhar, ficamos com o que veio antes.
        return saida
    reforco = _normalizar_ficha(dados_reforco)
    # Merge: 1a tentativa vence; reforco so preenche o que faltou.
    for chave, valor in reforco.items():
        saida.setdefault(chave, valor)
    return saida


_PROMPT_DIAGNOSTICO = (
    "Voce e um analista imobiliario senior. Vou te passar (1) a ficha e KPIs "
    "de um empreendimento e (2) os KPIs de ate 5 concorrentes do mesmo "
    "bairro/cidade/padrao. Sua tarefa: gerar um PARECER COMPETITIVO curto "
    "com 3 a 5 bullets. Cada bullet e uma leitura FACTUAL da posicao (ex.: "
    "preco vs media, VSO vs media, estoque, condicoes, timing), NUNCA "
    "recomendacoes vagas do tipo 'reveja sua estrategia'. Se um KPI estiver "
    "faltando, ignore-o em vez de inventar. "
    "Responda APENAS um objeto JSON com estas chaves: "
    "bullets (array com 3 a 5 objetos {texto, tag, kpi_referencia}), "
    "resumo_executivo (string, 1 frase resumindo a posicao). "
    "tag em uma destas opcoes: 'forca', 'fraqueza', 'oportunidade', 'risco', "
    "'neutro'. kpi_referencia (opcional) e o nome do KPI principal citado "
    "(ex.: 'preco_m2', 'vso', 'ticket', 'vgv', 'estoque'). "
    "Bullets em portugues, cada um com 1 a 2 frases, com numeros concretos "
    "quando disponiveis (%, R$, quantidade). NAO use markdown nem asteriscos "
    "dentro do texto. NAO invente concorrentes que nao estao na lista."
)


def gerar_diagnostico_competitivo(
    empreendimento: dict, kpis_proprios: dict, concorrentes: list[dict]
) -> dict:
    """Gera parecer competitivo curto via Gemini a partir de ficha + KPIs.

    Insumos:
    - empreendimento: campos da ficha (nome, bairro, cidade, padrao, ...)
    - kpis_proprios: KPIs numericos (preco_m2, ticket, vgv, vso, estoque, ...)
    - concorrentes: lista de dicts com nome + KPIs analogos, mesma
      cidade+padrao, ordenados por VGV desc, tipicamente 3-5 itens.

    Retorna: {bullets: [{texto, tag, kpi_referencia}], resumo_executivo}
    """
    from google import genai
    from google.genai import errors, types

    if not config.gemini_api_key():
        raise RuntimeError("GEMINI_API_KEY ausente no ambiente.")

    contexto = json.dumps(
        {
            "empreendimento": empreendimento,
            "kpis_proprios": kpis_proprios,
            "concorrentes": concorrentes,
        },
        ensure_ascii=False,
        indent=2,
    )
    prompt = f"{_PROMPT_DIAGNOSTICO}\n\nDados:\n{contexto}"

    cliente = genai.Client(api_key=config.gemini_api_key())
    cfg = types.GenerateContentConfig(response_mime_type="application/json")

    ultimo: Exception | None = None
    for tentativa in range(_TENTATIVAS):
        try:
            resposta = cliente.models.generate_content(
                model=config.gemini_model(), contents=[prompt], config=cfg
            )
            dados = json.loads(resposta.text)
            break
        except (errors.ServerError, json.JSONDecodeError) as exc:
            ultimo = exc
            time.sleep(2 * (tentativa + 1))
    else:
        raise RuntimeError(
            f"Gemini indisponivel apos {_TENTATIVAS} tentativas: {ultimo}"
        )

    bullets_raw = dados.get("bullets") or []
    tags_validas = {"forca", "fraqueza", "oportunidade", "risco", "neutro"}
    bullets: list[dict] = []
    for item in bullets_raw:
        if not isinstance(item, dict):
            continue
        texto = str(item.get("texto") or "").strip()
        if not texto:
            continue
        tag = str(item.get("tag") or "neutro").strip().lower()
        if tag not in tags_validas:
            tag = "neutro"
        kpi_ref = str(item.get("kpi_referencia") or "").strip() or None
        bullets.append({"texto": texto, "tag": tag, "kpi_referencia": kpi_ref})
    return {
        "bullets": bullets[:5],
        "resumo_executivo": str(dados.get("resumo_executivo") or "").strip(),
    }


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
