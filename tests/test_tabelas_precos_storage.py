"""POST /empreendimentos/{id}/tabelas-precos — arquivamento em Storage (task #35).

Complementa test_ficha_dossie (arquivo original em Storage já era garantido
em /importar-book). Aqui provamos que o mesmo padrão vale pro endpoint
principal que a UI usa (upload de tabela no dossiê / benchmark)."""
from unittest.mock import MagicMock

from tests.conftest import auth_headers, cliente  # noqa: F401


def _registros_tabelas_precos(inserir_mock: MagicMock) -> list:
    """Devolve só os inserts que foram na tabela `tabelas_precos`."""
    return [c for c in inserir_mock.call_args_list if c.args[0] == "tabelas_precos"]


def _registros_documentos(inserir_mock: MagicMock) -> list:
    return [c for c in inserir_mock.call_args_list if c.args[0] == "documentos"]


def _mock_db(monkeypatch, upload_ok: bool = True):
    """Instala mocks pros helpers de db + gemini/mercado_api. Devolve os mocks
    pra teste inspecionar. `upload_ok=False` faz o Storage falhar (RuntimeError)."""
    inserir = MagicMock(side_effect=lambda tabela, dados: {"id": f"{tabela}-1", **dados})
    upload = MagicMock() if upload_ok else MagicMock(side_effect=RuntimeError("s3 down"))
    remover = MagicMock()
    atualizar = MagicMock(return_value={"id": "emp-1"})

    monkeypatch.setattr("api.db.inserir", inserir)
    monkeypatch.setattr("api.db.upload_storage", upload)
    monkeypatch.setattr("api.db.remover_storage", remover)
    monkeypatch.setattr("api.db.atualizar", atualizar)

    # Gemini não é chamado pra CSV, mas o import lazy pode ler env — força mock
    def _extrair(_conteudo, _nome):
        return {"unidades": [], "promocoes": [], "padrao": ""}
    monkeypatch.setattr("api.gemini.extrair_tabela_precos", _extrair)

    return {"inserir": inserir, "upload": upload, "remover": remover}


def test_tabelas_precos_arquiva_csv_em_storage_e_registra_documento(cliente, monkeypatch):
    """CSV com 2 linhas: cria tabelas_precos + upload + entry em documentos."""
    mocks = _mock_db(monkeypatch)
    csv = b"unidade,area_m2,valor\n101,50,500000\n102,60,600000\n"

    resposta = cliente.post(
        "/empreendimentos/emp-1/tabelas-precos",
        headers=auth_headers(cliente),
        files={"arquivo": ("total-abr26.csv", csv, "text/csv")},
        data={"versao": "Abr/26"},
    )
    assert resposta.status_code == 200, resposta.text

    # tabelas_precos com as unidades normalizadas
    tp = _registros_tabelas_precos(mocks["inserir"])
    assert len(tp) == 1
    dados_tp = tp[0].args[1]
    assert dados_tp["empreendimento_id"] == "emp-1"
    assert dados_tp["versao"] == "Abr/26"
    assert len(dados_tp["unidades"]) == 2

    # Storage foi chamado com nome original + content-type
    mocks["upload"].assert_called_once()
    caminho, conteudo, mime = mocks["upload"].call_args.args
    assert caminho.startswith("emp-1/")
    assert caminho.endswith("-total-abr26.csv")
    assert conteudo == csv
    assert mime == "text/csv"

    # Entry em documentos com tipo específico
    docs = _registros_documentos(mocks["inserir"])
    assert len(docs) == 1
    dados_doc = docs[0].args[1]
    assert dados_doc["empreendimento_id"] == "emp-1"
    assert dados_doc["nome"] == "total-abr26.csv"
    assert dados_doc["tipo"] == "tabela_precos"
    assert dados_doc["storage_path"] == caminho


def test_tabelas_precos_sem_arquivo_nao_toca_storage(cliente, monkeypatch):
    """Chamada só com metadata (versao/data) não deve subir nada."""
    mocks = _mock_db(monkeypatch)

    resposta = cliente.post(
        "/empreendimentos/emp-1/tabelas-precos",
        headers=auth_headers(cliente),
        data={"versao": "Mai/26"},
    )
    assert resposta.status_code == 200
    mocks["upload"].assert_not_called()
    assert _registros_documentos(mocks["inserir"]) == []


def test_tabelas_precos_falha_no_storage_nao_derruba_a_tabela(cliente, monkeypatch):
    """Storage indisponível não bloqueia — a tabela_precos ainda entra no DB.
    Arquivamento é oportunista, não é uma dependência dura."""
    mocks = _mock_db(monkeypatch, upload_ok=False)
    csv = b"unidade,area_m2,valor\n101,50,500000\n"

    resposta = cliente.post(
        "/empreendimentos/emp-1/tabelas-precos",
        headers=auth_headers(cliente),
        files={"arquivo": ("tabela.csv", csv, "text/csv")},
    )
    # A resposta ainda é 200 — o insert em tabelas_precos aconteceu ANTES do upload
    assert resposta.status_code == 200
    assert len(_registros_tabelas_precos(mocks["inserir"])) == 1
    # Upload foi tentado
    mocks["upload"].assert_called_once()
    # Mas documentos NÃO entrou (rollback silencioso)
    assert _registros_documentos(mocks["inserir"]) == []
