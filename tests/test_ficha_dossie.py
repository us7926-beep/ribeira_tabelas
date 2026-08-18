"""gemini.extrair_ficha_dossie: retry seletivo + few-shot (PR #92)."""


from tests.conftest import cliente  # noqa: F401

# --------------------------------------------------------------------------- #
# extrair_ficha_dossie — retry seletivo + few-shot (PR feature/gemini-retry-fewshot)
# --------------------------------------------------------------------------- #
def test_ficha_dossie_sem_retry_quando_essenciais_preenchidos(monkeypatch):
    """Se veio >=3 dos 5 essenciais (nome/bairro/cidade/padrao/tipologias),
    NAO refaz — economiza chamada Gemini."""
    from api import gemini

    chamadas = []

    def fake_gerar(_c, _n, prompt):
        chamadas.append(prompt)
        return {
            "nome": "Alegria",
            "bairro": "Vila Mogilar",
            "cidade": "Mogi das Cruzes",
            "padrao": "Alto",
            "tipologias": "2 dorms",
        }

    monkeypatch.setattr(gemini, "_gerar", fake_gerar)
    ficha = gemini.extrair_ficha_dossie(b"pdf", "book.pdf")
    assert ficha["nome"] == "Alegria"
    assert len(chamadas) == 1  # sem retry


def test_ficha_dossie_faz_retry_quando_essenciais_faltam(monkeypatch):
    """Se veio <3 essenciais, refaz com prompt de reforco e mescla — o
    valor da 1a tentativa vence, o reforco so preenche vazios."""
    from api import gemini

    chamadas: list[str] = []

    def fake_gerar(_c, _n, prompt):
        chamadas.append(prompt)
        # 1a tentativa: veio so o nome (1 dos 5 essenciais).
        if len(chamadas) == 1:
            return {"nome": "Torres do Parque", "pavimentos": 10}
        # 2a (reforco): traz bairro, cidade e padrao adicionais.
        return {
            "nome": "OUTRO NOME (ignorado)",  # nao pode sobrescrever
            "bairro": "Centro",
            "cidade": "Mogi",
            "padrao": "Medio",
            "pavimentos": 99,  # tambem ignorado (ja tinha)
        }

    monkeypatch.setattr(gemini, "_gerar", fake_gerar)
    ficha = gemini.extrair_ficha_dossie(b"pdf", "book.pdf")

    assert len(chamadas) == 2, "esperado 1 chamada + 1 retry"
    assert "reforco" in chamadas[1].lower() or "reforc" in chamadas[1].lower() or "faltar" in chamadas[1].lower() or "vazios" in chamadas[1].lower() or "ja tent" in chamadas[1].lower()
    # 1a tentativa vence: nome + pavimentos
    assert ficha["nome"] == "Torres do Parque"
    assert ficha["pavimentos"] == 10
    # Reforco preenche vazios: bairro/cidade/padrao
    assert ficha["bairro"] == "Centro"
    assert ficha["cidade"] == "Mogi"
    assert ficha["padrao"] == "Medio"


def test_ficha_dossie_retry_desligado(monkeypatch):
    """Passar retry_vazios=False bloqueia a 2a chamada."""
    from api import gemini

    chamadas = []

    def fake_gerar(_c, _n, _prompt):
        chamadas.append(1)
        return {"nome": "So o nome"}

    monkeypatch.setattr(gemini, "_gerar", fake_gerar)
    ficha = gemini.extrair_ficha_dossie(b"pdf", "book.pdf", retry_vazios=False)
    assert len(chamadas) == 1
    assert ficha["nome"] == "So o nome"


def test_ficha_dossie_retry_tolera_falha(monkeypatch):
    """Se o retry der RuntimeError, mantem o que veio da 1a tentativa."""
    from api import gemini

    chamadas = []

    def fake_gerar(_c, _n, _prompt):
        chamadas.append(1)
        if len(chamadas) == 1:
            return {"nome": "X"}
        raise RuntimeError("Gemini indisponivel")

    monkeypatch.setattr(gemini, "_gerar", fake_gerar)
    ficha = gemini.extrair_ficha_dossie(b"pdf", "book.pdf")
    assert len(chamadas) == 2  # tentou retry
    assert ficha == {"nome": "X"}  # mas voltou com o parcial


def test_ficha_dossie_prompt_tem_exemplos_few_shot():
    """O prompt principal deve incluir 2 exemplos (few-shot) — book completo + book pobre."""
    from api import gemini

    prompt = gemini._PROMPT_FICHA_DOSSIE
    assert "EXEMPLOS" in prompt.upper() or "exemplo" in prompt.lower()
    assert "Alegria" in prompt  # exemplo 1 do book completo
    assert "Torres do Parque" in prompt  # exemplo 2 do book pobre
    # Deve mostrar o padrao de usar null em vez de inventar
    assert "null" in prompt
