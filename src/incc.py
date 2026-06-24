"""Reajuste de valores por índice INCC com precisão Decimal.

A FGV não disponibiliza uma API pública própria para o INCC-DI. A fonte
oficial gratuita e sem necessidade de chave de acesso é o SGS (Sistema
Gerenciador de Séries Temporais) do Banco Central, que redistribui a série
do INCC-DI calculada pela FGV sob o código 7456 (variação % mensal):

    https://api.bcb.gov.br/dados/serie/bcdata.sgs.7456/dados?formato=json

``INDICES_EXEMPLO`` continua disponível como placeholder ilustrativo para
testes quando a API estiver fora do ar ou para uso offline — NÃO usar para
reajustes reais de contrato nesse caso.
"""
from decimal import Decimal, getcontext
from io import BytesIO

import pandas as pd
import requests
import streamlit as st

getcontext().prec = 16

URL_BCB_SGS_INCC_DI = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.{serie}/dados"
SERIE_INCC_DI = 7456  # INCC-DI (FGV), variação % mensal, via BCB SGS

INDICES_EXEMPLO: dict[str, Decimal] = {
    "2023-01": Decimal("850.00"),
    "2023-06": Decimal("870.50"),
    "2024-01": Decimal("905.30"),
    "2024-06": Decimal("930.10"),
    "2025-01": Decimal("960.75"),
}


@st.cache_data(show_spinner=False, ttl=86400)
def buscar_indices_incc_di(data_inicial: str, data_final: str) -> dict[str, Decimal]:
    """Busca o índice INCC-DI oficial (FGV) via API do Banco Central (SGS).

    ``data_inicial``/``data_final`` no formato "DD/MM/AAAA". Retorna um
    índice acumulado (base 100 na primeira competência do período) por
    competência "AAAA-MM", já calculado em Decimal a partir das variações
    percentuais mensais publicadas pelo BCB.
    """
    url = URL_BCB_SGS_INCC_DI.format(serie=SERIE_INCC_DI)
    params = {"formato": "json", "dataInicial": data_inicial, "dataFinal": data_final}

    resposta = requests.get(url, params=params, timeout=15)
    if resposta.status_code == 404:
        raise ValueError(
            "A API do BCB não tem dados do INCC-DI para esse período. "
            "Escolha um intervalo que inclua meses já publicados "
            "(ex.: 01/01/2023 até hoje)."
        )
    resposta.raise_for_status()
    dados = resposta.json()

    if not dados:
        raise ValueError("A API do BCB não retornou dados para o período informado.")

    indices: dict[str, Decimal] = {}
    acumulado = Decimal("100")
    for item in dados:
        dia, mes, ano = item["data"].split("/")
        variacao_pct = Decimal(str(item["valor"]).replace(",", "."))
        acumulado = acumulado * (Decimal("1") + variacao_pct / Decimal("100"))
        indices[f"{ano}-{mes}"] = acumulado.quantize(Decimal("0.0001"))

    return indices


def _para_decimal(valor) -> Decimal:
    if isinstance(valor, Decimal):
        return valor
    return Decimal(str(valor))


def fator_reajuste(indice_inicial, indice_final) -> Decimal:
    """Calcula o fator de reajuste = índice_final / índice_inicial, em Decimal."""
    inicial = _para_decimal(indice_inicial)
    final = _para_decimal(indice_final)
    if inicial == 0:
        raise ValueError("Índice inicial não pode ser zero.")
    return final / inicial


def reajustar_valor(valor, indice_inicial, indice_final) -> Decimal:
    """Aplica o reajuste por INCC a um valor monetário, preservando precisão Decimal."""
    base = _para_decimal(valor)
    fator = fator_reajuste(indice_inicial, indice_final)
    return (base * fator).quantize(Decimal("0.01"))


@st.cache_data(show_spinner=False)
def carregar_indices_csv(conteudo_bytes: bytes) -> dict[str, Decimal]:
    """Carrega uma tabela de índices INCC a partir de um CSV (colunas: competencia, indice)."""
    df = pd.read_csv(BytesIO(conteudo_bytes))
    df.columns = [c.strip().lower() for c in df.columns]
    return {
        str(row["competencia"]): Decimal(str(row["indice"]))
        for _, row in df.iterrows()
    }


def reajustar_tabela(df: pd.DataFrame, coluna_valor: str, indice_inicial, indice_final) -> pd.DataFrame:
    """Aplica o reajuste a uma coluna de valores de um DataFrame, retornando cópia com coluna nova."""
    resultado = df.copy()
    resultado[f"{coluna_valor}_reajustado"] = resultado[coluna_valor].apply(
        lambda v: float(reajustar_valor(v, indice_inicial, indice_final))
    )
    return resultado
