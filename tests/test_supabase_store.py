"""Testes da persistência em Supabase (mock; valida o fallback em sessão)."""
from src import supabase_store as store


def test_deve_retornar_false_quando_sem_config(mocker):
    mocker.patch.object(store.st, "secrets", {})
    assert store.supabase_configurado() is False


def test_deve_retornar_true_quando_url_e_key(mocker):
    mocker.patch.object(store.st, "secrets", {"supabase": {"url": "u", "key": "k"}})
    assert store.supabase_configurado() is True


def test_deve_salvar_na_sessao_quando_sem_supabase(mocker):
    mocker.patch.object(store.st, "secrets", {})
    mocker.patch.object(store.st, "session_state", {})
    destino = store.salvar_ficha({"nome_empreendimento": "X"})
    assert destino == "sessao"
    assert store.st.session_state["fichas_benchmark"][0]["nome_empreendimento"] == "X"


def test_deve_inserir_no_supabase_sem_chaves_internas(mocker):
    store._cliente.clear()
    mocker.patch.object(store.st, "secrets", {"supabase": {"url": "u", "key": "k"}})
    cliente = mocker.MagicMock()
    mocker.patch("supabase.create_client", return_value=cliente)

    destino = store.salvar_ficha({"nome_empreendimento": "X", "_interno": "ignore"})

    assert destino == "supabase"
    cliente.table.assert_called_with(store.TABELA)
    enviado = cliente.table.return_value.insert.call_args.args[0]
    assert enviado == {"nome_empreendimento": "X"}  # "_interno" removido


def test_deve_listar_do_supabase_quando_configurado(mocker):
    store._cliente.clear()
    mocker.patch.object(store.st, "secrets", {"supabase": {"url": "u", "key": "k"}})
    cliente = mocker.MagicMock()
    resposta = mocker.MagicMock(data=[{"nome_empreendimento": "Y"}])
    cliente.table.return_value.select.return_value.order.return_value.execute.return_value = resposta
    mocker.patch("supabase.create_client", return_value=cliente)

    assert store.listar_fichas() == [{"nome_empreendimento": "Y"}]


def test_deve_cair_pra_sessao_quando_supabase_erra(mocker):
    store._cliente.clear()
    mocker.patch.object(store.st, "secrets", {"supabase": {"url": "u", "key": "k"}})
    mocker.patch.object(store.st, "session_state",
                        {"fichas_benchmark": [{"nome_empreendimento": "Z"}]})
    mocker.patch.object(store.st, "warning")
    cliente = mocker.MagicMock()
    cliente.table.side_effect = RuntimeError("boom")
    mocker.patch("supabase.create_client", return_value=cliente)

    assert store.listar_fichas() == [{"nome_empreendimento": "Z"}]
