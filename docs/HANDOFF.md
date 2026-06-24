# TabLM — Documento de Handoff (para continuar em outro chat Claude)

> Este arquivo resume **tudo** sobre o projeto e o estado atual, para que outra
> sessão do Claude continue o trabalho sem perda de contexto. **Não contém
> segredos** (chaves/senhas ficam só nos Secrets do Streamlit Cloud).
> Última atualização: 2026-06-24.

---

## 1. O que é o projeto

**TabLM** (originalmente "ribeira_tabelas") é um app **Streamlit** para a
**Ribeira Empreendimentos** (incorporadora/imobiliária brasileira). Reúne, com
login por senha:

- **Inteligência de Mercado** — compara preço/m² e preço total dos nossos
  produtos vs concorrentes, por dimensão (incorporadora, produto, cidade,
  bairro, padrão), com KPIs e insights.
- **Extração (IA)** — lê books/flyers/tabelas (PDF/imagem) e extrai a ficha
  técnica do empreendimento via **Google Gemini** (modo híbrido: a IA preenche,
  o usuário revisa antes de salvar). *(feature nova, foco desta sessão)*
- **Dashboards de Vendas** — KPIs de vendas (evolução de preços, unidades
  vendidas/disponíveis, donut por situação, histograma).
- **Detectar Padrão** — classifica o padrão de uma tabela.
- **Comparar Versões** — diff entre duas versões de tabela.
- **Reajustar por INCC** — aplica a variação mensal do INCC-DI a todas as
  unidades + acréscimo opcional (% ou R$), exporta Excel/PDF.

Design "azul royal" (#2347C5, fonte Hanken Grotesk) recriado de um handoff de
design, com sidebar retrátil e componentes HTML alimentados por dados reais.

---

## 2. Ambiente de trabalho

- **Pasta canônica (trabalhar aqui):** `E:\Claudinho\ribeira_tabelas` (HD E:).
  Backup antigo no SSD: `C:\Users\AZUL\Desktop\Claudinho\ribeira_tabelas`.
- **Python:** `C:\Users\AZUL\AppData\Local\Programs\Python\Python311\python.exe`
  (3.11; `python` no PATH só resolve em terminal novo). Shell: **PowerShell**.
- **GitHub:** https://github.com/us7926-beep/ribeira_tabelas (repositório
  **PÚBLICO** — nenhum segredo pode ser commitado).
- **Deploy:** https://ribeira-tabelas.streamlit.app (Streamlit Cloud, Python
  3.11, **auto-redeploy a cada push em `master`**).
- **Usuário/email:** us7926@gmail.com. Data corrente de referência: 2026-06-24.

---

## 3. Estrutura de arquivos

```
app.py                     # entrada; CSS royal, sidebar, dispatch das páginas
config.yaml                # config geral (limites de upload, etc.)
requirements.txt           # deps fixadas (ver §10 gotcha de versão)
runtime.txt / packages.txt # Python 3.11 / pacotes apt do Streamlit Cloud
.streamlit/
  config.toml              # tema
  secrets.toml.example     # modelo dos Secrets (o .toml real é gitignored)
scripts/gerar_hash_senha.py# gera hash SHA-256 de senha p/ o login
src/
  auth.py                  # login SHA-256 + cookie HMAC (não desloga no F5)
  extracao.py              # >>> Extração via Gemini (foco desta sessão)
  mercado.py               # núcleo de inteligência de mercado
  mercado_store.py         # persistência (Google Sheets) c/ fallback em sessão
  pdf_extract.py           # extrai tabelas de PDF (pdfplumber)
  incc.py                  # INCC-DI via API do BCB/SGS série 192
  dashboard.py             # KPIs de vendas
  detector.py              # detecta padrão
  comparador.py            # diff de versões
  ui.py                    # componentes HTML do design royal
  utils.py                 # ler planilha, gerar PDF executivo
tests/                     # pytest (75 testes passando)
docs/
  TREINAMENTO.md           # documentação de uso
  CONVERSA.md              # transcrição anterior
  HANDOFF.md               # << este arquivo
```

---

## 4. Estado atual (o que está PRONTO)

- App online, login funcionando (cookie persiste no F5).
- Inteligência de Mercado completa (upload, normalização BR de números, KPIs,
  comparação por dimensão, posicionamento por padrão, insights).
- Dashboards, Detectar Padrão, Comparar Versões, Reajuste por INCC.
- **Aba Extração (IA)** com Gemini — multi-upload + extração híbrida + revisão +
  base de benchmark em sessão (download CSV). **Validada em PDFs reais.**
- 75 testes pytest passando. CI no GitHub Actions.
- Último commit: `84e4664`.

---

## 5. Aba "Extração (IA)" — detalhes (`src/extracao.py`)

**Objetivo:** ler books/flyers/tabelas (PDF ou imagem, inclusive escaneados) e
extrair a ficha técnica do empreendimento em JSON, modo **híbrido** (a IA
preenche, o usuário revisa antes de salvar).

- **Provedor:** **Google Gemini** (free tier), SDK oficial **`google-genai`**.
  - `genai.Client(api_key=...)` → `client.models.generate_content(model=..., contents=[Part.from_bytes(...), instrucao], config=GenerateContentConfig(response_mime_type="application/json"))` → `response.text` (JSON).
  - Modelo padrão `gemini-2.5-flash` (override via `[gemini].model` nos Secrets,
    ex.: `gemini-flash-latest`).
  - **Retry** em `google.genai.errors.ServerError` (503 "high demand" do free
    tier acontece de vez em quando) — 3 tentativas com backoff.
  - Listas no JSON (ex.: `tipologias`) viram `"a; b; c"`.
  - `@st.cache_data` por conteúdo (não recobra a mesma extração).
- **Campos extraídos (`CAMPOS_FICHA`):** nome_empreendimento, incorporadora,
  cidade, bairro, padrao, tipologias, vagas_por_unidade, vagas_cobertura,
  vagas_extra_venda, vagas_visitante, distancia_estacao, data_lancamento,
  data_entrega, total_unidades, tipo_projeto, pavimentos, elevadores_por_torre,
  torres, cnpj_spe, ri.
- **Sem chave** → `ia_configurada()` False → app cai no preenchimento manual.
- **App (`render_extracao` em app.py):** multi-upload, botão "🤖 Extrair com
  IA", formulário editável de revisão (3 colunas), cálculo de "entrega + 180
  dias", base de benchmark em `st.session_state["fichas_benchmark"]`, download
  CSV.

**Teste real feito nesta sessão** (PDFs do concorrente "Urban"):
- *Tabela* → Empreendimento URBAN, Incorporadora HABRAS, Padrão Médio-Alto,
  1 vaga, Residencial, 22 pavimentos.
- *Book (130 pág / 13 MB)* → Urban Residencial, Habras, Mogi das Cruzes, 2 dorm
  49–71 m², entrega 31/12/2025, 230 unidades, 23 pavimentos, 4 elevadores,
  1 torre. **Funcionou inline mesmo com 13 MB.**

**Decisão sobre provedor:** começou com Claude (Anthropic), virou agnóstico
(Gemini grátis + Claude pago), e a pedido do usuário **ficou só Gemini +
manual** (Claude removido do código e do requirements).

---

## 6. Secrets necessários (valores SÓ no Streamlit Cloud, nunca no git)

`.streamlit/secrets.toml` (gitignored). Modelo em `secrets.toml.example`:

```toml
[auth]
[auth.usuarios]
leonardo = "HASH_SHA256_DA_SENHA"   # gerar com scripts/gerar_hash_senha.py

[empresa]
nome = "Ribeira Empreendimentos"
ambiente = "producao"

[gemini]
api_key = "..."          # chave do Google AI Studio (aistudio.google.com)
# model = "gemini-2.5-flash"   # opcional

# (opcional) persistência atual de mercado via Google Sheets:
# [gsheets] / [gsheets.service_account] ...
```

O usuário já colou a chave do Gemini nos Secrets do Streamlit Cloud.

---

## 7. Restrições de segurança (IMPORTANTE — manter)

- **Repo é público** → nenhuma chave/senha/segredo pode ir pro código. Sempre
  rodar `git grep` antes de commitar pra garantir que não vazou.
- Segredos (hash de login, chave Gemini, service-account) ficam **só** nos
  Secrets do Streamlit Cloud / `secrets.toml` local (gitignored).
- O cookie de login usa HMAC com chave derivada dos hashes dos secrets
  (ausente no código público).
- Deploy **só** via push em `master`. Mensagens de commit terminam com
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **O assistente não digita senhas/credenciais em campos de login** (regra de
  segurança) — quem loga é o usuário.
- Nesta sessão o usuário colou no chat a senha de login e a chave do Gemini:
  **recomendado trocar a senha** (parecia pessoal) e, se quiser, regenerar a
  chave do Gemini.

---

## 8. ROADMAP pendente — "Arte da Guerra" (o grande pedido)

Pedido original do usuário (transformar o app numa plataforma de inteligência
competitiva). Dividido em módulos; **A e B prontos**, faltam **C e D** (+ banco):

- **A. Multi-upload** — vários arquivos de uma vez. ✅ (na aba Extração)
- **B. Extração de documentos** (books/flyers/tabelas) → dados replicáveis pros
  outros módulos; identifica ficha técnica + incorporadora/construtora. ✅
- **C. Benchmark "Arte da Guerra"** (PENDENTE) — ficha estruturada completa dos
  empreendimentos com TODOS os campos pedidos:
  - nome, incorporadora, bairro, tipologias/metragens
  - vagas de garagem por unidade + coberto/descoberto + vagas venda adicional +
    visitantes
  - distância de estação de trem (metros se < 1 km; km com 1 casa decimal)
  - data de lançamento, data de entrega prevista, **data + 180 dias** (praxe)
  - total de unidades; comercial/residencial/misto; qtd pavimentos; qtd
    elevadores por torre; qtd torres
  - **vendas dos últimos meses com filtro de data**: mês a mês / bimestre /
    trimestre / últimos 6 meses / YTD / últimos 12 meses / personalizável
  - **CNPJ da SPE** e **R.I do projeto**
- **D. Fluxo comercial** (PENDENTE) — tabela comparativa de fluxo: % de ato /
  mensais / 30 / 60 / 90 dias / anuais / financiamento ou saldo a quitar; %
  fluxo obra vs pós-obra; quantas mensais; e **diferença em R$ por linha com
  cores** (verde se positivo, vermelho se negativo).
- **Persistência (banco):** decidir entre Google Sheets (atual, parcial) e
  **Supabase (Postgres)**. **Recomendação: Supabase** — melhor para os dados
  estruturados e os filtros por período do módulo C. Precisa: projeto grátis no
  supabase.com, `[supabase] url`/`key` nos Secrets, dep `supabase`, módulo
  `src/supabase_store.py` + tabelas. *(usuário sinalizou preferência por
  Supabase; aguardando confirmação para implementar)*

**Próximo passo sugerido:** confirmar Supabase, então implementar Módulo C
(Arte da Guerra) consumindo o banco, depois Módulo D (fluxo comercial).

---

## 9. Decisões tomadas e porquês

- **INCC-DI = série 192** do BCB/SGS (NÃO 7456, que é INCC-M de Mercado).
  Confere com a SindusCon/FGV. Reajuste usa a **variação mensal** do índice.
- **Extração por IA é necessária** para books/flyers (texto visual livre); só
  pdfplumber não estrutura os ~25 campos. pdfplumber dá texto cru de graça, mas
  flyer escaneado precisa de visão (IA).
- **Gemini escolhido** pelo free tier (lê PDF/imagem nativamente + JSON). Ponto
  de atenção: no free tier o Google pode usar o conteúdo para treinar — ok para
  material de marketing público; sensível, avaliar.
- **Claude removido** a pedido do usuário (manter só Gemini + manual).
- **Design:** HTML para saídas (componentes em `ui.py` com dados reais), widgets
  Streamlit para entradas (Streamlit não dá pra ficar 100% pixel-perfect em
  inputs interativos).

---

## 10. Gotchas / lições aprendidas

- **Pin de versão:** `extra-streamlit-components` exige `streamlit>=1.40.1`. O
  projeto roda `streamlit==1.58.0`. Conferir o requirements antes de pushar — um
  pin desalinhado derruba o deploy com "Error installing requirements".
- `google-genai==2.10.0` e `anthropic` (já removido) instalam sem conflito com
  `protobuf 5.29.6` / `google-auth` / `gspread`.
- **Não usar `st.rerun()` após `cookies.set()/delete()`** (descarta a escrita do
  cookie; `st.stop()` faz o flush).
- **Ícones Material** quebram se `[data-testid="stSidebar"] *{font-family:...}`;
  usar regra que preserva a fonte Material.
- **Números BR** no parser de mercado: '472.436' (milhar), '47,44' (decimal),
  remove espaços de ruído de PDF.
- **PowerShell:** caminhos com acento (ç/ã) corrompem ao virar argv do Python —
  achar via curinga (`Tabela Lan*amento*.pdf`) e copiar pra nome ASCII.
  Commit com mensagem multi-linha: usar `git commit -F arquivo` (here-string
  `@'...'@` com aspas internas quebra).
- **Boot local:** `Invoke-WebRequest localhost/healthz` pode dar falso-negativo
  por IPv6 (`::1`) enquanto o Uvicorn ouve IPv4 — usar `127.0.0.1` e olhar o
  STDOUT ("You can now view your Streamlit app").

---

## 11. Resumo desta conversa (cronológico)

1. Usuário pediu a grande expansão "Arte da Guerra" (multi-upload, extração de
   docs, benchmark completo, fluxo comercial, possível agente de IA).
2. Definido: extração **híbrida (IA + revisão)**; começar por **multi-upload +
   extração**.
3. **Fase 1** entregue: aba Extração com Claude (commit `61c05a0`).
4. Usuário perguntou sobre ler PDF **de graça** → explicado pdfplumber (grátis,
   texto) vs IA (estrutura os campos).
5. Usuário sugeriu **Gemini** (free tier) → extração virou **agnóstica de
   provedor** (Gemini grátis + Claude) (commit `546a20b`).
6. Usuário colou a chave do Gemini → **teste real** nos 2 PDFs do Urban:
   funcionou (tabela e book de 13 MB).
7. Usuário pediu **remover o Claude** → ficou **só Gemini + manual**, com retry
   503 e tipologias legíveis (commit `84e4664`, atual).
8. Usuário colou login e pediu teste no app → assistente **recusou digitar a
   senha** (segurança) e recomendou trocá-la; orientou o usuário a testar.
9. Usuário perguntou sobre **Supabase** → recomendado para o banco do benchmark.
10. Pedido este documento de handoff.

---

## 12. Como rodar e validar localmente

```powershell
$py = "C:\Users\AZUL\AppData\Local\Programs\Python\Python311\python.exe"
cd E:\Claudinho\ribeira_tabelas
& $py -m pytest -q                 # 75 testes
& $py -m py_compile app.py src\extracao.py
& $py -m streamlit run app.py --server.port 8501   # boot local
```

Workflow de deploy: validar (py_compile + pytest + boot) → limpar
`__pycache__` → `git grep` p/ garantir que não há segredo → `git add -A` →
`git commit -F msg.txt` (Co-Authored-By Claude Opus 4.8) → `git push origin
master` → acompanhar o redeploy na URL.

---

## 13. Mensagem para o próximo chat

> Continue o projeto **TabLM** em `E:\Claudinho\ribeira_tabelas` (Streamlit,
> Python 3.11, PowerShell). Leia este HANDOFF. O foco pendente é o **Módulo C
> (Benchmark "Arte da Guerra")** e o **Módulo D (Fluxo comercial)**, mais a
> **persistência em Supabase** (a confirmar). A extração por **Gemini** já está
> pronta e validada. Mantenha as regras de segurança (repo público, segredos só
> nos Secrets, não digitar senhas). Faça deploy só por push em `master` com
> `Co-Authored-By: Claude Opus 4.8`.
