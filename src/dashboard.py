"""Cálculo de KPIs e indicadores para o dashboard de tabelas de vendas.

A tabela típica da Ribeira tem uma coluna de unidade, uma de valor e uma de
situação (Disponível / Vendido / Reservado). Os nomes variam, então o app
deixa o usuário escolher quais colunas representam cada papel.
"""
import unicodedata

import pandas as pd

STATUS_DISPONIVEL = {"disponivel", "livre", "disp", "d"}
STATUS_VENDIDO = {"vendido", "vendida", "venda", "v"}
STATUS_RESERVADO = {"reservado", "reservada", "reserva", "r"}


def _normalizar(texto: object) -> str:
    """Remove acentos, espaços e caixa para comparar status de forma robusta."""
    s = str(texto).strip().lower()
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


def classificar_status(valor: object) -> str:
    """Classifica em 'disponivel', 'vendido', 'reservado' ou 'outro'."""
    s = _normalizar(valor)
    if s in STATUS_DISPONIVEL or s.startswith("dispon"):
        return "disponivel"
    if s in STATUS_VENDIDO or s.startswith("vend"):
        return "vendido"
    if s in STATUS_RESERVADO or s.startswith("reserv"):
        return "reservado"
    return "outro"


def _percentual(parte: int, total: int) -> float:
    """Percentual de ``parte`` sobre ``total``, protegido contra divisão por zero."""
    return round(100 * parte / total, 1) if total else 0.0


def calcular_kpis(df: pd.DataFrame, col_unidade: str, col_valor: str, col_status: str) -> dict:
    """Calcula os KPIs de uma única tabela (visão atual)."""
    situacoes = df[col_status].apply(classificar_status)
    valores = pd.to_numeric(df[col_valor], errors="coerce").fillna(0)

    total = len(df)
    disponiveis = int((situacoes == "disponivel").sum())
    vendidas = int((situacoes == "vendido").sum())
    reservadas = int((situacoes == "reservado").sum())

    return {
        "total_unidades": total,
        "disponiveis": disponiveis,
        "vendidas": vendidas,
        "reservadas": reservadas,
        "pct_vendidas": _percentual(vendidas, total),
        "pct_disponiveis": _percentual(disponiveis, total),
        "vgv_total": float(valores.sum()),
        "vgv_disponivel": float(valores[situacoes == "disponivel"].sum()),
        "vgv_vendido": float(valores[situacoes == "vendido"].sum()),
        "ticket_medio": float(valores.mean()) if total else 0.0,
        "vso": _percentual(vendidas, total),  # Velocidade de Vendas
        "_situacoes": situacoes,
        "_valores": valores,
    }


def _unidades_que_passaram_a(
    comuns: list, status_anterior: pd.Series, status_atual: pd.Series, *, de: set[str], para: str
) -> list:
    """Unidades cujo status mudou de um conjunto ``de`` para o status ``para``."""
    return [
        u for u in comuns
        if status_atual.loc[u] == para and status_anterior.loc[u] in de
    ]


def _evolucao_de_preco(
    comuns: list, valor_anterior: pd.Series, valor_atual: pd.Series
) -> tuple[float, float]:
    """Aumento médio (%) e aumento total (R$) das unidades presentes em ambas."""
    variacoes_pct: list[float] = []
    diferenca_total = 0.0
    for u in comuns:
        antes, agora = valor_anterior.loc[u], valor_atual.loc[u]
        if pd.notna(antes) and pd.notna(agora) and antes != 0:
            variacoes_pct.append(100 * (agora - antes) / antes)
            diferenca_total += float(agora - antes)
    media = round(sum(variacoes_pct) / len(variacoes_pct), 2) if variacoes_pct else 0.0
    return media, round(diferenca_total, 2)


def comparar_tabelas_kpis(
    df_anterior: pd.DataFrame,
    df_atual: pd.DataFrame,
    col_unidade: str,
    col_valor: str,
    col_status: str,
) -> dict:
    """Compara a tabela anterior com a atual e calcula indicadores de movimento.

    Pressupõe que ``col_unidade``/``col_valor``/``col_status`` existem em ambas.
    """
    ant = df_anterior.set_index(col_unidade)
    atu = df_atual.set_index(col_unidade)

    status_ant = ant[col_status].apply(classificar_status)
    status_atu = atu[col_status].apply(classificar_status)
    valor_ant = pd.to_numeric(ant[col_valor], errors="coerce")
    valor_atu = pd.to_numeric(atu[col_valor], errors="coerce")

    chaves_ant, chaves_atu = set(ant.index), set(atu.index)
    comuns = sorted(chaves_ant & chaves_atu)

    vendidas = _unidades_que_passaram_a(
        comuns, status_ant, status_atu, de={"disponivel", "reservado"}, para="vendido"
    )
    retornaram = _unidades_que_passaram_a(
        comuns, status_ant, status_atu, de={"vendido", "reservado"}, para="disponivel"
    )
    aumento_medio_pct, aumento_total_rs = _evolucao_de_preco(comuns, valor_ant, valor_atu)

    novas = sorted(chaves_atu - chaves_ant)
    removidas = sorted(chaves_ant - chaves_atu)

    return {
        "vendidas_no_periodo": vendidas,
        "qtd_vendidas_no_periodo": len(vendidas),
        "retornaram_disponiveis": retornaram,
        "qtd_retornaram_disponiveis": len(retornaram),
        "novas_unidades": novas,
        "qtd_novas_unidades": len(novas),
        "unidades_removidas": removidas,
        "qtd_unidades_removidas": len(removidas),
        "aumento_medio_pct": aumento_medio_pct,
        "aumento_total_rs": aumento_total_rs,
        "qtd_comuns": len(comuns),
    }
