"""KPIs de vendas no backend, reusando src/dashboard.py (módulo puro)."""
import pandas as pd

from src import dashboard


def _detectar(df: pd.DataFrame, candidatos: list[str]) -> str | None:
    for coluna in df.columns:
        nome = str(coluna).lower()
        if any(chave in nome for chave in candidatos):
            return coluna
    return None


def _agrupar_por_modalidade(
    df: pd.DataFrame, col_status: str, col_valor: str, col_modalidade: str,
) -> list[dict]:
    """Conta unidades vendidas e VGV por modalidade (so contagem de status
    contendo 'vend')."""
    so_vendidas = df[df[col_status].astype(str).str.lower().str.contains("vend", na=False)]
    if so_vendidas.empty:
        return []
    grupos = so_vendidas.groupby(col_modalidade, dropna=True)
    saida: list[dict] = []
    for nome, sub in grupos:
        if not str(nome).strip():
            continue
        unidades = int(len(sub))
        if unidades <= 0:
            continue
        vgv_serie = pd.to_numeric(sub[col_valor], errors="coerce").dropna()
        vgv = float(vgv_serie.sum()) if not vgv_serie.empty else None
        saida.append(
            {
                "modalidade": str(nome).strip(),
                "unidades_vendidas": unidades,
                "vgv": vgv,
            }
        )
    # mais unidades primeiro
    saida.sort(key=lambda d: d["unidades_vendidas"], reverse=True)
    return saida


def kpis(df: pd.DataFrame) -> dict:
    """Detecta as colunas de unidade/valor/situação e calcula os KPIs de vendas.

    Bonus: quando ha coluna de modalidade/forma de pagamento, agrupa as
    unidades vendidas por modalidade e devolve em `distribuicao` para o
    frontend pre-popular o painel de Distribuição da Aba Vendas Mensais.
    """
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

    col_modalidade = _detectar(
        df,
        ["modalidade", "condic", "forma de pag", "forma pag", "tipo pag",
         "tipo de pag", "financiamento", "pagamento"],
    )

    resultado = dashboard.calcular_kpis(df, col_unidade, col_valor, col_status)
    saida: dict = {
        "colunas": {
            "unidade": str(col_unidade),
            "valor": str(col_valor),
            "status": str(col_status),
            "modalidade": str(col_modalidade) if col_modalidade else None,
        },
        # remove chaves internas (Series do pandas, não serializáveis em JSON)
        "kpis": {chave: valor for chave, valor in resultado.items() if not chave.startswith("_")},
    }
    if col_modalidade:
        saida["distribuicao"] = _agrupar_por_modalidade(
            df, col_status, col_valor, col_modalidade,
        )
    return saida
