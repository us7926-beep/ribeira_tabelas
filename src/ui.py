"""Componentes HTML do design 'azul royal' (handoff TabLM.dc.html).

São blocos de SAÍDA (read-only) renderizados via ``st.markdown(..., unsafe_allow_html=True)``
e alimentados com dados reais. Inputs continuam em widgets nativos do Streamlit.
Cores, medidas e gradientes seguem exatamente o protótipo de design.
"""
from __future__ import annotations

CARD = (
    "background:#fff;border:1px solid #E5E9F2;border-radius:15px;"
    "padding:17px 18px;box-shadow:0 1px 3px rgba(20,40,90,.05);"
)
CARD_BIG = (
    "background:#fff;border:1px solid #E5E9F2;border-radius:16px;"
    "padding:22px;box-shadow:0 1px 3px rgba(20,40,90,.05);"
)
ROYAL_CARD = (
    "background:linear-gradient(160deg,#2347C5,#1A38A8);color:#fff;"
    "border-radius:16px;padding:22px;box-shadow:0 8px 22px rgba(35,71,197,.2);"
)


def moeda(valor: float | int | None) -> str:
    """Formata em reais sem casas: 9840 -> 'R$ 9.840'."""
    if valor is None:
        valor = 0
    return "R$ " + f"{float(valor):,.0f}".replace(",", ".")


def _grid(itens: str, colunas: int, margem: str = "0 0 14px") -> str:
    return (
        f'<div style="display:grid;grid-template-columns:repeat({colunas},1fr);'
        f'gap:14px;margin:{margem}">{itens}</div>'
    )


def kpi_cards(cards: list[dict]) -> str:
    """Cards de KPI simples. Cada card: {label, value, sub?}."""
    itens = "".join(
        f'<div style="{CARD}">'
        f'<div style="font-size:12.5px;color:#6B7689;font-weight:600">{c["label"]}</div>'
        f'<div style="font-size:25px;font-weight:800;color:#14203A;letter-spacing:-.5px;'
        f'margin-top:6px;font-variant-numeric:tabular-nums">{c["value"]}</div>'
        f'<div style="font-size:12.5px;color:#97A2B5;margin-top:3px">{c.get("sub", "")}</div></div>'
        for c in cards
    )
    return _grid(itens, len(cards))


def kpi_delta_cards(cards: list[dict]) -> str:
    """Cards com indicador ▲/▼. Cada card: {label, value, delta, dir: up|down|flat}."""
    cores = {"up": "#15A34A", "down": "#DC2626", "flat": "#97A2B5"}
    setas = {"up": "▲ ", "down": "▼ ", "flat": ""}
    blocos = []
    for c in cards:
        d = c.get("dir", "flat")
        valor_cor = "#2347C5" if d == "up" else "#14203A"
        blocos.append(
            f'<div style="{CARD}">'
            f'<div style="font-size:12.5px;color:#6B7689;font-weight:600">{c["label"]}</div>'
            f'<div style="font-size:24px;font-weight:800;letter-spacing:-.5px;margin-top:6px;'
            f'font-variant-numeric:tabular-nums;color:{valor_cor}">{c["value"]}</div>'
            f'<div style="font-size:12.5px;font-weight:700;margin-top:4px;color:{cores[d]}">'
            f'{setas[d]}{c.get("delta", "")}</div></div>'
        )
    return _grid("".join(blocos), len(cards))


def insights_card(itens: list[str]) -> str:
    """Card royal com bullets de insight."""
    linhas = "".join(
        '<div style="display:flex;gap:11px;font-size:13.5px;line-height:1.5;color:rgba(255,255,255,.92)">'
        '<span style="width:6px;height:6px;border-radius:50%;background:#fff;margin-top:7px;flex-shrink:0"></span>'
        f"<span>{i}</span></div>"
        for i in itens
    )
    return (
        f'<div style="{ROYAL_CARD}"><div style="font-size:16px;font-weight:700">Insights</div>'
        '<div style="font-size:12.5px;color:rgba(255,255,255,.66);margin-bottom:16px">'
        "Gerados a partir da base de mercado</div>"
        f'<div style="display:flex;flex-direction:column;gap:13px">{linhas}</div></div>'
    )


def barras_bairro(barras: list[dict]) -> str:
    """Barras horizontais de preço/m². Cada barra: {label, value, pct(0-100), ours}."""
    linhas = []
    for b in barras:
        cor = "#2347C5" if b["ours"] else "#B9C8EE"
        badge = (
            '<span style="font-size:10.5px;font-weight:700;color:#2347C5;background:#EAF0FE;'
            'padding:2px 7px;border-radius:20px;margin-left:6px">VOCÊ</span>'
            if b["ours"] else ""
        )
        linhas.append(
            '<div><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'
            f'<div style="font-size:13.5px;font-weight:600;color:#2C3850">{b["label"]}{badge}</div>'
            f'<div style="font-size:13.5px;font-weight:700;color:#14203A;font-variant-numeric:tabular-nums">{b["value"]}</div></div>'
            '<div style="height:10px;background:#EEF1F8;border-radius:6px;overflow:hidden">'
            f'<div style="height:100%;border-radius:6px;background:{cor};width:{b["pct"]:.0f}%"></div></div></div>'
        )
    return (
        f'<div style="{CARD_BIG}">'
        '<div style="font-size:16px;font-weight:700;color:#14203A">Preço/m² médio por bairro</div>'
        '<div style="font-size:13px;color:#97A2B5;margin-bottom:18px">Comparativo entre praças de atuação</div>'
        f'<div style="display:flex;flex-direction:column;gap:15px">{"".join(linhas)}</div></div>'
    )


def donut(legenda: list[dict], total: int, unidade: str = "unidades") -> str:
    """Rosca via conic-gradient. legenda: {label, value, pct(0-100), color} em ordem."""
    stops, acc = [], 0.0
    for seg in legenda:
        stops.append(f'{seg["color"]} {acc:.1f}% {acc + seg["pct"]:.1f}%')
        acc += seg["pct"]
    gradiente = ", ".join(stops) if stops else "#E5E9F2 0% 100%"
    itens = "".join(
        '<div style="display:flex;align-items:center;gap:10px">'
        f'<span style="width:11px;height:11px;border-radius:3px;background:{s["color"]};flex-shrink:0"></span>'
        f'<span style="font-size:13.5px;color:#2C3850;font-weight:600;flex:1">{s["label"]}</span>'
        f'<span style="font-size:13.5px;color:#14203A;font-weight:700;font-variant-numeric:tabular-nums">{s["value"]}</span></div>'
        for s in legenda
    )
    return (
        f'<div style="{CARD_BIG}">'
        '<div style="font-size:16px;font-weight:700;color:#14203A;margin-bottom:18px">Distribuição por situação</div>'
        '<div style="display:flex;align-items:center;gap:24px">'
        f'<div style="width:150px;height:150px;border-radius:50%;flex-shrink:0;background:conic-gradient({gradiente});'
        'display:flex;align-items:center;justify-content:center">'
        '<div style="width:96px;height:96px;border-radius:50%;background:#fff;display:flex;flex-direction:column;'
        'align-items:center;justify-content:center">'
        f'<div style="font-size:24px;font-weight:800;color:#14203A">{total}</div>'
        f'<div style="font-size:11.5px;color:#97A2B5">{unidade}</div></div></div>'
        f'<div style="display:flex;flex-direction:column;gap:13px;flex:1">{itens}</div></div></div>'
    )


def tabela(titulo: str, subtitulo: str, colunas: list[dict], linhas: list[list[str]]) -> str:
    """Tabela estilizada do design.

    ``colunas``: [{nome, align?}]. ``linhas``: lista de listas de HTML já formatado por célula.
    """
    grid_cols = " ".join(c.get("fr", "1fr") for c in colunas)
    head = "".join(
        f'<div style="padding:12px 16px;text-align:{c.get("align", "left")}">{c["nome"]}</div>'
        for c in colunas
    )
    corpo = []
    for linha in linhas:
        celulas = "".join(
            f'<div style="padding:13px 16px;text-align:{colunas[i].get("align", "left")};'
            'font-variant-numeric:tabular-nums">' + cel + "</div>"
            for i, cel in enumerate(linha)
        )
        corpo.append(
            f'<div style="display:grid;grid-template-columns:{grid_cols};border-top:1px solid #EDF0F6;'
            f'font-size:14px;align-items:center">{celulas}</div>'
        )
    cabecalho = (
        f'<div style="font-size:16px;font-weight:700;color:#14203A;margin-bottom:4px">{titulo}</div>'
        f'<div style="font-size:13px;color:#97A2B5;margin-bottom:16px">{subtitulo}</div>'
        if titulo else ""
    )
    return (
        f'<div style="{CARD_BIG}">{cabecalho}'
        '<div style="overflow:hidden;border:1px solid #EDF0F6;border-radius:12px">'
        f'<div style="display:grid;grid-template-columns:{grid_cols};background:#F6F8FC;font-size:12px;'
        f'font-weight:700;color:#6B7689;text-transform:uppercase;letter-spacing:.4px">{head}</div>'
        f'{"".join(corpo)}</div></div>'
    )


def histograma(titulo: str, subtitulo: str, barras: list[dict]) -> str:
    """Histograma de barras verticais (gradiente royal). barras: {pct(0-100), label}."""
    colunas = "".join(
        '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:8px;'
        'height:100%;justify-content:flex-end">'
        f'<div style="width:100%;border-radius:6px 6px 2px 2px;'
        f'background:linear-gradient(180deg,#2347C5,#4D6FE0);height:{b["pct"]:.0f}%"></div>'
        f'<div style="font-size:10.5px;color:#97A2B5;white-space:nowrap">{b["label"]}</div></div>'
        for b in barras
    )
    return (
        f'<div style="{CARD_BIG}">'
        f'<div style="font-size:16px;font-weight:700;color:#14203A">{titulo}</div>'
        f'<div style="font-size:13px;color:#97A2B5;margin-bottom:20px">{subtitulo}</div>'
        f'<div style="display:flex;align-items:flex-end;gap:10px;height:150px">{colunas}</div></div>'
    )


def eyebrow(texto: str) -> str:
    """Rótulo de seção (cinza, caixa alta) do design."""
    return (
        f'<div style="font-size:13px;font-weight:700;color:#6B7689;text-transform:uppercase;'
        f'letter-spacing:.6px;margin:6px 0 12px">{texto}</div>'
    )


def cartao_resumo(rotulo: str, valor: str, cor: str, borda: str) -> str:
    """Card-resumo (Adicionadas/Removidas/Alteradas) com borda colorida."""
    return (
        f'<div style="background:#fff;border:1px solid {borda};border-radius:15px;padding:18px 20px">'
        f'<div style="font-size:12.5px;font-weight:700;color:{cor};text-transform:uppercase;letter-spacing:.4px">{rotulo}</div>'
        f'<div style="font-size:32px;font-weight:800;color:{cor};margin-top:4px;font-variant-numeric:tabular-nums">{valor}</div></div>'
    )


def banner(texto: str, tom: str = "verde") -> str:
    """Banner de status (verde=ok, ambar=atencao)."""
    estilos = {
        "verde": ("#E9FBF0", "#BDEDCF", "#157A3D", "#15A34A"),
        "ambar": ("#FBF3DD", "#F0E0B4", "#8A6A1E", "#E0B23A"),
    }
    bg, bd, tx, dot = estilos.get(tom, estilos["verde"])
    return (
        f'<div style="display:flex;align-items:center;gap:9px;background:{bg};border:1px solid {bd};'
        f'color:{tx};border-radius:11px;padding:11px 15px;font-size:13.5px;font-weight:600;margin-bottom:20px">'
        f'<span style="width:8px;height:8px;border-radius:50%;background:{dot}"></span>{texto}</div>'
    )
