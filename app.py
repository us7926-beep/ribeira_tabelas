"""TabLM — app Streamlit com login, inteligência de mercado, dashboards,
detecção de padrão, comparação de versões e reajuste por INCC.

UI: menu lateral retrátil (streamlit-option-menu), tema claro/escuro e estilo
com cards. A navegação seleciona qual ``render_*`` é chamada.
"""
from datetime import date, datetime
from decimal import Decimal
from io import BytesIO

import pandas as pd
import plotly.io as pio
import streamlit as st

from src.auth import fazer_logout, get_cookie_manager, usuario_atual, verificar_login
from src.extracao import CAMPOS_FICHA, extrair_ficha, ficha_vazia, ia_configurada
from src.supabase_store import limpar_base, listar_fichas, salvar_ficha, supabase_configurado
from src.comparador import comparar_versoes
from src.dashboard import calcular_kpis, comparar_tabelas_kpis
from src.detector import detectar_padrao
from src.incc import SERIE_INCC_DI, buscar_variacoes_incc_di, reajustar_tabela_mensal
from src.mercado import (
    PADROES,
    TIPOS,
    adicionar_a_base,
    base_vazia,
    comparar_por_dimensao,
    gerar_insights,
    kpis_gerais,
    normalizar_upload,
    posicionamento_por_padrao,
)
from src.mercado_store import obter_base, persistir, sheets_configurado
from src.pdf_extract import extrair_tabelas_pdf
from src.utils import gerar_pdf_executivo, ler_planilha
from src import ui

st.set_page_config(
    page_title="TabLM", page_icon="📊", layout="wide", initial_sidebar_state="expanded"
)


# --------------------------------------------------------------------------- #
# Identidade visual (design handoff "azul royal") — tema único royal + branco
# --------------------------------------------------------------------------- #
def injetar_estilo() -> None:
    """Injeta o CSS do design (fontes, paleta royal, cards, sidebar, login)."""
    pio.templates.default = "plotly_white"
    st.markdown(
        """
        <style>
        @import url('https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&display=swap');
        :root{
          --royal:#2347C5; --royal-hover:#1C3BAE; --royal-light:#EAF0FE;
          --t-title:#14203A; --t-body:#2C3850; --t-sec:#6B7689; --t-ter:#97A2B5;
          --bg:#F4F6FB; --card:#FFFFFF; --border:#E5E9F2;
        }
        html, body, .stApp, [data-testid="stSidebar"], .stMarkdown, input, button, textarea {
          font-family:'Hanken Grotesk', system-ui, sans-serif;
        }
        /* preserva os ícones Material do Streamlit (senão aparece o NOME do ícone como texto) */
        [data-testid="stIconMaterial"], span.material-icons, span[class*="material-symbols"]{
          font-family:'Material Symbols Rounded','Material Symbols Outlined','Material Icons' !important;
        }
        .stApp{ background:var(--bg); color:var(--t-body); }
        [data-testid="stHeader"]{ background:transparent; }
        .block-container{ max-width:1160px; padding:2.1rem 2.4rem 3rem; }
        h1,h2,h3,h4{ color:var(--t-title); font-weight:800; letter-spacing:-.4px; }
        /* texto escuro só na área principal (não na sidebar royal) */
        [data-testid="stMain"] p, [data-testid="stMain"] span,
        [data-testid="stMain"] label, [data-testid="stMain"] li{ color:var(--t-body); }
        /* métricas como cards */
        [data-testid="stMetric"]{
          background:var(--card); border:1px solid var(--border); border-radius:15px;
          padding:16px 20px; box-shadow:0 1px 3px rgba(20,40,90,.05);
        }
        [data-testid="stMetricValue"]{ color:var(--royal); font-weight:800; font-variant-numeric:tabular-nums; }
        [data-testid="stMetricLabel"] p{ color:var(--t-sec); font-weight:600; font-size:13px; }
        [data-testid="stMetricDelta"]{ font-weight:700; }
        /* botões */
        .stButton>button, .stDownloadButton>button{
          border-radius:11px; font-weight:600; border:1px solid var(--border); color:var(--t-body);
        }
        .stButton>button[kind="primary"], button[kind="primaryFormSubmit"]{
          background:var(--royal); color:#fff; border:none; box-shadow:0 6px 16px rgba(35,71,197,.28);
        }
        .stButton>button[kind="primary"]:hover, button[kind="primaryFormSubmit"]:hover{ background:var(--royal-hover); }
        /* inputs / upload / tabelas */
        .stTextInput input, [data-baseweb="select"]>div{ border-radius:12px !important; }
        [data-testid="stFileUploaderDropzone"]{
          border:1.5px dashed var(--border); border-radius:14px; background:var(--card);
        }
        [data-testid="stDataFrame"]{ border:1px solid var(--border); border-radius:14px; }
        /* sub-abas como segmented control royal */
        [data-testid="stMain"] div[data-baseweb="tab-list"]{
          background:var(--card); border:1px solid var(--border); border-radius:12px;
          padding:4px; gap:3px; }
        [data-testid="stMain"] div[data-baseweb="tab-list"] button[data-baseweb="tab"]{
          border-radius:9px; padding:6px 14px; }
        [data-testid="stMain"] button[data-baseweb="tab"][aria-selected="true"]{
          background:var(--royal); }
        [data-testid="stMain"] button[data-baseweb="tab"][aria-selected="true"] p{ color:#fff !important; font-weight:700; }
        [data-testid="stMain"] div[data-baseweb="tab-highlight"],
        [data-testid="stMain"] div[data-baseweb="tab-border"]{ display:none; }
        /* cabeçalho de página */
        .tablm-head{ margin-bottom:.7rem; animation:rise .34s cubic-bezier(.2,.7,.3,1); }
        .tablm-head .eyebrow{ color:var(--royal); font-weight:700; text-transform:uppercase;
          letter-spacing:1.6px; font-size:12.5px; }
        .tablm-head h1{ font-size:30px; font-weight:800; letter-spacing:-.7px; margin:.15rem 0 .2rem; color:var(--t-title); }
        .tablm-head p{ color:var(--t-sec); font-size:15px; margin:0; }
        @keyframes rise{ from{ transform:translateY(7px); } to{ transform:translateY(0); } }

        /* ===== sidebar royal ===== */
        [data-testid="stSidebar"]{ background:linear-gradient(180deg,#1F40BC,#102678); border-right:none; }
        [data-testid="stSidebar"] *{ color:#fff; }
        .sb-brand{ display:flex; align-items:center; gap:11px; padding:4px 2px 2px; }
        .sb-logo{ width:36px;height:36px;border-radius:11px;background:#fff;color:#2347C5;
          font-weight:800;font-size:18px;display:flex;align-items:center;justify-content:center; }
        .sb-brand b{ font-size:17px; line-height:1; }
        .sb-brand small{ color:rgba(255,255,255,.7); font-size:11.5px; }
        .sb-eyebrow{ color:rgba(255,255,255,.55); font-weight:700; text-transform:uppercase;
          letter-spacing:1.5px; font-size:11px; margin:18px 2px 6px; }
        [data-testid="stSidebar"] [role="radiogroup"]{ gap:3px; }
        [data-testid="stSidebar"] [role="radiogroup"] label{
          padding:10px 13px; border-radius:11px; width:100%; transition:background .15s; }
        [data-testid="stSidebar"] [role="radiogroup"] label p{ color:rgba(255,255,255,.82) !important; font-weight:600; }
        [data-testid="stSidebar"] [role="radiogroup"] label:hover{ background:rgba(255,255,255,.08); }
        [data-testid="stSidebar"] [role="radiogroup"] label:has(input:checked){ background:rgba(255,255,255,.18); }
        [data-testid="stSidebar"] [role="radiogroup"] label:has(input:checked) p{ color:#fff !important; font-weight:700; }
        [data-testid="stSidebar"] [role="radiogroup"] label>div:first-child{ display:none; }
        [data-testid="stSidebar"] .stButton>button{
          background:rgba(255,255,255,.12); color:#fff; border:1px solid rgba(255,255,255,.22); }
        .sb-user{ display:flex; align-items:center; gap:10px; background:rgba(255,255,255,.1);
          border:1px solid rgba(255,255,255,.16); border-radius:13px; padding:9px 12px; margin:4px 0 8px; }
        .sb-avatar{ width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,.22);
          display:flex;align-items:center;justify-content:center;font-weight:700; }
        .sb-user b{ font-size:13.5px; } .sb-user small{ color:rgba(255,255,255,.65); font-size:11px; }

        /* ===== login split ===== */
        .login-brand{ background:linear-gradient(160deg,#1A38A8,#122A82); color:#fff;
          border-radius:18px; padding:40px 34px; min-height:460px; display:flex; flex-direction:column;
          box-shadow:0 8px 22px rgba(35,71,197,.2); }
        .login-brand .lb-logo{ display:flex; align-items:center; gap:11px; }
        .login-brand h1{ color:#fff !important; font-size:30px; font-weight:800; line-height:1.16; letter-spacing:-.6px; margin:26px 0 0; }
        .login-brand .sub{ color:rgba(255,255,255,.8); font-size:14.5px; margin-top:12px; }
        .login-stats{ display:flex; gap:26px; margin-top:auto; padding-top:30px; }
        .login-stats b{ font-size:23px; font-weight:800; display:block; font-variant-numeric:tabular-nums; }
        .login-stats span{ color:rgba(255,255,255,.7); font-size:12px; }
        .login-eyebrow{ color:var(--royal); font-weight:700; text-transform:uppercase; letter-spacing:1.6px; font-size:12.5px; }
        .login-title{ color:var(--t-title); font-size:26px; font-weight:800; margin:.2rem 0 1rem; }
        </style>
        """,
        unsafe_allow_html=True,
    )


def cabecalho(eyebrow: str, titulo: str, subtitulo: str) -> None:
    """Cabeçalho padrão de página: eyebrow royal + título 30px + subtítulo."""
    st.markdown(
        f'<div class="tablm-head"><div class="eyebrow">{eyebrow}</div>'
        f"<h1>{titulo}</h1><p>{subtitulo}</p></div>",
        unsafe_allow_html=True,
    )


# --------------------------------------------------------------------------- #
# Helpers de leitura
# --------------------------------------------------------------------------- #
@st.cache_data(show_spinner=False)
def _extrair_tabelas_pdf_cache(conteudo: bytes, cabecalho: bool):
    return extrair_tabelas_pdf(conteudo, cabecalho)


def _carregar_tabela_mercado(arquivo):
    """Lê o arquivo enviado (Excel/CSV direto; PDF via extração + seleção)."""
    if not arquivo.name.lower().endswith(".pdf"):
        return ler_planilha(arquivo.getvalue(), arquivo.name)

    cabecalho = st.checkbox("Primeira linha da tabela é o cabeçalho", value=True, key="pdf_hdr")
    with st.spinner("Lendo o PDF (todas as páginas)..."):
        tabelas = _extrair_tabelas_pdf_cache(arquivo.getvalue(), cabecalho)

    if not tabelas:
        st.warning(
            "Não encontrei tabelas neste PDF. Se for um PDF escaneado (imagem), "
            "ele não tem texto extraível — me avise que adiciono OCR."
        )
        return None

    rotulos = [
        f"Tabela {i + 1} — {desc} ({len(df)} linhas × {df.shape[1]} col.)"
        for i, (desc, df) in enumerate(tabelas)
    ]
    escolha = st.selectbox(
        "Tabela extraída do PDF", range(len(rotulos)),
        format_func=lambda i: rotulos[i], key="pdf_tab_sel",
    )
    return tabelas[escolha][1]


# --------------------------------------------------------------------------- #
# Páginas
# --------------------------------------------------------------------------- #
def render_mercado() -> None:
    cabecalho("INTELIGÊNCIA DE MERCADO", "Inteligência de Mercado e Concorrência",
              "Compare preço/m² e preço total entre seus produtos e a concorrência.")

    base_mercado = obter_base()
    if sheets_configurado():
        st.success("🟢 Histórico persistente ativo (Google Sheets).", icon="✅")
    else:
        st.warning("🟡 Base apenas na sessão — configure o Google Sheets para salvar o histórico.")

    sub_add, sub_base, sub_dash = st.tabs(
        ["➕ Adicionar tabela", "🗂️ Base atual", "📈 Dashboard de mercado"]
    )

    with sub_add:
        if msg_add := st.session_state.pop("mkt_msg", None):
            st.success(msg_add)
        arquivo_mkt = st.file_uploader(
            "Tabela (Excel, CSV ou PDF)", type=["xlsx", "xls", "csv", "pdf"], key="mkt_upload"
        )
        df_mkt = _carregar_tabela_mercado(arquivo_mkt) if arquivo_mkt else None

        if df_mkt is not None and not df_mkt.empty:
            st.dataframe(df_mkt.head(8), use_container_width=True)

            st.markdown("**Marcação (aplica-se a toda a tabela)**")
            c1, c2, c3 = st.columns(3)
            with c1:
                tipo = st.selectbox("Tipo", TIPOS, key="mkt_tipo")
                incorporadora = st.text_input("Incorporadora", key="mkt_inc")
            with c2:
                produto = st.text_input("Produto/Empreendimento", key="mkt_prod")
                cidade = st.text_input("Cidade", key="mkt_cidade")
            with c3:
                bairro = st.text_input("Bairro", key="mkt_bairro")
                padrao = st.selectbox("Padrão", PADROES, key="mkt_padrao")

            st.markdown("**Mapeamento de colunas**")
            m1, m2, m3 = st.columns(3)
            colunas = list(df_mkt.columns)
            with m1:
                col_valor = st.selectbox("Coluna de valor (R$)", colunas, key="mkt_val")
            with m2:
                col_area = st.selectbox(
                    "Coluna de área (m²)", colunas, index=min(1, len(colunas) - 1), key="mkt_area"
                )
            with m3:
                col_unidade = st.selectbox(
                    "Coluna de unidade (opcional)", ["(nenhuma)"] + colunas, key="mkt_un"
                )

            if st.button("➕ Adicionar à base", type="primary"):
                if not incorporadora or not produto:
                    st.warning("Preencha ao menos Incorporadora e Produto.")
                else:
                    novo = normalizar_upload(
                        df_mkt,
                        col_valor=col_valor,
                        col_area=col_area,
                        col_unidade=None if col_unidade == "(nenhuma)" else col_unidade,
                        tipo=tipo, incorporadora=incorporadora, produto=produto,
                        cidade=cidade, bairro=bairro, padrao=padrao,
                    )
                    if novo.empty:
                        st.error(
                            f"Nenhuma linha com número na coluna de valor **{col_valor}**. "
                            "Confira o mapeamento: a *Coluna de valor (R$)* precisa ser a coluna "
                            "que contém os **preços**, não um texto/título."
                        )
                    else:
                        persistir(adicionar_a_base(base_mercado, novo))
                        st.session_state["mkt_msg"] = (
                            f"✅ {len(novo)} unidades adicionadas ({produto} — {incorporadora})."
                        )
                        st.rerun()

    with sub_base:
        st.metric("Unidades na base", len(base_mercado))
        st.dataframe(base_mercado, use_container_width=True)
        col_b1, col_b2 = st.columns(2)
        with col_b1:
            if not base_mercado.empty:
                st.download_button(
                    "⬇️ Baixar base (CSV)",
                    data=base_mercado.to_csv(index=False).encode("utf-8"),
                    file_name="base_mercado.csv", mime="text/csv", use_container_width=True,
                )
        with col_b2:
            if st.button("🗑️ Limpar base", use_container_width=True):
                persistir(base_vazia())
                st.rerun()

    with sub_dash:
        base = base_mercado
        if base.empty:
            st.info("Adicione ao menos uma tabela na aba **Adicionar tabela**.")
            return
        k = kpis_gerais(base)
        m2 = lambda v: ui.moeda(v) if v is not None else "—"  # noqa: E731

        st.markdown(ui.kpi_cards([
            {"label": "Unidades na base", "value": str(k["total_unidades"]), "sub": f'{k["incorporadoras"]} incorporadoras'},
            {"label": "Produtos", "value": str(k["produtos"]), "sub": f'{k["cidades"]} cidades'},
            {"label": "Ticket médio", "value": m2(k["ticket_medio"]), "sub": "todas as praças"},
            {"label": "Preço/m² médio", "value": m2(k["preco_m2_medio"]), "sub": "mercado geral"},
        ]), unsafe_allow_html=True)

        nosso, conc = k["preco_m2_nosso"], k["preco_m2_concorrentes"]
        if nosso is not None and conc:
            dif = round(100 * (nosso - conc) / conc, 1)
            direc = "up" if dif > 0 else ("down" if dif < 0 else "flat")
            delta_txt = f"{abs(dif)}% vs. concorrência"
        else:
            direc, delta_txt = "flat", "sem comparativo"
        st.markdown(ui.kpi_delta_cards([
            {"label": "Preço/m² — nosso", "value": m2(nosso), "delta": delta_txt, "dir": direc},
            {"label": "Preço/m² — concorrentes", "value": m2(conc), "delta": "base comparável", "dir": "flat"},
            {"label": "VGV total", "value": m2(k["vgv_total"]), "delta": "soma da base", "dir": "flat"},
            {"label": "Ticket médio", "value": m2(k["ticket_medio"]), "delta": "por unidade", "dir": "flat"},
        ]), unsafe_allow_html=True)

        # barras de bairro + insights
        por_bairro = comparar_por_dimensao(base, "bairro")
        bairros_nossos = set(base[base["tipo"] == "Nosso"]["bairro"])
        maxv = por_bairro["preco_m2_medio"].max()
        maxv = maxv if maxv == maxv and maxv else 1  # guarda NaN/0
        barras = []
        for _, r in por_bairro.head(6).iterrows():
            v = r["preco_m2_medio"]
            barras.append({
                "label": str(r["bairro"]) or "—",
                "value": m2(v),
                "pct": 100 * (v / maxv) if v == v else 0,
                "ours": r["bairro"] in bairros_nossos,
            })
        insights = gerar_insights(base)
        col_bar, col_ins = st.columns([1.35, 1])
        with col_bar:
            st.markdown(ui.barras_bairro(barras), unsafe_allow_html=True)
        with col_ins:
            if insights:
                st.markdown(ui.insights_card(insights), unsafe_allow_html=True)

        # posicionamento por padrão
        linhas = []
        for _, r in posicionamento_por_padrao(base).iterrows():
            dif = r["dif_pct"]
            if dif is None:
                dcell = '<span style="color:#97A2B5">—</span>'
            elif dif >= 0:
                dcell = f'<span style="color:#15A34A;font-weight:700">▲ {dif}%</span>'
            else:
                dcell = f'<span style="color:#DC2626;font-weight:700">▼ {abs(dif)}%</span>'
            linhas.append([
                f'<span style="font-weight:600;color:#2C3850">{r["padrao"]}</span>',
                f'<span style="color:#14203A;font-weight:600">{m2(r["preco_m2_nosso"])}</span>',
                f'<span style="color:#6B7689">{m2(r["preco_m2_concorrentes"])}</span>',
                dcell,
            ])
        colunas = [
            {"nome": "Padrão", "fr": "1.4fr"},
            {"nome": "Nosso", "fr": "1fr", "align": "right"},
            {"nome": "Concorrentes", "fr": "1fr", "align": "right"},
            {"nome": "Diferença", "fr": "1fr", "align": "right"},
        ]
        st.markdown("<div style='height:18px'></div>", unsafe_allow_html=True)
        st.markdown(
            ui.tabela("Posicionamento por padrão — nós vs. concorrência",
                      "Preço/m² médio (R$) por faixa de padrão", colunas, linhas),
            unsafe_allow_html=True,
        )


def render_dashboards() -> None:
    cabecalho("DASHBOARDS DE VENDAS", "Dashboards de vendas e preços",
              "Indicadores da tabela atual e evolução frente à tabela anterior.")

    col_up1, col_up2 = st.columns(2)
    with col_up1:
        arq_atual_dash = st.file_uploader("Tabela ATUAL", type=["xlsx", "xls", "csv"], key="dash_atual")
    with col_up2:
        arq_ant_dash = st.file_uploader("Tabela ANTERIOR (opcional)", type=["xlsx", "xls", "csv"], key="dash_anterior")

    if not arq_atual_dash:
        st.info("Envie ao menos a **tabela atual** para gerar os dashboards.")
        return

    with st.spinner("Lendo planilha..."):
        df_dash = ler_planilha(arq_atual_dash.getvalue(), arq_atual_dash.name)

    colunas = list(df_dash.columns)
    c1, c2, c3 = st.columns(3)
    with c1:
        col_unidade = st.selectbox("Coluna de unidade", colunas, key="dash_col_un")
    with c2:
        col_valor = st.selectbox("Coluna de valor", colunas, index=min(1, len(colunas) - 1), key="dash_col_val")
    with c3:
        col_status = st.selectbox("Coluna de situação", colunas, index=min(2, len(colunas) - 1), key="dash_col_st")

    kpis = calcular_kpis(df_dash, col_unidade, col_valor, col_status)

    total = kpis["total_unidades"] or 1
    st.markdown(ui.eyebrow("Visão geral — tabela atual"), unsafe_allow_html=True)
    st.markdown(ui.kpi_cards([
        {"label": "Total de unidades", "value": str(kpis["total_unidades"]), "sub": "tabela atual"},
        {"label": "Disponíveis", "value": str(kpis["disponiveis"]), "sub": f'{kpis["pct_disponiveis"]}% do total'},
        {"label": "Vendidas", "value": str(kpis["vendidas"]), "sub": f'{kpis["pct_vendidas"]}% do total'},
        {"label": "Reservadas", "value": str(kpis["reservadas"]), "sub": f'{round(100 * kpis["reservadas"] / total)}% do total'},
    ]), unsafe_allow_html=True)
    st.markdown(ui.kpi_delta_cards([
        {"label": "VGV total", "value": ui.moeda(kpis["vgv_total"]), "delta": "valor geral de venda", "dir": "flat"},
        {"label": "VGV disponível", "value": ui.moeda(kpis["vgv_disponivel"]), "delta": f'{kpis["disponiveis"]} unidades', "dir": "flat"},
        {"label": "Ticket médio", "value": ui.moeda(kpis["ticket_medio"]), "delta": "por unidade", "dir": "flat"},
        {"label": "VSO", "value": f'{kpis["vso"]}%', "delta": "velocidade de vendas", "dir": "up"},
    ]), unsafe_allow_html=True)

    # rosca por situação + histograma
    outros = max(total - kpis["vendidas"] - kpis["disponiveis"] - kpis["reservadas"], 0)
    legenda = [
        {"label": "Vendidas", "value": str(kpis["vendidas"]), "pct": 100 * kpis["vendidas"] / total, "color": "#15A34A"},
        {"label": "Disponíveis", "value": str(kpis["disponiveis"]), "pct": 100 * kpis["disponiveis"] / total, "color": "#2347C5"},
        {"label": "Reservadas", "value": str(kpis["reservadas"]), "pct": 100 * kpis["reservadas"] / total, "color": "#E0B23A"},
    ]
    if outros:
        legenda.append({"label": "Outros", "value": str(outros), "pct": 100 * outros / total, "color": "#D4DAE6"})

    vals = sorted(float(v) for v in kpis["_valores"].dropna())
    barras_hist = []
    if vals:
        lo, hi = vals[0], vals[-1]
        largura = (hi - lo) / 7 or 1
        contagens = [0] * 7
        for v in vals:
            contagens[min(int((v - lo) / largura), 6)] += 1
        maxc = max(contagens) or 1
        barras_hist = [
            {"pct": 100 * c / maxc, "label": f"{(lo + i * largura) / 1000:.0f}k"}
            for i, c in enumerate(contagens)
        ]

    col_g1, col_g2 = st.columns([1, 1.25])
    with col_g1:
        st.markdown(ui.donut(legenda, kpis["total_unidades"]), unsafe_allow_html=True)
    with col_g2:
        st.markdown(ui.histograma("Distribuição de preços", "Unidades por faixa de valor (R$)", barras_hist),
                    unsafe_allow_html=True)

    if not arq_ant_dash:
        return
    with st.spinner("Comparando com a tabela anterior..."):
        df_ant_dash = ler_planilha(arq_ant_dash.getvalue(), arq_ant_dash.name)
    if not all(c in df_ant_dash.columns for c in (col_unidade, col_valor, col_status)):
        st.warning("A tabela anterior não tem as mesmas colunas selecionadas.")
        return

    comp = comparar_tabelas_kpis(df_ant_dash, df_dash, col_unidade, col_valor, col_status)
    st.markdown("<div style='height:8px'></div>", unsafe_allow_html=True)
    st.markdown(ui.eyebrow("Evolução vs. tabela anterior"), unsafe_allow_html=True)
    st.markdown(ui.kpi_delta_cards([
        {"label": "Vendidas no período", "value": str(comp["qtd_vendidas_no_periodo"]), "delta": "novas vendas", "dir": "up"},
        {"label": "Voltaram à disponib.", "value": str(comp["qtd_retornaram_disponiveis"]), "delta": "distratos", "dir": "down" if comp["qtd_retornaram_disponiveis"] else "flat"},
        {"label": "Aumento médio", "value": f'{comp["aumento_medio_pct"]}%', "delta": "reajuste de preços", "dir": "up" if comp["aumento_medio_pct"] > 0 else "flat"},
        {"label": "Aumento total", "value": ui.moeda(comp["aumento_total_rs"]), "delta": "na tabela", "dir": "up" if comp["aumento_total_rs"] > 0 else "flat"},
    ]), unsafe_allow_html=True)
    st.markdown(ui.kpi_cards([
        {"label": "Novas unidades", "value": str(comp["qtd_novas_unidades"]), "sub": "entraram na tabela"},
        {"label": "Unidades removidas", "value": str(comp["qtd_unidades_removidas"]), "sub": "saíram da tabela"},
        {"label": "Unidades em ambas", "value": str(comp["qtd_comuns"]), "sub": "comparáveis"},
    ]), unsafe_allow_html=True)


def render_detectar() -> None:
    cabecalho("DETECTAR PADRÃO", "Detectar padrão de tabela",
              "Identifica automaticamente as colunas de uma planilha.")
    arquivo = st.file_uploader("Envie a planilha (Excel ou CSV, até 50 MB)",
                               type=["xlsx", "xls", "csv"], key="up_detectar")
    if not arquivo:
        return
    with st.spinner("Lendo planilha..."):
        df = ler_planilha(arquivo.getvalue(), arquivo.name)
    st.dataframe(df.head(20), use_container_width=True)
    with st.spinner("Detectando padrão..."):
        resultado = detectar_padrao(df)

    mapeados = {p: c for p, c in resultado["mapeamento"].items() if c is not None}
    conf = int(resultado["confianca"] * 100)
    total_campos = len(resultado["mapeamento"])

    col_esq, col_dir = st.columns([1, 1.1])
    with col_esq:
        st.markdown(
            f'<div style="{ui.ROYAL_CARD}">'
            '<div style="font-size:13px;font-weight:600;color:rgba(255,255,255,.7);letter-spacing:.4px">CONFIANÇA DA DETECÇÃO</div>'
            '<div style="display:flex;align-items:baseline;gap:8px;margin:8px 0 16px">'
            f'<div style="font-size:48px;font-weight:800;letter-spacing:-1.5px">{conf}</div>'
            '<div style="font-size:22px;font-weight:700">%</div></div>'
            '<div style="height:9px;background:rgba(255,255,255,.18);border-radius:6px;overflow:hidden">'
            f'<div style="height:100%;width:{conf}%;border-radius:6px;background:#fff"></div></div>'
            f'<div style="font-size:13px;color:rgba(255,255,255,.78);margin-top:14px;line-height:1.5">'
            f'{len(mapeados)} de {total_campos} campos-chave identificados automaticamente.</div></div>',
            unsafe_allow_html=True,
        )
    with col_dir:
        linhas_map = "".join(
            '<div style="display:flex;align-items:center;gap:12px;padding:13px 15px;border:1px solid #EDF0F6;'
            'border-radius:12px;margin-bottom:10px">'
            f'<div style="font-size:13.5px;font-weight:700;color:#2347C5;width:92px;flex-shrink:0">{papel}</div>'
            '<div style="color:#C6D0E0;flex-shrink:0">→</div>'
            f'<div style="font-size:14px;color:#2C3850;flex:1;font-weight:500">{coluna}</div>'
            '<div style="font-size:11.5px;font-weight:700;color:#157A3D;background:#E9FBF0;padding:3px 9px;border-radius:20px">OK</div></div>'
            for papel, coluna in mapeados.items()
        ) or '<div style="color:#97A2B5;font-size:14px">Nenhum campo reconhecido.</div>'
        chips = "".join(
            '<span style="font-size:13px;color:#8A6A1E;background:#FBF3DD;border:1px solid #F0E0B4;'
            'padding:5px 12px;border-radius:20px;margin:0 8px 8px 0;display:inline-block">' + str(c) + "</span>"
            for c in resultado["colunas_nao_mapeadas"]
        )
        bloco_chips = (
            '<div style="margin-top:18px;padding-top:16px;border-top:1px solid #EDF0F6">'
            '<div style="font-size:12.5px;font-weight:600;color:#6B7689;margin-bottom:9px">Colunas não mapeadas</div>'
            f'<div style="display:flex;flex-wrap:wrap">{chips}</div></div>'
            if chips else ""
        )
        st.markdown(
            f'<div style="{ui.CARD_BIG}">'
            '<div style="font-size:16px;font-weight:700;color:#14203A;margin-bottom:4px">Mapeamento detectado</div>'
            '<div style="font-size:13px;color:#97A2B5;margin-bottom:18px">Campo do sistema → coluna da planilha</div>'
            f'{linhas_map}{bloco_chips}</div>',
            unsafe_allow_html=True,
        )


def render_comparar() -> None:
    cabecalho("COMPARAR VERSÕES", "Comparar versões",
              "Veja o que mudou entre duas versões de uma tabela.")
    col_a, col_b = st.columns(2)
    with col_a:
        arq_antigo = st.file_uploader("Versão antiga", type=["xlsx", "xls", "csv"], key="up_antigo")
    with col_b:
        arq_novo = st.file_uploader("Versão nova", type=["xlsx", "xls", "csv"], key="up_novo")

    if not (arq_antigo and arq_novo):
        return
    with st.spinner("Lendo planilhas..."):
        df_antigo = ler_planilha(arq_antigo.getvalue(), arq_antigo.name)
        df_novo = ler_planilha(arq_novo.getvalue(), arq_novo.name)

    colunas_comuns = [c for c in df_antigo.columns if c in df_novo.columns]
    coluna_chave = st.selectbox("Coluna-chave (identifica cada linha)", colunas_comuns)

    if st.button("Comparar", type="primary"):
        with st.spinner("Comparando versões..."):
            resultado = comparar_versoes(df_antigo, df_novo, coluna_chave)

        cards = (
            ui.cartao_resumo("Adicionadas", str(resultado["total_adicionadas"]), "#15A34A", "#BDEDCF")
            + ui.cartao_resumo("Removidas", str(resultado["total_removidas"]), "#DC2626", "#F3C7C7")
            + ui.cartao_resumo("Alteradas", str(resultado["total_alteradas"]), "#2347C5", "#CBD8F5")
        )
        st.markdown(
            f'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:22px">{cards}</div>',
            unsafe_allow_html=True,
        )

        linhas = []
        for item in resultado["alteradas"][:80]:
            for campo, (de, para) in item["diferencas"].items():
                linhas.append([
                    f'<span style="font-weight:700;color:#2347C5">{item["chave"]}</span>',
                    f'<span style="color:#6B7689">{campo}</span>',
                    f'<span style="color:#97A2B5;text-decoration:line-through">{de}</span>',
                    f'<span style="color:#14203A;font-weight:600">{para}</span>',
                ])
        colunas = [
            {"nome": "Unidade", "fr": ".8fr"}, {"nome": "Campo", "fr": "1fr"},
            {"nome": "De", "fr": "1.1fr"}, {"nome": "Para", "fr": "1.1fr"},
        ]
        if linhas:
            st.markdown(ui.tabela("Linhas alteradas", "Campos que mudaram entre as versões", colunas, linhas),
                        unsafe_allow_html=True)
        with st.expander("Ver linhas adicionadas / removidas"):
            st.markdown("**Adicionadas**")
            st.dataframe(resultado["adicionadas"], use_container_width=True)
            st.markdown("**Removidas**")
            st.dataframe(resultado["removidas"], use_container_width=True)


def render_reajustar() -> None:
    cabecalho("REAJUSTAR POR INCC", "Reajustar por INCC",
              "Aplica a variação do INCC-DI do mês (+ acréscimo opcional) sobre os valores.")

    st.markdown("##### 1️⃣ Índice INCC do mês")
    modo_incc = st.radio("Como definir o % do INCC?",
                         ["Buscar da API oficial (BCB/FGV)", "Digitar manualmente"], horizontal=True)
    incc_pct = Decimal("0")

    if modo_incc == "Buscar da API oficial (BCB/FGV)":
        hoje = date.today()
        st.caption(f"Fonte: Banco Central — série {SERIE_INCC_DI} (INCC-DI da FGV, confere com a SindusCon).")
        col_busca, col_atualizar = st.columns([3, 1])
        with col_busca:
            buscar = st.button("Buscar últimos índices do INCC-DI", use_container_width=True)
        with col_atualizar:
            if st.button("🔄 Forçar atualização", use_container_width=True):
                try:
                    buscar_variacoes_incc_di.clear()
                except Exception:  # noqa: BLE001
                    pass
                st.session_state.pop("variacoes_incc", None)
                buscar = True
        if buscar:
            try:
                with st.spinner("Consultando API do Banco Central..."):
                    st.session_state["variacoes_incc"] = buscar_variacoes_incc_di(
                        date(hoje.year - 2, 1, 1).strftime("%d/%m/%Y"), hoje.strftime("%d/%m/%Y")
                    )
            except Exception as exc:  # noqa: BLE001
                st.error(f"Falha ao consultar a API do BCB: {exc}")

        variacoes = st.session_state.get("variacoes_incc", {})
        if variacoes:
            meses = sorted(variacoes.keys(), reverse=True)
            mes_ref = st.selectbox("Mês de referência (padrão: último publicado)", meses, index=0)
            incc_pct = variacoes[mes_ref]
            st.metric(f"INCC-DI de {mes_ref}", f"{incc_pct}%")
        else:
            st.info("Clique em **Buscar últimos índices do INCC-DI** para carregar.")
    else:
        incc_pct = Decimal(str(st.number_input("% do INCC do mês", value=0.0, step=0.01, format="%.2f")))

    st.markdown("##### 2️⃣ Acréscimo adicional (opcional, além do INCC)")
    col1, col2 = st.columns(2)
    with col1:
        extra_pct = Decimal(str(st.number_input("% adicional", value=0.0, step=0.01, format="%.2f")))
    with col2:
        valor_bruto = Decimal(str(st.number_input("Valor bruto adicional por unidade (R$)",
                                                  value=0.0, step=10.0, format="%.2f")))

    percentual_total = incc_pct + extra_pct
    resumo_reajuste = f"INCC {incc_pct}% + {extra_pct}% adicional = {percentual_total}%"
    detalhe = f"INCC {incc_pct}% + {extra_pct}% adicional"
    if valor_bruto:
        resumo_reajuste += f" + R$ {valor_bruto} por unidade"
        detalhe += f" + R$ {valor_bruto}/unid."
    st.markdown(
        f'<div style="{ui.ROYAL_CARD};margin:6px 0 18px">'
        '<div style="font-size:12.5px;color:rgba(255,255,255,.72);font-weight:600">REAJUSTE A APLICAR</div>'
        f'<div style="font-size:32px;font-weight:800;margin:4px 0;letter-spacing:-.5px">{percentual_total}%</div>'
        f'<div style="font-size:13px;color:rgba(255,255,255,.78)">{detalhe}</div></div>',
        unsafe_allow_html=True,
    )

    st.markdown("##### 3️⃣ Tabela de unidades")
    arquivo_tabela = st.file_uploader("Envie a tabela de valores (Excel ou CSV, até 50 MB)",
                                      type=["xlsx", "xls", "csv"], key="up_reajustar")
    if not arquivo_tabela:
        return
    with st.spinner("Lendo planilha..."):
        df_valores = ler_planilha(arquivo_tabela.getvalue(), arquivo_tabela.name)
    st.dataframe(df_valores.head(10), use_container_width=True)
    coluna_valor = st.selectbox("Coluna de valores a reajustar", df_valores.columns)

    if percentual_total == 0 and valor_bruto == 0:
        st.warning("Defina o INCC do mês e/ou um acréscimo antes de reajustar.")
        return
    if st.button("Reajustar e gerar nova tabela", type="primary"):
        with st.spinner("Aplicando reajuste com precisão Decimal..."):
            df_resultado = reajustar_tabela_mensal(df_valores, coluna_valor, percentual_total, valor_bruto)

        col_reaj = f"{coluna_valor}_reajustado"
        linhas = []
        for i, (_, r) in enumerate(df_resultado.head(120).iterrows(), 1):
            atual, novo = r[coluna_valor], r[col_reaj]
            try:
                dif = float(novo) - float(atual)
                dcell = f'<span style="color:#15A34A;font-weight:700">+{ui.moeda(dif)}</span>'
            except (TypeError, ValueError):
                dcell = '<span style="color:#97A2B5">—</span>'
            unidade = str(r.iloc[0]) if len(df_resultado.columns) > 1 else str(i)
            linhas.append([
                f'<span style="font-weight:600;color:#2C3850">{unidade}</span>',
                f'<span style="color:#6B7689">{ui.moeda(atual)}</span>',
                f'<span style="color:#14203A;font-weight:700">{ui.moeda(novo)}</span>',
                dcell,
            ])
        colunas = [
            {"nome": "Unidade", "fr": "1fr"}, {"nome": "Valor atual", "fr": "1fr", "align": "right"},
            {"nome": "Reajustado", "fr": "1fr", "align": "right"}, {"nome": "Diferença", "fr": "1fr", "align": "right"},
        ]
        st.markdown(
            ui.tabela("Tabela reajustada", f"Precisão Decimal · {len(df_resultado)} unidades", colunas, linhas),
            unsafe_allow_html=True,
        )

        col_dl1, col_dl2 = st.columns(2)
        with col_dl1:
            excel_buffer = BytesIO()
            df_resultado.to_excel(excel_buffer, index=False, engine="openpyxl")
            st.download_button("⬇️ Baixar Excel reajustado", data=excel_buffer.getvalue(),
                               file_name="tabela_reajustada.xlsx",
                               mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                               use_container_width=True)
        with col_dl2:
            pdf_buffer = gerar_pdf_executivo(df_resultado, coluna_valor, resumo_reajuste)
            st.download_button("⬇️ Baixar PDF executivo", data=pdf_buffer.getvalue(),
                               file_name="resumo_reajuste.pdf", mime="application/pdf",
                               use_container_width=True)


def _mais_180_dias(data_str: str) -> str:
    """Entrega + 180 dias (praxe de mercado). Aceita DD/MM/AAAA, MM/AAAA, DD/MM/AA."""
    from datetime import datetime, timedelta
    for fmt in ("%d/%m/%Y", "%d/%m/%y", "%m/%Y"):
        try:
            return (datetime.strptime((data_str or "").strip(), fmt) + timedelta(days=180)).strftime("%d/%m/%Y")
        except ValueError:
            continue
    return ""


def render_extracao() -> None:
    cabecalho("EXTRAÇÃO (IA)", "Extração de books, flyers e tabelas",
              "Suba os materiais; a IA extrai a ficha técnica e você revisa antes de salvar.")
    st.session_state.setdefault("fichas_benchmark", [])

    if ia_configurada():
        st.success("🟢 IA conectada — **Google Gemini (grátis)** lê PDF e imagem.", icon="✅")
    else:
        st.warning("🟡 IA não configurada. Adicione `[gemini] api_key` nos Secrets para extrair "
                   "automaticamente (grátis). Sem isso, você ainda pode preencher os campos "
                   "manualmente.")

    if supabase_configurado():
        st.caption("🗄️ Base persistida no **Supabase** (sobrevive a recarregar a página).")
    else:
        st.caption("⚠️ Sem banco configurado — a base fica só nesta sessão.")

    arquivos = st.file_uploader(
        "Books / flyers (PDF ou imagem) — pode enviar vários de uma vez",
        type=["pdf", "png", "jpg", "jpeg"], accept_multiple_files=True, key="ext_upload",
    )

    for arq in arquivos or []:
        chave_ficha = f"ficha_{arq.name}"
        with st.expander(f"📄 {arq.name}", expanded=len(arquivos) == 1):
            if ia_configurada() and st.button("🤖 Extrair com IA", key=f"btn_{arq.name}"):
                try:
                    with st.spinner("Lendo o documento com a IA..."):
                        st.session_state[chave_ficha] = extrair_ficha(arq.getvalue(), arq.name)
                    st.success("Extraído! Revise os campos abaixo.")
                except Exception as exc:  # noqa: BLE001
                    st.error(f"Falha na extração: {exc}")

            ficha = st.session_state.get(chave_ficha, ficha_vazia())
            st.markdown("**Revisão da ficha técnica** (edite o que precisar)")
            colunas = st.columns(3)
            valores = {}
            for i, (campo, rotulo) in enumerate(CAMPOS_FICHA.items()):
                with colunas[i % 3]:
                    valores[campo] = st.text_input(rotulo, value=ficha.get(campo, ""),
                                                   key=f"f_{arq.name}_{campo}")
            mais180 = _mais_180_dias(valores.get("data_entrega", ""))
            if mais180:
                st.caption(f"📅 Entrega + 180 dias (praxe de mercado): **{mais180}**")

            if st.button("💾 Salvar na base de benchmark", key=f"save_{arq.name}", type="primary"):
                registro = dict(valores)
                registro["entrega_mais_180"] = mais180
                registro["arquivo"] = arq.name
                destino = salvar_ficha(registro)
                onde = "Supabase" if destino == "supabase" else "sessão"
                st.success(f"Ficha de {valores.get('nome_empreendimento') or arq.name} salva ({onde}).")

    base = listar_fichas()
    if base:
        st.markdown("#### Base de benchmark")
        df_bench = pd.DataFrame(base)
        st.dataframe(df_bench, use_container_width=True)
        col_b1, col_b2 = st.columns(2)
        with col_b1:
            st.download_button("⬇️ Baixar benchmark (CSV)",
                               data=df_bench.to_csv(index=False).encode("utf-8"),
                               file_name="benchmark.csv", mime="text/csv", use_container_width=True)
        with col_b2:
            if st.button("🗑️ Limpar benchmark", use_container_width=True):
                limpar_base()
                st.rerun()


# rótulo de navegação -> função que renderiza a página
PAGINAS = {
    "Inteligência de Mercado": render_mercado,
    "Extração (IA)": render_extracao,
    "Dashboards de Vendas": render_dashboards,
    "Detectar Padrão": render_detectar,
    "Comparar Versões": render_comparar,
    "Reajustar por INCC": render_reajustar,
}


# --------------------------------------------------------------------------- #
# Sidebar royal + dispatch
# --------------------------------------------------------------------------- #
def render_sidebar(cookies) -> str:
    with st.sidebar:
        st.markdown(
            '<div class="sb-brand"><div class="sb-logo">T</div>'
            "<div><b>TabLM</b><br><small>Ribeira Empreendimentos</small></div></div>",
            unsafe_allow_html=True,
        )
        st.markdown('<div class="sb-eyebrow">Menu</div>', unsafe_allow_html=True)
        selecionado = st.radio(
            "Navegação", list(PAGINAS.keys()), label_visibility="collapsed", key="nav"
        )
        st.markdown("<div style='flex:1'></div>", unsafe_allow_html=True)
        usuario = usuario_atual() or ""
        st.markdown(
            f'<div class="sb-user"><div class="sb-avatar">{usuario[:1].upper()}</div>'
            f'<div><b>{usuario}</b><br><small>{datetime.now():%d/%m · %H:%M}</small></div></div>',
            unsafe_allow_html=True,
        )
        if st.button("Sair", use_container_width=True):
            fazer_logout(cookies)
    return selecionado


injetar_estilo()  # CSS do design (vale para login e app)
cookies = get_cookie_manager()  # instanciado uma vez; persiste o login no refresh
verificar_login(cookies)  # bloqueia tudo abaixo até o login ser feito

pagina = render_sidebar(cookies)
PAGINAS[pagina]()
