"""Ribeira Tabelas — app Streamlit com login, detecção de padrão, comparação
de versões e reajuste por INCC."""
from datetime import datetime
from io import BytesIO

import streamlit as st

from src.auth import fazer_logout, usuario_atual, verificar_login
from src.comparador import comparar_versoes
from src.detector import detectar_padrao
from src.incc import INDICES_EXEMPLO, buscar_indices_incc_di, carregar_indices_csv, reajustar_tabela
from src.utils import gerar_pdf_executivo, ler_planilha

st.set_page_config(page_title="Ribeira Tabelas", page_icon="📊", layout="wide")

verificar_login()  # bloqueia tudo abaixo até o login ser feito

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
        fazer_logout()

st.divider()

aba_detectar, aba_comparar, aba_reajustar = st.tabs(
    ["🔍 Detectar Padrão", "🔁 Comparar Versões", "📈 Reajustar por INCC"]
)

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

    fonte_indices = st.radio(
        "Fonte dos índices",
        ["API oficial (BCB/FGV INCC-DI)", "Enviar CSV próprio", "Exemplo (apenas teste)"],
        horizontal=True,
    )

    indices: dict = {}

    if fonte_indices == "API oficial (BCB/FGV INCC-DI)":
        st.caption(
            "Busca a série oficial do INCC-DI (calculada pela FGV) via API do "
            "Banco Central (SGS, série 7456) — gratuita, sem necessidade de chave."
        )
        col_a, col_b = st.columns(2)
        with col_a:
            data_inicial = st.date_input("Data inicial do período")
        with col_b:
            data_final = st.date_input("Data final do período")

        if st.button("Buscar índices na API do BCB"):
            try:
                with st.spinner("Consultando API do Banco Central..."):
                    indices = buscar_indices_incc_di(
                        data_inicial.strftime("%d/%m/%Y"), data_final.strftime("%d/%m/%Y")
                    )
                st.session_state["indices_incc"] = indices
                st.success(f"{len(indices)} competências carregadas da API oficial.")
            except Exception as exc:  # noqa: BLE001
                st.error(f"Falha ao consultar a API do BCB: {exc}")

        indices = st.session_state.get("indices_incc", {})

    elif fonte_indices == "Enviar CSV próprio":
        arquivo_indices = st.file_uploader(
            "Tabela de índices INCC (CSV com colunas `competencia,indice`)", type=["csv"], key="up_indices"
        )
        if arquivo_indices:
            indices = carregar_indices_csv(arquivo_indices.getvalue())

    else:
        st.caption("⚠️ Valores ilustrativos — não usar para reajustes reais de contrato.")
        indices = INDICES_EXEMPLO

    if not indices:
        st.info("Selecione e carregue uma fonte de índices para continuar.")
        st.stop()

    competencias = sorted(indices.keys())
    col1, col2 = st.columns(2)
    with col1:
        competencia_inicial = st.selectbox("Competência inicial", competencias, index=0)
    with col2:
        competencia_final = st.selectbox("Competência final", competencias, index=len(competencias) - 1)

    arquivo_tabela = st.file_uploader(
        "Tabela de valores a reajustar", type=["xlsx", "xls", "csv"], key="up_reajustar"
    )
    if arquivo_tabela:
        with st.spinner("Lendo planilha..."):
            df_valores = ler_planilha(arquivo_tabela.getvalue(), arquivo_tabela.name)

        coluna_valor = st.selectbox("Coluna de valores", df_valores.columns)

        if st.button("Reajustar"):
            with st.spinner("Aplicando reajuste com precisão Decimal..."):
                df_resultado = reajustar_tabela(
                    df_valores, coluna_valor, indices[competencia_inicial], indices[competencia_final]
                )
            st.dataframe(df_resultado, use_container_width=True)

            excel_buffer = BytesIO()
            df_resultado.to_excel(excel_buffer, index=False, engine="openpyxl")
            st.download_button(
                "⬇️ Baixar Excel reajustado",
                data=excel_buffer.getvalue(),
                file_name="tabela_reajustada.xlsx",
                mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )

            pdf_buffer = gerar_pdf_executivo(df_resultado, coluna_valor, competencia_inicial, competencia_final)
            st.download_button(
                "⬇️ Baixar PDF executivo",
                data=pdf_buffer.getvalue(),
                file_name="resumo_reajuste.pdf",
                mime="application/pdf",
            )
