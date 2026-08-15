"""Extração de tabelas de PDF por layout (pdfplumber).

Complementa o Gemini na extração de tabelas de preços:
- Gemini entende **estrutura** (que aquilo é tabela de preços, quais colunas
  são o que, promoções, padrão inferido) mas às vezes erra números por
  causa do formato brasileiro (`R$ 1.234,56` × `1,234.56`) ou pula linhas.
- pdfplumber lê **coordenadas** de células — números vêm exatos do PDF,
  linhas não somem por acidente. Não sabe nada de semântica.

O merge é conservador: Gemini traz a estrutura, pdfplumber substitui os
valores numéricos por unidade quando encontra a mesma unidade na sua
tabela extraída por layout.
"""
from __future__ import annotations

import io
import re
from typing import Any

# Deixa o import lazy pra não quebrar quando pdfplumber não estiver instalado
# (o backend em produção sim, mas testes locais que não importam este módulo
# não devem carregar a dep).
_pdfplumber = None


def _lazy_pdfplumber():
    global _pdfplumber
    if _pdfplumber is None:
        import pdfplumber

        _pdfplumber = pdfplumber
    return _pdfplumber


_RX_BR = re.compile(r"[^\d,.\-]")


def _num_br(valor: Any) -> float | None:
    """Converte '1.234,56', 'R$ 47.500,00', '40,900 m²' etc em float.

    Regra: remove tudo que não é dígito/vírgula/ponto/menos; se tem
    vírgula, é decimal BR (ponto = milhar); senão é decimal US ou
    inteiro. Retorna None quando não dá pra converter.
    """
    if valor is None:
        return None
    if isinstance(valor, (int, float)):
        return float(valor)
    texto = _RX_BR.sub("", str(valor).strip())
    if not texto:
        return None
    if "," in texto:
        # BR: ponto é milhar; vírgula é decimal.
        texto = texto.replace(".", "").replace(",", ".")
    try:
        return float(texto)
    except (TypeError, ValueError):
        return None


def _colunas_por_palavra_chave(cabecalho: list[str]) -> dict[str, int]:
    """Mapeia palavras-chave -> índice da coluna baseado no header.

    Retorna dict com as chaves que a gente cuida: unidade, area_m2,
    preco_total, entrada, parcelas_mensais, financiamento. Faltantes não
    entram no dict (frontend/caller decide o que fazer).
    """
    if not cabecalho:
        return {}
    mapa: dict[str, int] = {}
    for i, cel in enumerate(cabecalho):
        rotulo = (cel or "").strip().lower()
        if not rotulo:
            continue
        # unidade
        if "unidade" in rotulo or "apto" in rotulo or "apart" in rotulo:
            mapa.setdefault("unidade", i)
        # área
        elif "area" in rotulo or "área" in rotulo or "priv" in rotulo or "m²" in rotulo or "m2" in rotulo or "metragem" in rotulo:
            mapa.setdefault("area_m2", i)
        # valor total
        elif "valor" in rotulo or "preço" in rotulo or "preco" in rotulo or "r$" in rotulo or "total" in rotulo:
            mapa.setdefault("preco_total", i)
        # entrada / ato
        elif "entrada" in rotulo or "ato" in rotulo:
            mapa.setdefault("entrada", i)
        # parcelas mensais
        elif "mensal" in rotulo or "mensai" in rotulo or "parcela" in rotulo:
            mapa.setdefault("parcelas_mensais", i)
        # financiamento
        elif "financ" in rotulo:
            mapa.setdefault("financiamento", i)
    return mapa


_RX_HEADER = re.compile(
    r"\b(unidade|apto|apart|valor|preço|preco|área|area|metragem|financ|entrada"
    r"|situação|situacao|status)\b",
    re.IGNORECASE,
)


def _tem_header_valido(cabecalho: list[str]) -> bool:
    """True quando o header tem pelo menos uma palavra-chave conhecida —
    diferencia 'header real' de 'primeira linha de dados' (que o pdfplumber
    às vezes trata como header quando não existe cabeçalho na tabela).

    Usa word-boundary pra não confundir '33,03 m²' (linha de dados) com
    uma coluna "M²": aqui só matcha se a keyword aparecer como palavra
    inteira, não sufixo de número.
    """
    for cel in cabecalho:
        if cel and _RX_HEADER.search(cel):
            return True
    return False


def extrair_tabelas_pdf(conteudo: bytes) -> list[dict]:
    """Extrai todas as unidades de tabelas em qualquer página do PDF.

    Retorna uma lista de dicts com chaves canônicas (unidade, area_m2,
    preco_total, entrada, parcelas_mensais, financiamento) — só os que
    a gente consegue mapear pelo header. Se o PDF não tem tabelas
    detectáveis por layout, devolve [].

    Suporta tabelas continuação (páginas seguintes sem repetir header):
    guarda o último mapa válido do documento e reusa quando uma tabela
    nova vem sem header conhecido (comportamento típico do export do
    CV CRM, onde só a página 1 tem "UNIDADE / ÁREA / VALOR / ...").
    """
    plumber = _lazy_pdfplumber()
    unidades: list[dict] = []
    ultimo_mapa: dict[str, int] = {}
    try:
        with plumber.open(io.BytesIO(conteudo)) as pdf:
            for pagina in pdf.pages:
                for tabela in pagina.extract_tables() or []:
                    if not tabela:
                        continue
                    primeira = [(c or "").strip() for c in tabela[0]]
                    if _tem_header_valido(primeira):
                        # Cabeçalho real na 1a linha
                        mapa = _colunas_por_palavra_chave(primeira)
                        linhas = tabela[1:]
                    elif len(tabela) > 1 and _tem_header_valido(
                        [(c or "").strip() for c in tabela[1]]
                    ):
                        # 1a linha é metadata (nome da tabela, logo); header é 2a
                        cabecalho2 = [(c or "").strip() for c in tabela[1]]
                        mapa = _colunas_por_palavra_chave(cabecalho2)
                        linhas = tabela[2:]
                    elif ultimo_mapa:
                        # Continuação — usa o mapa do último header válido
                        mapa = ultimo_mapa
                        linhas = tabela
                    else:
                        # Sem header e sem mapa prévio: não dá pra saber o
                        # que é cada coluna. Pula.
                        continue

                    if not mapa.get("unidade") and not mapa.get("preco_total"):
                        continue
                    ultimo_mapa = mapa  # guarda pra próximas tabelas sem header

                    for linha in linhas:
                        if not linha or all(c in (None, "") for c in linha):
                            continue
                        registro: dict[str, Any] = {}
                        idx_u = mapa.get("unidade")
                        if idx_u is not None and idx_u < len(linha):
                            u = (linha[idx_u] or "").strip()
                            if u:
                                registro["unidade"] = u
                        for chave in ("area_m2", "preco_total", "entrada",
                                      "parcelas_mensais", "financiamento"):
                            idx = mapa.get(chave)
                            if idx is None or idx >= len(linha):
                                continue
                            num = _num_br(linha[idx])
                            if num is not None:
                                registro[chave] = num
                        if registro:
                            unidades.append(registro)
    except Exception:  # noqa: BLE001
        return []
    return unidades


# Campos que o pdfplumber pode substituir com segurança — só métricas
# "objetivas" que vêm de uma célula única do PDF. NÃO inclui
# entrada/parcelas_mensais/financiamento porque tabelas do CV CRM
# quebram esses valores em várias colunas (ATO / SINAL 30/60/90 /
# MENSAIS / ANUAL / ÚNICA / FINANCIAMENTO / …) e a semântica de "entrada"
# ou "parcelas mensais" depende do contexto que só o Gemini enxerga.
_CAMPOS_CONFIAVEIS_PDF = ("area_m2", "preco_total")


def mesclar_com_gemini(
    unidades_gemini: list[dict], unidades_pdf: list[dict]
) -> list[dict]:
    """Mescla resultados: Gemini domina estrutura + semântica, pdfplumber
    corrige as métricas objetivas (area_m2 e preco_total).

    Regra: pra cada unidade extraída pelo Gemini, procura a mesma
    'unidade' (case-insensitive, trim) nas unidades do pdfplumber. Se
    achar, **substitui** apenas os campos em ``_CAMPOS_CONFIAVEIS_PDF``
    pelo valor do pdfplumber (leitura direta do PDF, mais precisa que
    LLM em números BR).

    NÃO substitui entrada/parcelas_mensais/financiamento porque a
    interpretação depende de contexto que só o Gemini enxerga (ex.: no
    export do CV CRM, "entrada" pode significar apenas o ATO ou a soma
    de ATO + SINAL 30/60/90 dependendo da política comercial).

    Unidades do pdfplumber que não batem com nenhuma do Gemini ficam de
    fora — Gemini teria dado alguma estrutura semântica pra elas se
    fossem válidas. Isso protege contra pdfplumber pegar tabelas de
    outra seção (índices, fluxo comercial, cabeçalho, etc).
    """
    if not unidades_pdf or not unidades_gemini:
        return unidades_gemini

    def _norm(u: str) -> str:
        return re.sub(r"\s+", "", str(u or "")).lower()

    mapa_pdf = {}
    for u in unidades_pdf:
        chave = _norm(u.get("unidade") or "")
        if chave:
            mapa_pdf[chave] = u

    mescladas = []
    for gem in unidades_gemini:
        copia = dict(gem)
        chave = _norm(gem.get("unidade") or "")
        if chave and chave in mapa_pdf:
            pdf_row = mapa_pdf[chave]
            for c in _CAMPOS_CONFIAVEIS_PDF:
                if pdf_row.get(c) is not None:
                    copia[c] = pdf_row[c]
        mescladas.append(copia)
    return mescladas
