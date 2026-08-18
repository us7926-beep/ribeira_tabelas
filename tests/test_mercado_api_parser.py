"""mercado_api.normalizar_unidades + parser CSV formato CV CRM (PR #86)."""

from tests.conftest import auth_headers, cliente, post_vendas  # noqa: F401

import pytest


# --------------------------------------------------------------------------- #
# Parser CSV de Tabela de Precos — normalizar_unidades (fix smoke 2026-06-27)
# --------------------------------------------------------------------------- #
def test_normalizar_unidades_mapeia_csv_para_schema_canonico():
    """CSV "valor,area" deve virar registros com preco_total/area_m2 — sem
    isso, kpisDaVersao no frontend devolvia 0 e o sparkline trio ficava
    vazio."""
    import io

    import pandas as pd

    from api import mercado_api

    csv = "unidade,area_m2,valor\n101,50,500000\n102,60,600000\n"
    df = pd.read_csv(io.StringIO(csv))
    unidades = mercado_api.normalizar_unidades(df)
    assert len(unidades) == 2
    assert unidades[0]["preco_total"] == 500000
    assert unidades[0]["area_m2"] == 50
    assert unidades[0]["unidade"] == "101"
    assert unidades[1]["preco_total"] == 600000


def test_normalizar_unidades_reconhece_sinonimos_de_coluna():
    """Aceita area/metragem/preco/r$ etc — substring case-insensitive."""
    import io

    import pandas as pd

    from api import mercado_api

    csv = "Apto,Metragem,Preço (R$)\nA-01,72,820000\n"
    df = pd.read_csv(io.StringIO(csv))
    unidades = mercado_api.normalizar_unidades(df)
    assert len(unidades) == 1
    assert unidades[0]["preco_total"] == 820000
    assert unidades[0]["area_m2"] == 72
    assert unidades[0]["unidade"] == "A-01"


def test_normalizar_unidades_inclui_opcionais_quando_presentes():
    """Andar, vaga, entrada, parcelas_mensais, financiamento entram quando
    a coluna existe — caso contrario ficam de fora (nao viram null
    forcado)."""
    import io

    import pandas as pd

    from api import mercado_api

    csv = (
        "unidade,andar,vaga,area_m2,valor,entrada,parcelas_mensais,financiamento\n"
        "101,5,1,50,500000,50000,3000,400000\n"
    )
    df = pd.read_csv(io.StringIO(csv))
    unidades = mercado_api.normalizar_unidades(df)
    assert unidades[0]["andar"] == "5"
    assert unidades[0]["vaga"] == "1"
    assert unidades[0]["entrada"] == 50000
    assert unidades[0]["parcelas_mensais"] == 3000
    assert unidades[0]["financiamento"] == 400000


def test_normalizar_unidades_devolve_vazio_sem_colunas_obrigatorias():
    """Sem coluna de valor OU area, devolve []. O caller decide se isso
    eh erro ou apenas registro vazio."""
    import io

    import pandas as pd

    from api import mercado_api

    csv = "qualquer,outra\nx,y\n"
    df = pd.read_csv(io.StringIO(csv))
    assert mercado_api.normalizar_unidades(df) == []


def test_normalizar_unidades_pula_linhas_sem_valor_nem_area():
    import io

    import pandas as pd

    from api import mercado_api

    csv = "unidade,area_m2,valor\n101,50,500000\n102,,\n"
    df = pd.read_csv(io.StringIO(csv))
    unidades = mercado_api.normalizar_unidades(df)
    assert len(unidades) == 1
    assert unidades[0]["unidade"] == "101"


# --------------------------------------------------------------------------- #
# Parser CSV no formato do CV CRM (fix smoke 2026-07-03): separador ';',
# BOM UTF-8, header multilinha entre aspas, valores "R$ 1.234,56" / "40,9 m²"
# e coluna FINANCIAMENTO numérica que não pode virar modalidade.
# --------------------------------------------------------------------------- #
_CSV_CVCRM = (
    'UNIDADE;"ÁREA PRIVATIVA";SITUAÇÃO;"VALOR TOTAL";"ATO (1x) 5,00% \n'
    '01/07/2026";"FINANCIAMENTO (1x) 80,00% \n'
    '30/09/2026";"PARCELAS MENSAIS (36x) 9,95% \n'
    '10/09/2026"\n'
    'T1-011;"40,900 m²";Vendida;"R$ 357.934,53";"R$ 17.896,73";"R$ 286.347,62";"R$ 989,29"\n'
    'T1-016;"42,190 m²";Disponível;"R$ 357.934,53";"R$ 17.896,73";"R$ 286.347,62";"R$ 989,29"\n'
    'T2-014;"42,240 m²";Bloqueada;"R$ 357.934,53";"R$ 17.896,73";"R$ 286.347,62";"R$ 989,29"\n'
)
_CSV_CVCRM_BYTES = b"\xef\xbb\xbf" + _CSV_CVCRM.encode("utf-8")


def test_ler_planilha_detecta_separador_ponto_e_virgula_e_bom():
    from api import mercado_api

    df = mercado_api.ler_planilha(_CSV_CVCRM_BYTES, "total braz cubas- 07-26.csv")
    assert df.shape == (3, 7)
    assert list(df.columns)[0] == "UNIDADE"  # BOM não vaza pro nome da coluna


def test_ler_planilha_csv_latin1_nao_explode():
    from api import mercado_api

    csv = "unidade;área;preço\n101;50;1.000,50\n".encode("latin-1")
    df = mercado_api.ler_planilha(csv, "tabela.csv")
    assert df.shape == (1, 3)
    assert "área" in df.columns


def test_para_numero_formatos_brasileiros():
    from src import mercado

    assert mercado.para_numero("R$ 357.934,53") == 357934.53
    assert mercado.para_numero("40,900 m²") == 40.9
    assert mercado.para_numero("472.436") == 472436
    assert mercado.para_numero("47.44") == 47.44
    assert mercado.para_numero(1500) == 1500.0
    assert mercado.para_numero("—") is None
    assert mercado.para_numero("") is None
    assert mercado.para_numero(None) is None


def test_normalizar_unidades_formato_cvcrm_popula_schema_canonico():
    from api import mercado_api

    df = mercado_api.ler_planilha(_CSV_CVCRM_BYTES, "tabela.csv")
    unidades = mercado_api.normalizar_unidades(df)
    assert len(unidades) == 3
    u = unidades[0]
    assert u["unidade"] == "T1-011"
    assert u["preco_total"] == 357934.53
    assert u["area_m2"] == 40.9
    assert u["situacao"] == "Vendida"
    assert u["entrada"] == 17896.73
    assert u["financiamento"] == 286347.62
    assert u["parcelas_mensais"] == 989.29


def test_vendas_kpis_cvcrm_nao_confunde_financiamento_com_modalidade(cliente):
    """A coluna "FINANCIAMENTO (1x) 80%" traz valores R$ — não é rótulo de
    modalidade. A guarda derruba a detecção explícita e a composição do
    pagamento (entrada 5% < 25% do total) infere Financiamento."""
    corpo = post_vendas(cliente, _CSV_CVCRM_BYTES)
    assert corpo["colunas"]["modalidade"] is None
    assert corpo["colunas"]["modalidade_origem"] == "inferida"
    kpis = corpo["kpis"]
    assert kpis["total_unidades"] == 3
    assert kpis["vendidas"] == 1
    assert kpis["disponiveis"] == 1
    assert kpis["vgv_total"] == pytest.approx(3 * 357934.53)
    assert corpo["distribuicao"] == [
        {"modalidade": "Financiamento", "unidades_vendidas": 1, "vgv": 357934.53}
    ]


def test_comparativo_formato_cvcrm_calcula_kpis(cliente):
    corpo_resposta = cliente.post(
        "/mercado/comparativo",
        headers=auth_headers(cliente),
        files={"arquivo": ("total braz cubas- 07-26.csv", _CSV_CVCRM_BYTES, "text/csv")},
        data={
            "tipo": "Nosso", "incorporadora": "Ribeira", "produto": "TOTAL",
            "cidade": "Mogi das Cruzes", "bairro": "Braz Cubas", "padrao": "Econômico",
        },
    )
    assert corpo_resposta.status_code == 200, corpo_resposta.text
    corpo = corpo_resposta.json()
    assert corpo["linhas"] == 3
    assert corpo["kpis"]["ticket_medio"] == pytest.approx(357934.53)
    assert corpo["colunas_detectadas"]["valor"] == "VALOR TOTAL"
