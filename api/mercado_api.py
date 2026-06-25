"""Comparativo de mercado no backend, reusando src/mercado.py (módulo puro)."""
import io

import pandas as pd

from src import mercado


def ler_planilha(conteudo: bytes, nome_arquivo: str) -> pd.DataFrame:
    buffer = io.BytesIO(conteudo)
    if nome_arquivo.lower().endswith(".csv"):
        return pd.read_csv(buffer)
    return pd.read_excel(buffer)


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
