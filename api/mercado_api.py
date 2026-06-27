"""Comparativo de mercado no backend, reusando src/mercado.py (módulo puro).

Aceita CSV, Excel e — quando o arquivo é PDF ou imagem — extrai a tabela de
preços via Gemini e converte para DataFrame transparentemente, para que o
restante do pipeline siga inalterado.
"""
import io

import pandas as pd

from src import mercado

_EXTS_IA = (".pdf", ".png", ".jpg", ".jpeg")
_RESULTADO_IA: dict | None = None


def ler_planilha(conteudo: bytes, nome_arquivo: str) -> pd.DataFrame:
    """Lê o arquivo enviado e devolve um DataFrame com pelo menos valor e área."""
    global _RESULTADO_IA
    _RESULTADO_IA = None
    nome = (nome_arquivo or "").lower()
    if nome.endswith(_EXTS_IA):
        from . import gemini
        dados = gemini.extrair_tabela_precos(conteudo, nome_arquivo)
        unidades = dados.get("unidades") or []
        if not unidades:
            raise ValueError(
                "A IA não encontrou unidades na tabela. Confira se o arquivo é "
                "uma tabela de preços com colunas de valor e área."
            )
        df = pd.DataFrame(unidades)
        # Renomeia para os nomes que o detector de colunas (mercado_api) procura.
        renames = {"area_m2": "area", "preco_total": "valor"}
        for de, para in renames.items():
            if de in df.columns:
                df = df.rename(columns={de: para})
        _RESULTADO_IA = dados
        return df

    buffer = io.BytesIO(conteudo)
    if nome.endswith(".csv"):
        return pd.read_csv(buffer)
    return pd.read_excel(buffer)


def ultima_extracao_ia() -> dict | None:
    """Devolve o último JSON da IA — útil para metadados (promoções, padrão)."""
    return _RESULTADO_IA


def montar_condicoes_simples(kpis: dict | None) -> dict:
    """Infere um JSON de condições básicas a partir dos KPIs (CSV/XLS).

    Quando a IA não rodou, ainda assim queremos popular `tabelas_precos.condicoes`
    com algo mínimo: à vista (sem desconto explícito) + financiamento (sem banco).
    """
    if not kpis:
        return {}
    ticket = kpis.get("ticket_medio")
    return {
        "avista": {},
        "financiamento": {
            "banco": "",
            "taxa_aa": None,
            "prazo_meses": 360,
        },
        **({"_ticket_referencia": ticket} if ticket else {}),
    }


def _detectar(df: pd.DataFrame, candidatos: list[str]) -> str | None:
    for coluna in df.columns:
        nome = str(coluna).lower()
        if any(chave in nome for chave in candidatos):
            return coluna
    return None


def _num(v) -> float | None:
    try:
        n = float(pd.to_numeric(v, errors="coerce"))
    except (TypeError, ValueError):
        return None
    if pd.isna(n):
        return None
    return n


def _texto(v) -> str | None:
    """Formata um valor de célula como string limpa. Trata int promovido a
    float pelo pandas (quando outra linha da mesma coluna tem NaN) — '101.0'
    vira '101' quando o valor é inteiro."""
    if v is None:
        return None
    if isinstance(v, float):
        if pd.isna(v):
            return None
        if v == int(v):
            return str(int(v))
        return str(v)
    s = str(v).strip()
    return s or None


def normalizar_unidades(df: pd.DataFrame) -> list[dict]:
    """Mapeia o DataFrame bruto de um CSV/XLS para o schema canônico de
    unidades que o frontend espera (mesmo formato que `gemini.extrair_
    tabela_precos` devolve): preco_total, area_m2, unidade + andar, vaga,
    entrada, parcelas_mensais, financiamento (opcionais).

    Reusa `_detectar` por substring case-insensitive nos nomes de coluna.
    `valor`/`preço`/`r$` -> `preco_total`; `area`/`m2`/`metragem` -> `area_m2`;
    `unid`/`apto`/`apt`/`casa`/`lote`/`sala` -> `unidade`; etc.

    Sem coluna de valor ou área, devolve [] (o caller decide se erra).
    """
    if df is None or df.empty:
        return []
    col_valor = _detectar(df, ["valor", "preço", "preco", "r$"])
    col_area = _detectar(df, ["área", "area", "priv", "m2", "m²", "metragem"])
    if not col_valor or not col_area:
        return []
    col_unidade = _detectar(df, ["unid", "apto", "apt", "casa", "lote", "sala"])
    col_andar = _detectar(df, ["andar", "pavimento"])
    col_vaga = _detectar(df, ["vaga"])
    col_entrada = _detectar(df, ["entrada", "ato"])
    col_parcelas = _detectar(df, ["parcela", "mensal"])
    col_financ = _detectar(df, ["financ"])

    unidades: list[dict] = []
    for _, linha in df.iterrows():
        preco = _num(linha.get(col_valor))
        area = _num(linha.get(col_area))
        if preco is None and area is None:
            continue  # linha sem nada útil
        registro: dict = {
            "preco_total": preco,
            "area_m2": area,
        }
        if col_unidade:
            s = _texto(linha.get(col_unidade))
            if s is not None:
                registro["unidade"] = s
        if col_andar:
            s = _texto(linha.get(col_andar))
            if s is not None:
                registro["andar"] = s
        if col_vaga:
            s = _texto(linha.get(col_vaga))
            if s is not None:
                registro["vaga"] = s
        for chave, col in (
            ("entrada", col_entrada),
            ("parcelas_mensais", col_parcelas),
            ("financiamento", col_financ),
        ):
            if col:
                n = _num(linha.get(col))
                if n is not None:
                    registro[chave] = n
        unidades.append(registro)
    return unidades


def comparativo(
    df: pd.DataFrame,
    *,
    tipo: str,
    incorporadora: str,
    produto: str,
    cidade: str,
    bairro: str,
    padrao: str,
) -> dict:
    col_valor = _detectar(df, ["valor", "preço", "preco", "r$"])
    col_area = _detectar(df, ["área", "area", "priv", "m2", "m²", "metragem"])
    col_unidade = _detectar(df, ["unid", "apto", "apt", "casa", "lote", "sala"])
    if not col_valor or not col_area:
        raise ValueError(
            "Não identifiquei as colunas de valor e/ou área. "
            "Verifique se a planilha tem colunas com 'valor'/'preço' e 'área'/'m²'."
        )

    base = mercado.normalizar_upload(
        df,
        col_valor=col_valor,
        col_area=col_area,
        col_unidade=col_unidade,
        tipo=tipo,
        incorporadora=incorporadora,
        produto=produto,
        cidade=cidade,
        bairro=bairro,
        padrao=padrao,
    )
    return {
        "colunas_detectadas": {
            "valor": str(col_valor),
            "area": str(col_area),
            "unidade": str(col_unidade) if col_unidade else None,
        },
        "linhas": int(len(base)),
        "kpis": mercado.kpis_gerais(base),
    }
