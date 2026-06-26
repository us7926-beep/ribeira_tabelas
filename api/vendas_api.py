"""KPIs de vendas no backend, reusando src/dashboard.py (módulo puro)."""
import re

import pandas as pd

from src import dashboard


def _detectar(df: pd.DataFrame, candidatos: list[str]) -> str | None:
    for coluna in df.columns:
        nome = str(coluna).lower()
        if any(chave in nome for chave in candidatos):
            return coluna
    return None


# Regex aplicada ao nome da unidade. Primeiro match vence (ordem importa).
_PADROES_NOME: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\bfgts\b", re.IGNORECASE), "FGTS"),
    (re.compile(r"\bmcmv\b|minha\s+casa|casa\s+verde", re.IGNORECASE), "MCMV"),
    (re.compile(r"\bsbpe\b", re.IGNORECASE), "SBPE"),
    (re.compile(r"\bsfh\b", re.IGNORECASE), "SFH"),
    (re.compile(r"\b(à|a)\s*vista\b|\bavista\b", re.IGNORECASE), "À vista"),
    (re.compile(r"financ", re.IGNORECASE), "Financiamento"),
]


def _inferir_modalidade_por_nome(valor: object) -> str | None:
    if valor is None:
        return None
    texto = str(valor)
    if not texto.strip():
        return None
    for padrao, rotulo in _PADROES_NOME:
        if padrao.search(texto):
            return rotulo
    return None


def _numero(v: object) -> float | None:
    if v is None:
        return None
    try:
        n = float(pd.to_numeric(v, errors="coerce"))
    except (TypeError, ValueError):
        return None
    if pd.isna(n):
        return None
    return n


def _inferir_modalidade_por_composicao(
    row: pd.Series,
    col_entrada: str | None,
    col_financ: str | None,
    col_subsidio: str | None,
    col_valor: str | None,
) -> str | None:
    """Classifica a linha pela composição do pagamento.

    Regras conservadoras (retorna None se ambíguo):
    - subsidio > 0  -> MCMV
    - financiamento > 0 e entrada < 25% do total -> Financiamento
    - só entrada (sem financ) -> À vista
    """
    subsidio = _numero(row.get(col_subsidio)) if col_subsidio else None
    if subsidio and subsidio > 0:
        return "MCMV"

    entrada = _numero(row.get(col_entrada)) if col_entrada else None
    financ = _numero(row.get(col_financ)) if col_financ else None
    total = _numero(row.get(col_valor)) if col_valor else None

    if financ is not None and financ > 0:
        if entrada is None or total is None or total <= 0:
            return "Financiamento"
        if entrada / total < 0.25:
            return "Financiamento"
        return None  # entrada alta + financ -> ambíguo

    if entrada is not None and entrada > 0 and (financ is None or financ == 0):
        if total is None or abs(entrada - total) / max(total, 1) < 0.15:
            return "À vista"
        return None

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
    Quando NÃO ha coluna explícita, tenta inferir por regex no nome da
    unidade (FGTS/MCMV/SBPE/SFH/À vista/Financiamento) com fallback na
    composição do pagamento (entrada/financiamento/subsidio).
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
            "modalidade_origem": "explicita" if col_modalidade else None,
        },
        # remove chaves internas (Series do pandas, não serializáveis em JSON)
        "kpis": {chave: valor for chave, valor in resultado.items() if not chave.startswith("_")},
    }

    if col_modalidade:
        saida["distribuicao"] = _agrupar_por_modalidade(
            df, col_status, col_valor, col_modalidade,
        )
    else:
        # Sem coluna dedicada: tenta inferir. Primeiro pelo nome da unidade,
        # depois pela composição. Cria uma série virtual e usa como col_modalidade
        # do agrupamento. Se nada inferido, mantém o comportamento antigo
        # (sem distribuicao no response).
        col_entrada = _detectar(df, ["entrada", "ato"])
        col_financ = _detectar(df, ["financ"])
        col_subsidio = _detectar(df, ["subsid", "subsídio"])

        def _classificar(row: pd.Series) -> str | None:
            por_nome = _inferir_modalidade_por_nome(row.get(col_unidade))
            if por_nome:
                return por_nome
            return _inferir_modalidade_por_composicao(
                row, col_entrada, col_financ, col_subsidio, col_valor,
            )

        inferida = df.apply(_classificar, axis=1)
        if inferida.notna().any():
            df = df.copy()
            df["__modalidade_inferida"] = inferida
            distribuicao = _agrupar_por_modalidade(
                df, col_status, col_valor, "__modalidade_inferida",
            )
            if distribuicao:
                saida["distribuicao"] = distribuicao
                saida["colunas"]["modalidade_origem"] = "inferida"

    return saida
