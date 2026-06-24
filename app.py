"""TabLM — app Streamlit com login, inteligência de mercado, dashboards,
detecção de padrão, comparação de versões e reajuste por INCC.

UI: menu lateral retrátil (streamlit-option-menu), tema claro/escuro e estilo
com cards. A navegação seleciona qual ``render_*`` é chamada.
"""
from datetime import date, datetime
from decimal import Decimal
from io import BytesIO

import plotly.express as px
import plotly.io as pio
import streamlit as st

from src.auth import fazer_logout, get_cookie_manager, usuario_atual, verificar_login
from src.comparador import comparar_versoes
from src.dashboard import calcular_kpis, comparar_tabelas_kpis
from src.detector import detectar_padrao
from src.incc import SERIE_INCC_DI, buscar_variacoes_incc_di, reajustar_tabela_mensal
from src.mercado import (
    DIMENSOES,
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
        html, body, .stApp, [data-testid="stSidebar"] *, .stMarkdown, input, button, textarea {
          font-family:'Hanken Grotesk', system-ui, sans-serif;
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
                    persistir(adicionar_a_base(base_mercado, novo))
                    st.success(f"{len(novo)} unidades adicionadas ({produto} — {incorporadora}).")
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

    st.markdown("#### Visão geral (tabela atual)")
    k1, k2, k3, k4 = st.columns(4)
    k1.metric("Total de unidades", kpis["total_unidades"])
    k2.metric("Disponíveis", kpis["disponiveis"], f'{kpis["pct_disponiveis"]}%')
    k3.metric("Vendidas", kpis["vendidas"], f'{kpis["pct_vendidas"]}%')
    k4.metric("Reservadas", kpis["reservadas"])

    k5, k6, k7, k8 = st.columns(4)
    k5.metric("VGV total", f'R$ {kpis["vgv_total"]:,.0f}')
    k6.metric("VGV disponível", f'R$ {kpis["vgv_disponivel"]:,.0f}')
    k7.metric("Ticket médio", f'R$ {kpis["ticket_medio"]:,.0f}')
    k8.metric("VSO (% vendido)", f'{kpis["vso"]}%')

    col_g1, col_g2 = st.columns(2)
    with col_g1:
        contagem = kpis["_situacoes"].value_counts().rename_axis("situacao").reset_index(name="qtd")
        fig_pizza = px.pie(contagem, names="situacao", values="qtd",
                           title="Distribuição por situação", hole=0.4)
        st.plotly_chart(fig_pizza, use_container_width=True)
    with col_g2:
        fig_hist = px.histogram(kpis["_valores"], nbins=20, title="Distribuição de preços")
        fig_hist.update_layout(showlegend=False, xaxis_title="Valor (R$)", yaxis_title="Unidades")
        st.plotly_chart(fig_hist, use_container_width=True)

    if not arq_ant_dash:
        return
    with st.spinner("Comparando com a tabela anterior..."):
        df_ant_dash = ler_planilha(arq_ant_dash.getvalue(), arq_ant_dash.name)
    if not all(c in df_ant_dash.columns for c in (col_unidade, col_valor, col_status)):
        st.warning("A tabela anterior não tem as mesmas colunas selecionadas.")
        return

    comp = comparar_tabelas_kpis(df_ant_dash, df_dash, col_unidade, col_valor, col_status)
    st.markdown("#### Evolução vs. tabela anterior")
    m1, m2, m3, m4 = st.columns(4)
    m1.metric("Vendidas no período", comp["qtd_vendidas_no_periodo"])
    m2.metric("Voltaram à disponibilidade", comp["qtd_retornaram_disponiveis"])
    m3.metric("Aumento médio de preço", f'{comp["aumento_medio_pct"]}%')
    m4.metric("Aumento total (R$)", f'R$ {comp["aumento_total_rs"]:,.0f}')

    m5, m6, m7 = st.columns(3)
    m5.metric("Novas unidades", comp["qtd_novas_unidades"])
    m6.metric("Unidades removidas", comp["qtd_unidades_removidas"])
    m7.metric("Unidades em ambas", comp["qtd_comuns"])

    if comp["vendidas_no_periodo"]:
        st.markdown("**Unidades vendidas no período:** " + ", ".join(map(str, comp["vendidas_no_periodo"])))
    if comp["retornaram_disponiveis"]:
        st.markdown("**Unidades que voltaram à disponibilidade:** " + ", ".join(map(str, comp["retornaram_disponiveis"])))


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
    st.metric("Confiança da detecção", f"{resultado['confianca'] * 100:.0f}%")
    st.json(resultado["mapeamento"])
    if resultado["colunas_nao_mapeadas"]:
        st.caption("Colunas não mapeadas: " + ", ".join(map(str, resultado["colunas_nao_mapeadas"])))


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
        c1, c2, c3 = st.columns(3)
        c1.metric("Adicionadas", resultado["total_adicionadas"])
        c2.metric("Removidas", resultado["total_removidas"])
        c3.metric("Alteradas", resultado["total_alteradas"])
        st.markdown("**Linhas adicionadas**")
        st.dataframe(resultado["adicionadas"], use_container_width=True)
        st.markdown("**Linhas removidas**")
        st.dataframe(resultado["removidas"], use_container_width=True)
        st.markdown("**Linhas alteradas**")
        st.json(resultado["alteradas"])


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
    if valor_bruto:
        resumo_reajuste += f" + R$ {valor_bruto} por unidade"
    st.info(f"**Reajuste a aplicar:** {resumo_reajuste}")

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
        st.success("Reajuste aplicado!")
        st.dataframe(df_resultado, use_container_width=True)

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


# rótulo de navegação -> função que renderiza a página
PAGINAS = {
    "Inteligência de Mercado": render_mercado,
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
