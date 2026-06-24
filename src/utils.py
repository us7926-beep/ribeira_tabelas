"""Utilitários de armazenamento e leitura de planilhas, adaptados para nuvem.

O Streamlit Cloud não persiste disco entre reinícios, então qualquer arquivo
gravado aqui é considerado descartável: vive apenas durante a sessão do
container e some quando o app reinicia ou hiberna.
"""
import io
import logging
import tempfile
import uuid
from pathlib import Path

import pandas as pd
import streamlit as st

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("ribeira_tabelas")


def diretorio_temporario() -> Path:
    """Retorna (e cria se preciso) a pasta temporária da sessão atual."""
    base = Path(tempfile.gettempdir()) / "ribeira_tabelas"
    base.mkdir(parents=True, exist_ok=True)
    return base


def salvar_upload_temporario(arquivo_upload) -> Path:
    """Salva um UploadedFile do Streamlit em arquivo temporário e retorna o caminho."""
    destino = diretorio_temporario() / f"{uuid.uuid4().hex}_{arquivo_upload.name}"
    destino.write_bytes(arquivo_upload.getvalue())
    logger.info("Upload salvo temporariamente em %s", destino)
    return destino


@st.cache_data(show_spinner=False)
def ler_planilha(conteudo_bytes: bytes, nome_arquivo: str) -> pd.DataFrame:
    """Lê uma planilha (Excel ou CSV) a partir dos bytes, com cache por sessão.

    Cachear por conteúdo (e não por caminho) evita reler o mesmo arquivo
    quando o usuário navega entre abas do app.
    """
    buffer = io.BytesIO(conteudo_bytes)
    if nome_arquivo.lower().endswith(".csv"):
        return pd.read_csv(buffer)
    return pd.read_excel(buffer)


def gerar_pdf_executivo(df: pd.DataFrame, coluna_valor: str, descricao_reajuste: str) -> io.BytesIO:
    """Gera um PDF executivo resumindo o reajuste aplicado a uma tabela.

    ``descricao_reajuste`` é um texto livre descrevendo o reajuste aplicado
    (ex.: "INCC 0,88% + 1,00% adicional + R$ 500,00 por unidade").
    """
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import cm
    from reportlab.pdfgen import canvas

    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    largura, altura = A4

    pdf.setFont("Helvetica-Bold", 16)
    pdf.drawString(2 * cm, altura - 2 * cm, "Ribeira Empreendimentos — Resumo de Reajuste")

    pdf.setFont("Helvetica", 11)
    linha = altura - 3 * cm
    coluna_reajustada = f"{coluna_valor}_reajustado"
    total_antes = df[coluna_valor].sum()
    total_depois = df[coluna_reajustada].sum() if coluna_reajustada in df.columns else None

    informacoes = [
        f"Reajuste aplicado: {descricao_reajuste}",
        f"Coluna reajustada: {coluna_valor}",
        f"Unidades processadas: {len(df)}",
        f"Total antes do reajuste: R$ {total_antes:,.2f}",
    ]
    if total_depois is not None:
        informacoes.append(f"Total após reajuste: R$ {total_depois:,.2f}")
        informacoes.append(f"Diferença total: R$ {total_depois - total_antes:,.2f}")

    for texto in informacoes:
        pdf.drawString(2 * cm, linha, texto)
        linha -= 0.7 * cm

    pdf.showPage()
    pdf.save()
    buffer.seek(0)
    return buffer


def limpar_temporarios() -> None:
    """Remove arquivos temporários da sessão atual (chamar ao fazer logout)."""
    pasta = diretorio_temporario()
    for item in pasta.glob("*"):
        try:
            item.unlink()
        except OSError:
            logger.warning("Não foi possível remover %s", item)
