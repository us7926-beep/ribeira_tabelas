"""PATCH /empreendimentos/{id}/geoloc — ajuste manual do pin no /mapa (PR #99)."""
from unittest.mock import MagicMock

from tests.conftest import auth_headers, cliente  # noqa: F401


def test_geoloc_grava_lat_lng_e_marca_manual(cliente, monkeypatch):
    """Coords válidas → grava com geoloc_manual=True e devolve o registro."""
    atualizar = MagicMock(return_value={
        "id": "abc123",
        "nome": "Torre X",
        "latitude": -23.5,
        "longitude": -46.6,
        "geoloc_manual": True,
    })
    monkeypatch.setattr("api.db.atualizar", atualizar)

    resposta = cliente.patch(
        "/empreendimentos/abc123/geoloc",
        headers=auth_headers(cliente),
        json={"latitude": -23.5, "longitude": -46.6},
    )
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["ok"] is True
    assert corpo["empreendimento"]["geoloc_manual"] is True
    # Pede só os 3 campos, nem mais nem menos
    tabela, id_, campos = atualizar.call_args.args
    assert tabela == "empreendimentos"
    assert id_ == "abc123"
    assert campos == {"latitude": -23.5, "longitude": -46.6, "geoloc_manual": True}


def test_geoloc_recusa_latitude_fora_do_intervalo(cliente):
    """Lat > 90 é lixo — bloqueia antes de tocar no banco."""
    resposta = cliente.patch(
        "/empreendimentos/abc123/geoloc",
        headers=auth_headers(cliente),
        json={"latitude": 91.0, "longitude": -46.6},
    )
    assert resposta.status_code == 400


def test_geoloc_recusa_longitude_fora_do_intervalo(cliente):
    resposta = cliente.patch(
        "/empreendimentos/abc123/geoloc",
        headers=auth_headers(cliente),
        json={"latitude": -23.5, "longitude": 181.0},
    )
    assert resposta.status_code == 400


def test_geoloc_404_quando_empreendimento_nao_existe(cliente, monkeypatch):
    """db.atualizar devolve None quando o id não existe → 404."""
    monkeypatch.setattr("api.db.atualizar", lambda *_a, **_k: None)
    resposta = cliente.patch(
        "/empreendimentos/inexistente/geoloc",
        headers=auth_headers(cliente),
        json={"latitude": -23.5, "longitude": -46.6},
    )
    assert resposta.status_code == 404


def test_geoloc_exige_autenticacao(cliente):
    resposta = cliente.patch(
        "/empreendimentos/abc123/geoloc",
        json={"latitude": -23.5, "longitude": -46.6},
    )
    assert resposta.status_code == 401
