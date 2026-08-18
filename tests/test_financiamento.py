"""POST /financiamento/calcular-renda + fórmula Price (PR #68)."""


from tests.conftest import auth_headers, cliente  # noqa: F401

# --------------------------------------------------------------------------- #
# POST /financiamento/calcular-renda (FEATURE_CALCULO_RENDA)
# --------------------------------------------------------------------------- #
def _renda_body(**over):
    base = {
        "parcela_obra_mensal": 1600.0,
        "saldo_financiar": 354400.0,
        "modalidade": "mcmv_faixa3",
        "prazo_meses": 360,
        "percentual_renda": 0.30,
    }
    base.update(over)
    return base


def test_deve_devolver_taxa_e_renda_quando_modalidade_mcmv_faixa1(cliente):
    r = cliente.post(
        "/financiamento/calcular-renda",
        headers=auth_headers(cliente),
        json=_renda_body(modalidade="mcmv_faixa1"),
    )
    assert r.status_code == 200
    corpo = r.json()
    assert corpo["taxa_anual_usada"] == 4.5
    assert corpo["label_modalidade"] == "MCMV Faixa 1"
    assert corpo["parcela_financiamento"] > 0
    assert corpo["renda_necessaria"] > corpo["total_mensal_comprometido"]
    # Faixa1 não emite alerta TR
    assert all("TR" not in a for a in corpo["alertas"])


def test_deve_devolver_alerta_tr_quando_modalidade_sbpe(cliente):
    r = cliente.post(
        "/financiamento/calcular-renda",
        headers=auth_headers(cliente),
        json=_renda_body(modalidade="sbpe"),
    )
    assert r.status_code == 200
    corpo = r.json()
    assert corpo["label_modalidade"] == "SBPE"
    assert corpo["taxa_anual_usada"] == 11.19
    # Alerta de TR especifico do SBPE entra no meio da lista
    assert any("TR" in a for a in corpo["alertas"])


def test_deve_aceitar_taxa_personalizada_quando_modalidade_personalizada(cliente):
    r = cliente.post(
        "/financiamento/calcular-renda",
        headers=auth_headers(cliente),
        json=_renda_body(modalidade="personalizada", taxa_personalizada_anual=9.5),
    )
    assert r.status_code == 200
    corpo = r.json()
    assert corpo["taxa_anual_usada"] == 9.5
    assert corpo["label_modalidade"] == "Personalizada"


def test_deve_retornar_400_quando_personalizada_sem_taxa(cliente):
    r = cliente.post(
        "/financiamento/calcular-renda",
        headers=auth_headers(cliente),
        json=_renda_body(modalidade="personalizada"),
    )
    assert r.status_code == 400
    assert "taxa_personalizada_anual" in r.json()["detail"]


def test_deve_retornar_422_quando_prazo_fora_do_intervalo(cliente):
    r = cliente.post(
        "/financiamento/calcular-renda",
        headers=auth_headers(cliente),
        json=_renda_body(prazo_meses=5),  # < 12, viola Field(ge=12)
    )
    assert r.status_code == 422  # Pydantic validation


def test_deve_calcular_parcela_price_pelo_servico_isolado():
    """Cobertura direta do helper — independente do endpoint."""
    from api import financiamento

    # PV=100000, taxa=12% a.a. -> i_mensal ~= 0.9489%, n=12 meses
    # PMT esperado proximo a R$ 8.880 (Tabela Price 12% a.a. 12 meses)
    i_mensal = financiamento._taxa_anual_para_mensal(12.0)
    parcela = financiamento._parcela_price(100_000.0, i_mensal, 12)
    assert 8800 < parcela < 8900
