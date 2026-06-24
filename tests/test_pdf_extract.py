"""Testes da extração de tabelas de PDF (ida-e-volta com reportlab)."""
import io

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.platypus import Paragraph, SimpleDocTemplate, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet

from src.pdf_extract import _tabela_para_df, extrair_tabelas_pdf


def _pdf_com_tabela(dados: list[list[str]]) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    tabela = Table(dados)
    tabela.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.8, colors.black)]))
    doc.build([tabela])
    return buffer.getvalue()


def _pdf_so_texto(texto: str) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    doc.build([Paragraph(texto, getSampleStyleSheet()["Normal"])])
    return buffer.getvalue()


# --- caminho feliz ---------------------------------------------------------- #
def test_deve_extrair_tabela_com_cabecalho_quando_pdf_tem_grade():
    dados = [["Unidade", "Area", "Valor"], ["101", "50", "500000"], ["102", "60", "600000"]]
    tabelas = extrair_tabelas_pdf(_pdf_com_tabela(dados))

    assert len(tabelas) >= 1
    _, df = tabelas[0]
    assert list(df.columns) == ["Unidade", "Area", "Valor"]
    assert df.iloc[0].tolist() == ["101", "50", "500000"]
    assert len(df) == 2


# --- borda: PDF sem tabela -------------------------------------------------- #
def test_deve_retornar_lista_vazia_quando_pdf_nao_tem_tabela():
    tabelas = extrair_tabelas_pdf(_pdf_so_texto("Apenas um texto sem tabela alguma."))
    assert tabelas == []


# --- _tabela_para_df: unidades ---------------------------------------------- #
def test_deve_igualar_colunas_quando_linhas_tem_tamanhos_diferentes():
    df = _tabela_para_df([["A", "B", "C"], ["1", "2"]], primeira_linha_cabecalho=True)
    assert list(df.columns) == ["A", "B", "C"]
    assert df.iloc[0].tolist() == ["1", "2", ""]  # linha curta foi preenchida


def test_deve_gerar_nomes_unicos_quando_cabecalho_repetido():
    df = _tabela_para_df([["Valor", "Valor"], ["1", "2"]], primeira_linha_cabecalho=True)
    assert list(df.columns) == ["Valor", "Valor_1"]


def test_deve_retornar_none_quando_tabela_vazia():
    assert _tabela_para_df([], primeira_linha_cabecalho=True) is None
    assert _tabela_para_df([[None, None]], primeira_linha_cabecalho=True) is None
