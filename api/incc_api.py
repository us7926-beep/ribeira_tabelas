"""Reajuste por INCC-DI no backend (BCB SGS série 192), sem acoplamento ao Streamlit.

A fonte oficial gratuita é o SGS do Banco Central, série 192 = INCC-DI (FGV) —
confere com a FGV/SindusCon. NÃO usar 7456 (INCC-M, de Mercado).
"""
from datetime import date
from decimal import Decimal, getcontext

import pandas as pd
import requests

getcontext().prec = 16

URL_BCB = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.192/dados"
_TIMEOUT = 15


def _decimal(valor) -> Decimal:
    """Converte para Decimal tolerando R$, milhar com ponto e decimal com vírgula."""
    if isinstance(valor, Decimal):
        return valor
    texto = str(valor).replace("R$", "").replace(" ", "").strip()
    if "," in texto:  # formato BR: ponto = milhar, vírgula = decimal
        texto = texto.replace(".", "").replace(",", ".")
    return Decimal(texto)


def _competencia(data_ddmmaaaa: str) -> str:
    _, mes, ano = data_ddmmaaaa.split("/")
    return f"{ano}-{mes}"


def variacoes_recentes(meses: int = 18) -> list[dict]:
    """Variações % mensais do INCC-DI dos últimos `meses`, mais recente primeiro."""
    hoje = date.today()
    inicial = date(hoje.year - 3, 1, 1)
    resposta = requests.get(
        URL_BCB,
        params={
            "formato": "json",
            "dataInicial": inicial.strftime("%d/%m/%Y"),
            "dataFinal": hoje.strftime("%d/%m/%Y"),
        },
        timeout=_TIMEOUT,
    )
    resposta.raise_for_status()
    try:
        registros = resposta.json() or []
    except Exception as exc:
        raise RuntimeError(f"Resposta do BCB inválida (não-JSON): {exc}") from exc
    itens = [
        {"competencia": _competencia(r["data"]), "variacao": float(_decimal(r["valor"]))}
        for r in registros
    ]
    return list(reversed(itens))[:meses]


def _detectar_valor(df: pd.DataFrame) -> str | None:
    for coluna in df.columns:
        nome = str(coluna).lower()
        if any(chave in nome for chave in ["valor", "preço", "preco", "r$"]):
            return coluna
    return None


def reajustar(
    df: pd.DataFrame,
    variacao_pct: float,
    extra_pct: float = 0.0,
    extra_valor: float = 0.0,
) -> dict:
    """Aplica (1 + (INCC% + extra%)/100) * valor + extra_R$ na coluna de valor detectada."""
    coluna = _detectar_valor(df)
    if not coluna:
        raise ValueError("Não identifiquei a coluna de valor (procuro 'valor'/'preço'/'R$').")

    pct_total = _decimal(variacao_pct) + _decimal(extra_pct)
    bruto = _decimal(extra_valor)

    def aplica(valor):
        try:
            base = _decimal(valor)
        except Exception:  # noqa: BLE001 — célula não numérica
            return None
        reajustado = base * (Decimal("1") + pct_total / Decimal("100")) + bruto
        return float(reajustado.quantize(Decimal("0.01")))

    resultado = df.copy()
    resultado["valor_reajustado"] = resultado[coluna].apply(aplica)
    registros = resultado.where(pd.notnull(resultado), None).to_dict("records")
    return {
        "coluna_valor": str(coluna),
        "percentual_total": float(pct_total),
        "linhas": int(len(resultado)),
        "registros": registros,
    }
