"""KPIs de vendas no backend, reusando src/dashboard.py (módulo puro)."""
import pandas as pd

from src import dashboard


def _detectar(df: pd.DataFrame, candidatos: list[str]) -> str | None:
    for coluna in df.columns:
        nome = str(coluna).lower()
        if any(chave in nome for chave in candidatos):
            return coluna
    return None


def kpis(df: pd.DataFrame) -> dict:
    """Detecta as colunas de unidade/valor/situação e calcula os KPIs de vendas."""
    if df.empty or len(df.columns) == 0:
        raise ValueError("Planilha vazia ou sem colunas.")
    col_unidade = _detectar(df, ["unid", "apto", "apt", "casa", "lote", "sala"]) or str(df.columns[0])
    col_valor = _detectar(df, ["valor", "preço", "preco", "r$"])
    col_status = _detectar(df, ["status", "situa", "disponib", "estado", "vendido"])
    if not col_valor or not col_status:
        raise ValueError(
            "Não identifiquei as colunas de valor e/ou situação (status). "
            "A planilha precisa de uma coluna de valor e uma de situação (Disponível/Vendido)."
        )

    resultado = dashboard.calcular_kpis(df, col_unidade, col_valor, col_status)
    return {
        "colunas": {
            "unidade": str(col_unidade),
            "valor": str(col_valor),
            "status": str(col_status),
        },
        # remove chaves internas (Series do pandas, não serializáveis em JSON)
        "kpis": {chave: valor for chave, valor in resultado.items() if not chave.startswith("_")},
    }
