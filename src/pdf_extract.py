"""Extração minuciosa de tabelas de PDFs (tabelas de concorrentes em PDF).

Usa pdfplumber (puro Python, sem dependência de sistema), que funciona no
Streamlit Cloud. Varre todas as páginas e tenta duas estratégias de detecção
(linhas e texto), reunindo todas as tabelas encontradas para o usuário escolher.

Limitação: PDFs escaneados (imagem) não têm texto e precisariam de OCR — não
são cobertos aqui; nesse caso ``extrair_tabelas_pdf`` retorna lista vazia.
"""
import io

import pandas as pd

# Estratégias de detecção: "lines" para tabelas com grade desenhada; "text"
# para tabelas alinhadas por espaçamento, sem bordas.
_ESTRATEGIAS = (
    {"vertical_strategy": "lines", "horizontal_strategy": "lines"},
    {"vertical_strategy": "text", "horizontal_strategy": "text"},
)


def _limpar(valor) -> str:
    return "" if valor is None else str(valor).replace("\n", " ").strip()


def _tabela_para_df(linhas: list[list], primeira_linha_cabecalho: bool) -> pd.DataFrame | None:
    """Converte a matriz crua do pdfplumber em DataFrame limpo (ou None se vazia)."""
    linhas = [[_limpar(c) for c in linha] for linha in linhas if linha]
    linhas = [linha for linha in linhas if any(linha)]  # descarta linhas vazias
    if not linhas:
        return None

    largura = max(len(linha) for linha in linhas)
    linhas = [linha + [""] * (largura - len(linha)) for linha in linhas]  # iguala colunas

    if primeira_linha_cabecalho and len(linhas) >= 2:
        cabecalho = _nomes_unicos(linhas[0], largura)
        df = pd.DataFrame(linhas[1:], columns=cabecalho)
    else:
        df = pd.DataFrame(linhas, columns=[f"col_{i + 1}" for i in range(largura)])

    df = df.loc[:, [c for c in df.columns if c != "" or True]]  # mantém ordem
    return df if not df.empty else None


def _nomes_unicos(cabecalho: list[str], largura: int) -> list[str]:
    """Garante nomes de coluna não-vazios e únicos."""
    nomes, vistos = [], {}
    for i in range(largura):
        bruto = cabecalho[i] if i < len(cabecalho) and cabecalho[i] else f"col_{i + 1}"
        if bruto in vistos:
            vistos[bruto] += 1
            bruto = f"{bruto}_{vistos[bruto]}"
        else:
            vistos[bruto] = 0
        nomes.append(bruto)
    return nomes


def extrair_tabelas_pdf(
    conteudo_bytes: bytes, primeira_linha_cabecalho: bool = True
) -> list[tuple[str, pd.DataFrame]]:
    """Extrai todas as tabelas do PDF, em todas as páginas e estratégias.

    Retorna lista de ``(descrição, DataFrame)``, sem duplicatas. ``descrição``
    indica a página e a estratégia de origem.
    """
    import pdfplumber

    resultado: list[tuple[str, pd.DataFrame]] = []
    assinaturas: set[tuple] = set()

    with pdfplumber.open(io.BytesIO(conteudo_bytes)) as pdf:
        for n_pagina, pagina in enumerate(pdf.pages, start=1):
            for estrategia in _ESTRATEGIAS:
                try:
                    tabelas = pagina.extract_tables(table_settings=estrategia)
                except Exception:  # noqa: BLE001 — estratégia pode falhar em página atípica
                    continue
                for tabela in tabelas:
                    df = _tabela_para_df(tabela, primeira_linha_cabecalho)
                    if df is None or df.shape[1] < 2:  # ignora "tabelas" de 1 coluna
                        continue
                    assinatura = (df.shape, tuple(df.columns), tuple(df.iloc[0]))
                    if assinatura in assinaturas:
                        continue
                    assinaturas.add(assinatura)
                    nome_estrategia = estrategia["vertical_strategy"]
                    resultado.append((f"página {n_pagina} ({nome_estrategia})", df))

    return resultado
