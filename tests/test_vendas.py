"""/vendas/kpis: coluna explícita, inferência por nome, inferência por composição."""
from tests.conftest import cliente, post_vendas  # noqa: F401


def test_vendas_kpis_via_csv(cliente):
    csv = b"unidade,valor,status\n101,100000,Vendido\n102,200000,Disponivel\n103,150000,Disponivel\n"
    corpo = post_vendas(cliente, csv)
    kpis = corpo["kpis"]
    assert kpis["total_unidades"] == 3
    assert kpis["vendidas"] == 1
    assert kpis["disponiveis"] == 2
    # Sem coluna de modalidade nem sinais inferiveis -> nao monta distribuicao
    assert "distribuicao" not in corpo
    assert corpo["colunas"]["modalidade_origem"] is None


def test_vendas_kpis_modalidade_explicita(cliente):
    """Coluna `modalidade` dedicada: agrupa direto e marca origem 'explicita'."""
    csv = (
        b"unidade,valor,status,modalidade\n"
        b"101,100000,Vendido,FGTS\n"
        b"102,200000,Vendido,Financiamento\n"
        b"103,150000,Vendido,FGTS\n"
        b"104,180000,Disponivel,FGTS\n"
    )
    corpo = post_vendas(cliente, csv)
    assert corpo["colunas"]["modalidade_origem"] == "explicita"
    assert corpo["colunas"]["modalidade"] == "modalidade"
    distrib = {linha["modalidade"]: linha for linha in corpo["distribuicao"]}
    # so unidades VENDIDAS entram (104 esta Disponivel)
    assert distrib["FGTS"]["unidades_vendidas"] == 2
    assert distrib["Financiamento"]["unidades_vendidas"] == 1
    assert distrib["FGTS"]["vgv"] == 250000.0


def test_vendas_kpis_modalidade_inferida_por_nome(cliente):
    """Sem coluna dedicada, mas nome da unidade carrega FGTS/MCMV/SBPE."""
    csv = (
        b"unidade,valor,status\n"
        b"Apt 101 FGTS,100000,Vendido\n"
        b"Apt 102 MCMV,200000,Vendido\n"
        b"Apt 103 FGTS,150000,Vendido\n"
        b"Apt 104 SBPE,180000,Disponivel\n"
    )
    corpo = post_vendas(cliente, csv)
    assert corpo["colunas"]["modalidade_origem"] == "inferida"
    distrib = {linha["modalidade"]: linha for linha in corpo["distribuicao"]}
    assert distrib["FGTS"]["unidades_vendidas"] == 2
    assert distrib["MCMV"]["unidades_vendidas"] == 1
    # SBPE estava Disponivel -> nao entra
    assert "SBPE" not in distrib


def test_vendas_kpis_modalidade_inferida_por_composicao(cliente):
    """Sem coluna dedicada nem nome conhecido: classifica pela composicao
    (subsidio>0 -> MCMV; financ>0 e entrada<25% -> Financiamento; so
    entrada ~ total -> A vista). Nome 'valor_financiado' evita o detect
    de modalidade pegar 'financiamento' como rotulo."""
    csv = (
        b"unidade,valor,status,entrada,valor_financiado,subsidio\n"
        b"101,300000,Vendido,30000,270000,0\n"
        b"102,200000,Vendido,200000,0,0\n"
        b"103,250000,Vendido,50000,175000,25000\n"
    )
    corpo = post_vendas(cliente, csv)
    assert corpo["colunas"]["modalidade_origem"] == "inferida"
    distrib = {linha["modalidade"]: linha for linha in corpo["distribuicao"]}
    assert distrib["Financiamento"]["unidades_vendidas"] == 1
    assert distrib["À vista"]["unidades_vendidas"] == 1
    assert distrib["MCMV"]["unidades_vendidas"] == 1
