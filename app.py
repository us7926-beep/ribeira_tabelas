"""TabLM — app Streamlit com login, detecção de padrão, comparação de versões,
reajuste por INCC, dashboards e inteligência de mercado."""
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
from src.utils import gerar_pdf_executivo, ler_planilha

st.set_page_config(page_title="TabLM", page_icon="📊", layout="wide")

cookies = get_cookie_manager()  # instanciado uma vez; persiste o login no refresh
verificar_login(cookies)  # bloqueia tudo abaixo até o login ser feito

# ---------------------------------------------------------------------------
# Cabeçalho de boas-vindas
# ---------------------------------------------------------------------------
col_logo, col_titulo, col_logout = st.columns([1, 6, 1])
with col_logo:
    st.markdown("### 🏗️")
with col_titulo:
    st.markdown(f"**TabLM** · Ribeira Empreendimentos — bem-vindo(a), `{usuario_atual()}`")
    st.caption(f"Última atualização do app: {datetime.now():%d/%m/%Y %H:%M}")
with col_logout:
    if st.button("Sair", use_container_width=True):
        fazer_logout(cookies)

st.divider()

aba_dashboard, aba_mercado, aba_detectar, aba_comparar, aba_reajustar = st.tabs(
    [
        "📊 Dashboards",
        "🏢 Inteligência de Mercado",
        "🔍 Detectar Padrão",
        "🔁 Comparar Versões",
        "📈 Reajustar por INCC",
    ]
)

# ---------------------------------------------------------------------------
# Aba: Inteligência de Mercado e Concorrência
# ---------------------------------------------------------------------------
with aba_mercado:
    st.subheader("Inteligência de Mercado e Concorrência")
    st.caption(
        "Envie tabelas (suas ou de concorrentes), marque incorporadora, produto, "
        "cidade, bairro e padrão, e compare preço/m² e preço total no dashboard."
    )

    if "base_mercado" not in st.session_state:
        st.session_state["base_mercado"] = base_vazia()

    sub_add, sub_base, sub_dash = st.tabs(
        ["➕ Adicionar tabela", "🗂️ Base atual", "📈 Dashboard de mercado"]
    )

    # --- adicionar tabela à base --------------------------------------------
    with sub_add:
        arquivo_mkt = st.file_uploader(
            "Tabela (Excel ou CSV)", type=["xlsx", "xls", "csv"], key="mkt_upload"
        )
        if arquivo_mkt:
            df_mkt = ler_planilha(arquivo_mkt.getvalue(), arquivo_mkt.name)
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
                        tipo=tipo,
                        incorporadora=incorporadora,
                        produto=produto,
                        cidade=cidade,
                        bairro=bairro,
                        padrao=padrao,
                    )
                    st.session_state["base_mercado"] = adicionar_a_base(
                        st.session_state["base_mercado"], novo
                    )
                    st.success(f"{len(novo)} unidades adicionadas ({produto} — {incorporadora}).")

    # --- base atual ----------------------------------------------------------
    with sub_base:
        base = st.session_state["base_mercado"]
        st.metric("Unidades na base", len(base))
        st.dataframe(base, use_container_width=True)
        col_b1, col_b2 = st.columns(2)
        with col_b1:
            if not base.empty:
                st.download_button(
                    "⬇️ Baixar base (CSV)",
                    data=base.to_csv(index=False).encode("utf-8"),
                    file_name="base_mercado.csv",
                    mime="text/csv",
                    use_container_width=True,
                )
        with col_b2:
            if st.button("🗑️ Limpar base", use_container_width=True):
                st.session_state["base_mercado"] = base_vazia()
                st.rerun()

    # --- dashboard de mercado ------------------------------------------------
    with sub_dash:
        base = st.session_state["base_mercado"]
        if base.empty:
            st.info("Adicione ao menos uma tabela na aba **Adicionar tabela**.")
        else:
            kpis = kpis_gerais(base)
            k1, k2, k3, k4 = st.columns(4)
            k1.metric("Unidades", kpis["total_unidades"])
            k2.metric("Incorporadoras", kpis["incorporadoras"])
            k3.metric("Produtos", kpis["produtos"])
            k4.metric("Cidades", kpis["cidades"])

            k5, k6, k7, k8 = st.columns(4)
            k5.metric("Preço/m² médio", f'R$ {kpis["preco_m2_medio"] or 0:,.0f}')
            k6.metric("Preço/m² (nosso)", f'R$ {kpis["preco_m2_nosso"] or 0:,.0f}')
            k7.metric("Preço/m² (concorrentes)", f'R$ {kpis["preco_m2_concorrentes"] or 0:,.0f}')
            k8.metric("Ticket médio", f'R$ {kpis["ticket_medio"] or 0:,.0f}')

            insights = gerar_insights(base)
            if insights:
                st.markdown("#### 💡 Insights")
                for frase in insights:
                    st.markdown(f"- {frase}")

            st.markdown("#### Comparação por dimensão")
            dimensao = st.selectbox(
                "Dimensão", list(DIMENSOES.keys()),
                format_func=lambda d: DIMENSOES[d], key="mkt_dim",
            )
            agregado = comparar_por_dimensao(base, dimensao)
            st.dataframe(agregado, use_container_width=True)

            cg1, cg2 = st.columns(2)
            with cg1:
                fig_pm2 = px.bar(
                    agregado, x=dimensao, y="preco_m2_medio",
                    title=f"Preço/m² médio por {DIMENSOES[dimensao]}",
                )
                st.plotly_chart(fig_pm2, use_container_width=True)
            with cg2:
                fig_disp = px.box(
                    base, x="padrao", y="preco_m2", color="tipo",
                    category_orders={"padrao": PADROES},
                    title="Distribuição de preço/m² por padrão",
                )
                st.plotly_chart(fig_disp, use_container_width=True)

            st.markdown("#### Posicionamento: nós vs. concorrência (por padrão)")
            posicionamento = posicionamento_por_padrao(base)
            st.dataframe(posicionamento, use_container_width=True)

            fig_scatter = px.scatter(
                base, x="area", y="valor", color="tipo", symbol="padrao",
                hover_data=["incorporadora", "produto", "bairro"],
                title="Área × Valor (cor = nosso/concorrente)",
            )
            st.plotly_chart(fig_scatter, use_container_width=True)

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
