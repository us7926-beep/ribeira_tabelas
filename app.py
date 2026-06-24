"""Ribeira Tabelas — app Streamlit com login, detecção de padrão, comparação
de versões, reajuste por INCC e dashboards."""
from datetime import date, datetime
from decimal import Decimal
from io import BytesIO

import plotly.express as px
import streamlit as st

from src.auth import fazer_logout, get_cookie_manager, usuario_atual, verificar_login
from src.comparador import comparar_versoes
from src.dashboard import calcular_kpis, classificar_status, comparar_tabelas_kpis
from src.detector import detectar_padrao
from src.incc import SERIE_INCC_DI, buscar_variacoes_incc_di, reajustar_tabela_mensal
from src.utils import gerar_pdf_executivo, ler_planilha

st.set_page_config(page_title="Ribeira Tabelas", page_icon="📊", layout="wide")

cookies = get_cookie_manager()  # instanciado uma vez; persiste o login no refresh
verificar_login(cookies)  # bloqueia tudo abaixo até o login ser feito

# ---------------------------------------------------------------------------
# Cabeçalho de boas-vindas
# ---------------------------------------------------------------------------
col_logo, col_titulo, col_logout = st.columns([1, 6, 1])
with col_logo:
    st.markdown("### 🏗️")
with col_titulo:
    st.markdown(f"**Ribeira Empreendimentos** — bem-vindo(a), `{usuario_atual()}`")
    st.caption(f"Última atualização do app: {datetime.now():%d/%m/%Y %H:%M}")
with col_logout:
    if st.button("Sair", use_container_width=True):
        fazer_logout(cookies)

st.divider()

aba_dashboard, aba_detectar, aba_comparar, aba_reajustar = st.tabs(
    ["📊 Dashboards", "🔍 Detectar Padrão", "🔁 Comparar Versões", "📈 Reajustar por INCC"]
)

# ---------------------------------------------------------------------------
# Aba 0: Dashboards
# ---------------------------------------------------------------------------
with aba_dashboard:
    st.subheader("Dashboards de vendas e preços")
    st.caption(
        "Envie a tabela atual para ver os indicadores. Opcionalmente, envie a "
        "tabela anterior para comparar a evolução (vendas, retornos e aumento de preços)."
    )

    col_up1, col_up2 = st.columns(2)
    with col_up1:
        arq_atual_dash = st.file_uploader(
            "Tabela ATUAL", type=["xlsx", "xls", "csv"], key="dash_atual"
        )
    with col_up2:
        arq_ant_dash = st.file_uploader(
            "Tabela ANTERIOR (opcional)", type=["xlsx", "xls", "csv"], key="dash_anterior"
        )

    if not arq_atual_dash:
        st.info("Envie ao menos a **tabela atual** para gerar os dashboards.")
    else:
        with st.spinner("Lendo planilha..."):
            df_dash = ler_planilha(arq_atual_dash.getvalue(), arq_atual_dash.name)

        colunas = list(df_dash.columns)
        c1, c2, c3 = st.columns(3)
        with c1:
            col_unidade = st.selectbox("Coluna de unidade", colunas, key="dash_col_un")
        with c2:
            col_valor = st.selectbox(
                "Coluna de valor",
                colunas,
                index=min(1, len(colunas) - 1),
                key="dash_col_val",
            )
        with c3:
            col_status = st.selectbox(
                "Coluna de situação",
                colunas,
                index=min(2, len(colunas) - 1),
                key="dash_col_st",
            )

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
            fig_pizza = px.pie(
                contagem, names="situacao", values="qtd", title="Distribuição por situação", hole=0.4
            )
            st.plotly_chart(fig_pizza, use_container_width=True)
        with col_g2:
            fig_hist = px.histogram(
                kpis["_valores"], nbins=20, title="Distribuição de preços"
            )
            fig_hist.update_layout(showlegend=False, xaxis_title="Valor (R$)", yaxis_title="Unidades")
            st.plotly_chart(fig_hist, use_container_width=True)

        # Comparação com tabela anterior
        if arq_ant_dash:
            with st.spinner("Comparando com a tabela anterior..."):
                df_ant_dash = ler_planilha(arq_ant_dash.getvalue(), arq_ant_dash.name)
            cols_ok = all(c in df_ant_dash.columns for c in (col_unidade, col_valor, col_status))
            if not cols_ok:
                st.warning(
                    "A tabela anterior não tem as mesmas colunas selecionadas. "
                    "Verifique se os nomes batem com a tabela atual."
                )
            else:
                comp = comparar_tabelas_kpis(
                    df_ant_dash, df_dash, col_unidade, col_valor, col_status
                )
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
                    st.markdown("**Unidades vendidas no período:** " +
                                ", ".join(map(str, comp["vendidas_no_periodo"])))
                if comp["retornaram_disponiveis"]:
                    st.markdown("**Unidades que voltaram à disponibilidade:** " +
                                ", ".join(map(str, comp["retornaram_disponiveis"])))

# ---------------------------------------------------------------------------
# Aba 1: Detectar padrão de tabela
# ---------------------------------------------------------------------------
with aba_detectar:
    st.subheader("Detectar padrão de tabela")
    arquivo = st.file_uploader(
        "Envie a planilha (Excel ou CSV, até 50 MB)", type=["xlsx", "xls", "csv"], key="up_detectar"
    )
    if arquivo:
        with st.spinner("Lendo planilha..."):
            df = ler_planilha(arquivo.getvalue(), arquivo.name)
        st.dataframe(df.head(20), use_container_width=True)

        with st.spinner("Detectando padrão..."):
            resultado = detectar_padrao(df)

        st.metric("Confiança da detecção", f"{resultado['confianca'] * 100:.0f}%")
        st.json(resultado["mapeamento"])
        if resultado["colunas_nao_mapeadas"]:
            st.caption("Colunas não mapeadas: " + ", ".join(map(str, resultado["colunas_nao_mapeadas"])))

# ---------------------------------------------------------------------------
# Aba 2: Comparar versões
# ---------------------------------------------------------------------------
with aba_comparar:
    st.subheader("Comparar duas versões de uma tabela")
    col_a, col_b = st.columns(2)
    with col_a:
        arq_antigo = st.file_uploader("Versão antiga", type=["xlsx", "xls", "csv"], key="up_antigo")
    with col_b:
        arq_novo = st.file_uploader("Versão nova", type=["xlsx", "xls", "csv"], key="up_novo")

    if arq_antigo and arq_novo:
        with st.spinner("Lendo planilhas..."):
            df_antigo = ler_planilha(arq_antigo.getvalue(), arq_antigo.name)
            df_novo = ler_planilha(arq_novo.getvalue(), arq_novo.name)

        colunas_comuns = [c for c in df_antigo.columns if c in df_novo.columns]
        coluna_chave = st.selectbox("Coluna-chave (identifica cada linha)", colunas_comuns)

        if st.button("Comparar"):
            with st.spinner("Comparando versões..."):
                progresso = st.progress(0)
                resultado = comparar_versoes(df_antigo, df_novo, coluna_chave)
                progresso.progress(100)

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

# ---------------------------------------------------------------------------
# Aba 3: Reajustar por INCC
# ---------------------------------------------------------------------------
with aba_reajustar:
    st.subheader("Reajustar valores por índice INCC")
    st.caption(
        "Aplica a variação do INCC do mês sobre todos os valores das unidades. "
        "Você pode somar um acréscimo extra (% ou R$) além do INCC."
    )

    # --- 1. Percentual do INCC do mês ---------------------------------------
    st.markdown("##### 1️⃣ Índice INCC do mês")
    modo_incc = st.radio(
        "Como definir o % do INCC?",
        ["Buscar da API oficial (BCB/FGV)", "Digitar manualmente"],
        horizontal=True,
    )

    incc_pct = Decimal("0")
    mes_ref = "manual"

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
                except Exception:  # noqa: BLE001 — limpar cache não deve quebrar a tela
                    pass
                st.session_state.pop("variacoes_incc", None)
                buscar = True
        if buscar:
            try:
                with st.spinner("Consultando API do Banco Central..."):
                    variacoes = buscar_variacoes_incc_di(
                        date(hoje.year - 2, 1, 1).strftime("%d/%m/%Y"),
                        hoje.strftime("%d/%m/%Y"),
                    )
                st.session_state["variacoes_incc"] = variacoes
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
        incc_pct = Decimal(
            str(st.number_input("% do INCC do mês", value=0.0, step=0.01, format="%.2f"))
        )

    # --- 2. Acréscimo adicional ---------------------------------------------
    st.markdown("##### 2️⃣ Acréscimo adicional (opcional, além do INCC)")
    col1, col2 = st.columns(2)
    with col1:
        extra_pct = Decimal(
            str(st.number_input("% adicional", value=0.0, step=0.01, format="%.2f"))
        )
    with col2:
        valor_bruto = Decimal(
            str(st.number_input("Valor bruto adicional por unidade (R$)", value=0.0, step=10.0, format="%.2f"))
        )

    percentual_total = incc_pct + extra_pct
    resumo_reajuste = f"INCC {incc_pct}% + {extra_pct}% adicional = {percentual_total}%"
    if valor_bruto:
        resumo_reajuste += f" + R$ {valor_bruto} por unidade"
    st.info(f"**Reajuste a aplicar:** {resumo_reajuste}")

    # --- 3. Tabela de unidades ----------------------------------------------
    st.markdown("##### 3️⃣ Tabela de unidades")
    arquivo_tabela = st.file_uploader(
        "Envie a tabela de valores (Excel ou CSV, até 50 MB)",
        type=["xlsx", "xls", "csv"],
        key="up_reajustar",
    )
    if arquivo_tabela:
        with st.spinner("Lendo planilha..."):
            df_valores = ler_planilha(arquivo_tabela.getvalue(), arquivo_tabela.name)
        st.dataframe(df_valores.head(10), use_container_width=True)

        coluna_valor = st.selectbox("Coluna de valores a reajustar", df_valores.columns)

        if percentual_total == 0 and valor_bruto == 0:
            st.warning("Defina o INCC do mês e/ou um acréscimo antes de reajustar.")
        elif st.button("Reajustar e gerar nova tabela", type="primary"):
            with st.spinner("Aplicando reajuste com precisão Decimal..."):
                df_resultado = reajustar_tabela_mensal(
                    df_valores, coluna_valor, percentual_total, valor_bruto
                )
            st.success("Reajuste aplicado!")
            st.dataframe(df_resultado, use_container_width=True)

            col_dl1, col_dl2 = st.columns(2)
            with col_dl1:
                excel_buffer = BytesIO()
                df_resultado.to_excel(excel_buffer, index=False, engine="openpyxl")
                st.download_button(
                    "⬇️ Baixar Excel reajustado",
                    data=excel_buffer.getvalue(),
                    file_name="tabela_reajustada.xlsx",
                    mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    use_container_width=True,
                )
            with col_dl2:
                pdf_buffer = gerar_pdf_executivo(df_resultado, coluna_valor, resumo_reajuste)
                st.download_button(
                    "⬇️ Baixar PDF executivo",
                    data=pdf_buffer.getvalue(),
                    file_name="resumo_reajuste.pdf",
                    mime="application/pdf",
                    use_container_width=True,
                )
