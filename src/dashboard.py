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


def _normalizar(texto) -> str:
    """Remove acentos, espaços e caixa para comparar status de forma robusta."""
    s = str(texto).strip().lower()
    s = "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))
    return s


def classificar_status(valor) -> str:
    """Classifica um valor de status em 'disponivel', 'vendido', 'reservado' ou 'outro'."""
    s = _normalizar(valor)
    if s in STATUS_DISPONIVEL or s.startswith("dispon"):
        return "disponivel"
    if s in STATUS_VENDIDO or s.startswith("vend"):
        return "vendido"
    if s in STATUS_RESERVADO or s.startswith("reserv"):
        return "reservado"
    return "outro"


def calcular_kpis(df: pd.DataFrame, col_unidade: str, col_valor: str, col_status: str) -> dict:
    """Calcula os KPIs de uma única tabela (visão atual)."""
    situacoes = df[col_status].apply(classificar_status)
    valores = pd.to_numeric(df[col_valor], errors="coerce").fillna(0)

    total = len(df)
    disponiveis = int((situacoes == "disponivel").sum())
    vendidas = int((situacoes == "vendido").sum())
    reservadas = int((situacoes == "reservado").sum())

    vgv_total = float(valores.sum())
    vgv_disponivel = float(valores[situacoes == "disponivel"].sum())
    vgv_vendido = float(valores[situacoes == "vendido"].sum())
    ticket_medio = float(valores.mean()) if total else 0.0

    return {
        "total_unidades": total,
        "disponiveis": disponiveis,
        "vendidas": vendidas,
        "reservadas": reservadas,
        "pct_vendidas": round(100 * vendidas / total, 1) if total else 0.0,
        "pct_disponiveis": round(100 * disponiveis / total, 1) if total else 0.0,
        "vgv_total": vgv_total,
        "vgv_disponivel": vgv_disponivel,
        "vgv_vendido": vgv_vendido,
        "ticket_medio": ticket_medio,
        "vso": round(100 * vendidas / total, 1) if total else 0.0,  # Velocidade de Vendas
        "_situacoes": situacoes,
        "_valores": valores,
    }


def comparar_tabelas_kpis(
    df_anterior: pd.DataFrame,
    df_atual: pd.DataFrame,
    col_unidade: str,
    col_valor: str,
    col_status: str,
) -> dict:
    """Compara a tabela anterior com a atual e calcula indicadores de movimento.

    Pressupõe que ``col_unidade``/``col_valor``/``col_status`` existem em ambas
    as tabelas (mesmos nomes de coluna).
    """
    ant = df_anterior.set_index(col_unidade)
    atu = df_atual.set_index(col_unidade)

    status_ant = ant[col_status].apply(classificar_status)
    status_atu = atu[col_status].apply(classificar_status)
    valor_ant = pd.to_numeric(ant[col_valor], errors="coerce")
    valor_atu = pd.to_numeric(atu[col_valor], errors="coerce")

    chaves_ant = set(ant.index)
    chaves_atu = set(atu.index)
    comuns = sorted(chaves_ant & chaves_atu)

    # Movimento de status entre as duas tabelas
    vendidas_no_periodo = []   # estavam disponíveis/reservadas, agora vendidas
    retornaram_disponiveis = []  # estavam vendidas/reservadas, agora disponíveis
    for u in comuns:
        antes = status_ant.loc[u]
        agora = status_atu.loc[u]
        if agora == "vendido" and antes in {"disponivel", "reservado"}:
            vendidas_no_periodo.append(u)
        if agora == "disponivel" and antes in {"vendido", "reservado"}:
            retornaram_disponiveis.append(u)

    # Evolução de preço nas unidades comuns
    variacoes_pct = []
    diff_total = 0.0
    for u in comuns:
        va, vn = valor_ant.loc[u], valor_atu.loc[u]
        if pd.notna(va) and pd.notna(vn) and va != 0:
            variacoes_pct.append(100 * (vn - va) / va)
            diff_total += float(vn - va)

    aumento_medio_pct = round(sum(variacoes_pct) / len(variacoes_pct), 2) if variacoes_pct else 0.0

    return {
        "vendidas_no_periodo": vendidas_no_periodo,
        "qtd_vendidas_no_periodo": len(vendidas_no_periodo),
        "retornaram_disponiveis": retornaram_disponiveis,
        "qtd_retornaram_disponiveis": len(retornaram_disponiveis),
        "novas_unidades": sorted(chaves_atu - chaves_ant),
        "qtd_novas_unidades": len(chaves_atu - chaves_ant),
        "unidades_removidas": sorted(chaves_ant - chaves_atu),
        "qtd_unidades_removidas": len(chaves_ant - chaves_atu),
        "aumento_medio_pct": aumento_medio_pct,
        "aumento_total_rs": round(diff_total, 2),
        "qtd_comuns": len(comuns),
    }
