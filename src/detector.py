"""Detecção heurística do padrão de colunas de uma tabela de unidades/valores."""
import re

import pandas as pd

PADROES_COLUNA: dict[str, list[str]] = {
    "unidade": [r"unidade", r"apto", r"apartamento", r"un\b"],
    "bloco": [r"bloco", r"torre"],
    "valor": [r"valor", r"pre[cç]o", r"total"],
    "data": [r"data", r"compet[eê]ncia", r"m[eê]s"],
    "cliente": [r"cliente", r"comprador", r"nome"],
}


def _coluna_corresponde(nome_coluna: str, padroes: list[str]) -> bool:
    nome = nome_coluna.strip().lower()
    return any(re.search(p, nome) for p in padroes)


def detectar_padrao(df: pd.DataFrame) -> dict:
    """Identifica quais colunas do DataFrame correspondem a cada papel conhecido.

    Retorna um dicionário com o mapeamento papel -> coluna detectada (ou None)
    e um score de confiança (proporção de papéis encontrados).
    """
    mapeamento: dict[str, str | None] = {}
    for papel, padroes in PADROES_COLUNA.items():
        encontrada = next(
            (col for col in df.columns if _coluna_corresponde(str(col), padroes)),
            None,
        )
        mapeamento[papel] = encontrada

    papeis_encontrados = sum(1 for v in mapeamento.values() if v is not None)
    confianca = papeis_encontrados / len(PADROES_COLUNA)

    return {
        "mapeamento": mapeamento,
        "confianca": round(confianca, 2),
        "colunas_nao_mapeadas": [
            c for c in df.columns if c not in mapeamento.values()
        ],
    }
