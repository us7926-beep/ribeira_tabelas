"""Inteligência de mercado e concorrência.

Cada tabela enviada (nossa ou de concorrente) é normalizada em linhas com um
conjunto fixo de colunas e marcada com metadados (tipo, incorporadora, produto,
cidade, bairro, padrão). A base acumulada permite comparar preço/m² e preço
total por dimensão e posicionar nossos produtos frente à concorrência.
"""
import pandas as pd

PADROES = ["Econômico", "Médio", "Médio-Alto", "Alto", "Altíssimo"]
TIPOS = ["Nosso", "Concorrente"]

# Ordem canônica das colunas da base normalizada.
COLUNAS_BASE = [
    "tipo", "incorporadora", "produto", "cidade", "bairro", "padrao",
    "unidade", "area", "valor", "preco_m2",
]

DIMENSOES = {
    "incorporadora": "Incorporadora",
    "produto": "Produto",
    "cidade": "Cidade",
    "bairro": "Bairro",
    "padrao": "Padrão",
    "tipo": "Tipo (nosso/concorrente)",
}


def base_vazia() -> pd.DataFrame:
    """DataFrame vazio com o schema da base de mercado."""
    return pd.DataFrame(columns=COLUNAS_BASE)


def normalizar_upload(
    df: pd.DataFrame,
    *,
    col_valor: str,
    col_area: str,
    col_unidade: str | None,
    tipo: str,
    incorporadora: str,
    produto: str,
    cidade: str,
    bairro: str,
    padrao: str,
) -> pd.DataFrame:
    """Converte uma planilha enviada em linhas padronizadas da base de mercado.

    Calcula ``preco_m2 = valor / area`` e descarta linhas sem valor numérico.
    """
    valor = pd.to_numeric(df[col_valor], errors="coerce")
    area = pd.to_numeric(df[col_area], errors="coerce")
    unidade = (
        df[col_unidade].astype(str)
        if col_unidade and col_unidade in df.columns
        else pd.Series(range(1, len(df) + 1), index=df.index).astype(str)
    )

    out = pd.DataFrame(
        {
            "tipo": tipo,
            "incorporadora": incorporadora,
            "produto": produto,
            "cidade": cidade,
            "bairro": bairro,
            "padrao": padrao,
            "unidade": unidade,
            "area": area,
            "valor": valor,
        }
    )
    out["preco_m2"] = out["valor"] / out["area"]
    out = out[out["valor"].notna()].reset_index(drop=True)
    return out[COLUNAS_BASE]


def adicionar_a_base(base: pd.DataFrame, novo: pd.DataFrame) -> pd.DataFrame:
    """Concatena ``novo`` à ``base`` preservando o schema."""
    if base is None or base.empty:
        return novo.reset_index(drop=True)
    return pd.concat([base, novo], ignore_index=True)


def _media(serie: pd.Series) -> float | None:
    """Média ignorando NaN; None quando não há dados."""
    valor = pd.to_numeric(serie, errors="coerce").mean()
    return round(float(valor), 2) if pd.notna(valor) else None


def kpis_gerais(base: pd.DataFrame) -> dict:
    """KPIs de topo da base de mercado (nossos vs concorrentes)."""
    nossos = base[base["tipo"] == "Nosso"]
    concorrentes = base[base["tipo"] == "Concorrente"]
    return {
        "total_unidades": len(base),
        "incorporadoras": int(base["incorporadora"].nunique()),
        "produtos": int(base["produto"].nunique()),
        "cidades": int(base["cidade"].nunique()),
        "preco_m2_medio": _media(base["preco_m2"]),
        "preco_m2_nosso": _media(nossos["preco_m2"]),
        "preco_m2_concorrentes": _media(concorrentes["preco_m2"]),
        "ticket_medio": _media(base["valor"]),
        "vgv_total": float(pd.to_numeric(base["valor"], errors="coerce").sum()),
    }


def comparar_por_dimensao(base: pd.DataFrame, dimensao: str) -> pd.DataFrame:
    """Agrega a base por uma dimensão, com preço/m², ticket, VGV e contagem."""
    agregado = (
        base.groupby(dimensao)
        .agg(
            unidades=("valor", "size"),
            preco_m2_medio=("preco_m2", "mean"),
            ticket_medio=("valor", "mean"),
            vgv=("valor", "sum"),
        )
        .reset_index()
    )
    for coluna in ("preco_m2_medio", "ticket_medio", "vgv"):
        agregado[coluna] = agregado[coluna].round(2)
    return agregado.sort_values("preco_m2_medio", ascending=False).reset_index(drop=True)


def posicionamento_por_padrao(base: pd.DataFrame) -> pd.DataFrame:
    """Para cada padrão, compara o preço/m² nosso com o da concorrência.

    ``dif_pct`` é quanto o nosso preço/m² está acima (+) ou abaixo (-) do
    preço/m² médio dos concorrentes no mesmo padrão.
    """
    linhas = []
    for padrao in [p for p in PADROES if p in set(base["padrao"])]:
        sub = base[base["padrao"] == padrao]
        nosso = _media(sub[sub["tipo"] == "Nosso"]["preco_m2"])
        concorrentes = _media(sub[sub["tipo"] == "Concorrente"]["preco_m2"])
        dif_pct = (
            round(100 * (nosso - concorrentes) / concorrentes, 1)
            if nosso is not None and concorrentes
            else None
        )
        linhas.append(
            {
                "padrao": padrao,
                "preco_m2_nosso": nosso,
                "preco_m2_concorrentes": concorrentes,
                "dif_pct": dif_pct,
            }
        )
    return pd.DataFrame(linhas)


def gerar_insights(base: pd.DataFrame) -> list[str]:
    """Frases curtas de insight automático sobre a base atual."""
    insights: list[str] = []
    if base.empty:
        return insights

    kpis = kpis_gerais(base)
    nosso, conc = kpis["preco_m2_nosso"], kpis["preco_m2_concorrentes"]
    if nosso is not None and conc:
        dif = round(100 * (nosso - conc) / conc, 1)
        if dif > 0:
            insights.append(f"Nosso preço/m² está **{dif}% acima** da média dos concorrentes.")
        elif dif < 0:
            insights.append(f"Nosso preço/m² está **{abs(dif)}% abaixo** da média dos concorrentes.")
        else:
            insights.append("Nosso preço/m² está **na média** dos concorrentes.")

    por_inc = comparar_por_dimensao(base, "incorporadora")
    if len(por_inc) >= 1 and pd.notna(por_inc.iloc[0]["preco_m2_medio"]):
        topo = por_inc.iloc[0]
        insights.append(
            f"Maior preço/m² médio: **{topo['incorporadora']}** "
            f"(R$ {topo['preco_m2_medio']:,.0f}/m²)."
        )

    por_bairro = comparar_por_dimensao(base, "bairro")
    if len(por_bairro) >= 1 and pd.notna(por_bairro.iloc[0]["preco_m2_medio"]):
        topo_b = por_bairro.iloc[0]
        insights.append(
            f"Bairro mais valorizado (preço/m²): **{topo_b['bairro']}** "
            f"(R$ {topo_b['preco_m2_medio']:,.0f}/m²)."
        )
    return insights
