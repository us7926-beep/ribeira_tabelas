"""Reajuste de valores por índice INCC com precisão Decimal.

A FGV não disponibiliza uma API pública própria para o INCC-DI. A fonte
oficial gratuita e sem necessidade de chave de acesso é o SGS (Sistema
Gerenciador de Séries Temporais) do Banco Central, que redistribui a série
do INCC-DI calculada pela FGV sob o código 192 (variação % mensal). Os
valores batem exatamente com a tabela oficial da FGV/SindusCon. (A série
7456 é uma variante diferente — INCC-M, de Mercado — e NÃO deve ser usada.)

    https://api.bcb.gov.br/dados/serie/bcdata.sgs.192/dados?formato=json

``INDICES_EXEMPLO`` continua disponível como placeholder ilustrativo para
testes quando a API estiver fora do ar ou para uso offline — NÃO usar para
reajustes reais de contrato nesse caso.
"""
from decimal import Decimal, getcontext
from io import BytesIO
from typing import Callable

import pandas as pd
import requests
import streamlit as st

getcontext().prec = 16

# Aceito por todas as funções de cálculo monetário (number_input devolve float,
# a API devolve str, e internamente trabalhamos com Decimal).
Numerico = Decimal | int | float | str

URL_BCB_SGS = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.{serie}/dados"
SERIE_INCC_DI = 192  # INCC-DI (FGV) — confere com a FGV/SindusCon. NÃO usar 7456 (INCC-M).
_TIMEOUT_BCB_SEGUNDOS = 15
_CACHE_TTL_SEGUNDOS = 86_400  # 24h

# Mensagens centralizadas (antes estavam duplicadas em cada função de busca).
_ERRO_PERIODO_SEM_DADOS = (
    "A API do BCB não tem dados do INCC-DI para esse período. "
    "Escolha um intervalo que inclua meses já publicados (ex.: 01/01/2023 até hoje)."
)
_ERRO_RETORNO_VAZIO = "A API do BCB não retornou dados para o período informado."

INDICES_EXEMPLO: dict[str, Decimal] = {
    "2023-01": Decimal("850.00"),
    "2023-06": Decimal("870.50"),
    "2024-01": Decimal("905.30"),
    "2024-06": Decimal("930.10"),
    "2025-01": Decimal("960.75"),
}


# --------------------------------------------------------------------------- #
# Helpers privados (definidos antes do uso, para leitura top-down)
# --------------------------------------------------------------------------- #
def _para_decimal(valor: Numerico) -> Decimal:
    """Converte número ou string para Decimal, tolerando vírgula decimal."""
    if isinstance(valor, Decimal):
        return valor
    return Decimal(str(valor).replace(",", "."))


def _competencia(data_ddmmaaaa: str) -> str:
    """Converte a data do BCB ('DD/MM/AAAA') na competência 'AAAA-MM'."""
    _, mes, ano = data_ddmmaaaa.split("/")
    return f"{ano}-{mes}"


def _consultar_serie_incc_di(data_inicial: str, data_final: str) -> list[dict]:
    """Consulta a série do INCC-DI no SGS do BCB e devolve os registros brutos.

    Centraliza a chamada HTTP e o tratamento de erro que antes estava
    duplicado em ``buscar_indices_incc_di`` e ``buscar_variacoes_incc_di``.
    Levanta ``ValueError`` com mensagem amigável quando o período não tem dados.
    """
    resposta = requests.get(
        URL_BCB_SGS.format(serie=SERIE_INCC_DI),
        params={"formato": "json", "dataInicial": data_inicial, "dataFinal": data_final},
        timeout=_TIMEOUT_BCB_SEGUNDOS,
    )
    if resposta.status_code == 404:
        raise ValueError(_ERRO_PERIODO_SEM_DADOS)
    resposta.raise_for_status()

    registros: list[dict] = resposta.json()
    if not registros:
        raise ValueError(_ERRO_RETORNO_VAZIO)
    return registros


def _aplicar_em_coluna(
    df: pd.DataFrame, coluna_valor: str, reajuste: Callable[[Numerico], float]
) -> pd.DataFrame:
    """Cria '<coluna>_reajustado' aplicando ``reajuste`` sem mutar o original."""
    resultado = df.copy()
    resultado[f"{coluna_valor}_reajustado"] = resultado[coluna_valor].apply(reajuste)
    return resultado


# --------------------------------------------------------------------------- #
# Busca de índices na API do BCB
# --------------------------------------------------------------------------- #
@st.cache_data(show_spinner=False, ttl=_CACHE_TTL_SEGUNDOS)
def buscar_indices_incc_di(data_inicial: str, data_final: str) -> dict[str, Decimal]:
    """Índice INCC-DI acumulado (base 100 na 1ª competência), por 'AAAA-MM'.

    Datas no formato 'DD/MM/AAAA'. Útil para reajuste entre duas competências.
    """
    indices: dict[str, Decimal] = {}
    acumulado = Decimal("100")
    for registro in _consultar_serie_incc_di(data_inicial, data_final):
        acumulado *= Decimal("1") + _para_decimal(registro["valor"]) / Decimal("100")
        indices[_competencia(registro["data"])] = acumulado.quantize(Decimal("0.0001"))
    return indices


@st.cache_data(show_spinner=False, ttl=_CACHE_TTL_SEGUNDOS)
def buscar_variacoes_incc_di(data_inicial: str, data_final: str) -> dict[str, Decimal]:
    """Variação percentual MENSAL do INCC-DI por competência 'AAAA-MM'.

    É o número aplicado diretamente sobre os valores das unidades (ex.: 0.88).
    Datas no formato 'DD/MM/AAAA'.
    """
    return {
        _competencia(registro["data"]): _para_decimal(registro["valor"])
        for registro in _consultar_serie_incc_di(data_inicial, data_final)
    }


@st.cache_data(show_spinner=False)
def carregar_indices_csv(conteudo_bytes: bytes) -> dict[str, Decimal]:
    """Carrega índices INCC de um CSV (colunas: competencia, indice)."""
    df = pd.read_csv(BytesIO(conteudo_bytes))
    df.columns = [c.strip().lower() for c in df.columns]
    return {
        str(row["competencia"]): Decimal(str(row["indice"]))
        for _, row in df.iterrows()
    }


# --------------------------------------------------------------------------- #
# Reajuste por variação mensal (fluxo atual do app)
# --------------------------------------------------------------------------- #
def reajustar_valor_mensal(
    valor: Numerico, percentual_total: Numerico, valor_bruto: Numerico = 0
) -> Decimal:
    """Reajusta um valor: ``valor * (1 + percentual_total/100) + valor_bruto``.

    ``percentual_total`` é o INCC do mês somado a qualquer % adicional;
    ``valor_bruto`` é um acréscimo fixo em reais por unidade.
    """
    base = _para_decimal(valor)
    pct = _para_decimal(percentual_total)
    bruto = _para_decimal(valor_bruto)
    return (base * (Decimal("1") + pct / Decimal("100")) + bruto).quantize(Decimal("0.01"))


def reajustar_tabela_mensal(
    df: pd.DataFrame,
    coluna_valor: str,
    percentual_total: Numerico,
    valor_bruto: Numerico = 0,
) -> pd.DataFrame:
    """Aplica ``reajustar_valor_mensal`` a uma coluna, retornando cópia."""
    return _aplicar_em_coluna(
        df,
        coluna_valor,
        lambda v: float(reajustar_valor_mensal(v, percentual_total, valor_bruto)),
    )


# --------------------------------------------------------------------------- #
# Reajuste por fator entre dois índices (acumulado)
# --------------------------------------------------------------------------- #
def fator_reajuste(indice_inicial: Numerico, indice_final: Numerico) -> Decimal:
    """Fator de reajuste = índice_final / índice_inicial, em Decimal."""
    inicial = _para_decimal(indice_inicial)
    final = _para_decimal(indice_final)
    if inicial == 0:
        raise ValueError("Índice inicial não pode ser zero.")
    return final / inicial


def reajustar_valor(valor: Numerico, indice_inicial: Numerico, indice_final: Numerico) -> Decimal:
    """Reajusta um valor pelo fator entre dois índices, preservando Decimal."""
    base = _para_decimal(valor)
    return (base * fator_reajuste(indice_inicial, indice_final)).quantize(Decimal("0.01"))


def reajustar_tabela(
    df: pd.DataFrame, coluna_valor: str, indice_inicial: Numerico, indice_final: Numerico
) -> pd.DataFrame:
    """Aplica ``reajustar_valor`` a uma coluna, retornando cópia com coluna nova."""
    return _aplicar_em_coluna(
        df,
        coluna_valor,
        lambda v: float(reajustar_valor(v, indice_inicial, indice_final)),
    )
