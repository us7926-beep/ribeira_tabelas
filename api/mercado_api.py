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


def _detectar(df: pd.DataFrame, candidatos: list[str]) -> str | None:
    for coluna in df.columns:
        nome = str(coluna).lower()
        if any(chave in nome for chave in candidatos):
            return coluna
    return None


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
