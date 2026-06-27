# TabLM — CONTINUAR (handoff para nova janela do Claude)

> Cole/abra este arquivo numa nova janela do Claude Code. Tem TUDO para continuar
> a evolução do TabLM de onde paramos. **Sem segredos** (ficam só em `api/.env` e
> nos painéis de Render/Vercel; gitignored). Atualizado em 2026-06-26 (após PR #58).

## Resumo de 1 linha
TabLM (Ribeira Empreendimentos) está **migrado e no ar**: Next.js (frontend) +
FastAPI (backend), monorepo. Backend no **Render**, frontend no **Vercel**.
Foco do produto agora é **Benchmark Competitivo** (rota central).

## URLs
- **Frontend (prod):** https://ribeira-tabelas-tablm.vercel.app
- **Backend (prod):** https://tablm-api.onrender.com — `/health` ok com `gemini` e `supabase` ligados.
- **Streamlit original (mantido no ar):** https://ribeira-tabelas.streamlit.app
- **GitHub (público, sem segredos):** https://github.com/us7926-beep/ribeira_tabelas

## Ambiente
- **Pasta:** `E:\Claudinho\ribeira_tabelas` (Windows, shell **PowerShell**).
- **Python:** `C:\Users\AZUL\AppData\Local\Programs\Python\Python311\python.exe`
- **Node:** `C:\Program Files\nodejs` — prefixe o PATH e use `npm.cmd`/`npx.cmd`:
  `$env:PATH = "C:\Program Files\nodejs;$env:PATH"`
- Commits terminam com `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **MCPs conectados:** Supabase (`zejnnymfxrrrizwokudk`) e **Vercel** (team `tablm`, projeto `ribeira-tabelas`).
  Render não tem MCP — ações nele são pelo painel.

## Estrutura
```
src/        lógica Python pura/legada (Streamlit): mercado, dashboard, incc, detector, etc.
app.py      app Streamlit original (mantido no ar)
api/        BACKEND FastAPI — rodar da raiz: uvicorn api.main:app
  main.py        rotas REST (limite de upload 25MB; DELETE /incorporadoras com guarda anti-órfão)
  config.py      lê env (load_dotenv de api/.env)
  security.py    senha SHA-256 + JWT (PyJWT)
  db.py          Supabase (tabelas) + Storage (bucket documentos)
  gemini.py      analisar_flyer / extrair_ficha (google-genai)
  mercado_api.py vendas_api.py incc_api.py   (reusam src/ puro)
  .env           >>> SEGREDOS (gitignored): TABLM_USERS, JWT_SECRET, GEMINI_API_KEY,
                 SUPABASE_URL, SUPABASE_KEY (service_role sb_secret_), CORS_ORIGINS
  requirements.txt  .env.example  README.md
tablm-web/  FRONTEND Next.js 16 + React 19 + Tailwind v4 — npm.cmd run dev
  app/(auth)/login/, app/(dashboard)/{page, benchmark, flyers, incc, vendas,
    incorporadoras/[id], empreendimentos/[id]}
  app/api/*        route handlers (proxy multipart -> backend com JWT do cookie)
  components/
    ui/            átomos: Card, RoyalCard, PageHeader, Button, Tabs, KpiCard,
                   KpiDelta, Chip, Dropzone, HBar, DonutConic, EditableField
    benchmark/     BenchmarkApp + Recorte + AbaPanorama/HeadToHead/Swot/
                   Oportunidades/Movimentos/Base
    empreendimento/  EmpreendimentoDossie + AbaFichaTecnica/Tabela/
                     FluxoComercial/VendasMensais + Documentos
    layout/Sidebar.tsx (gradiente royal, 5 itens, rodapé com Leonardo + Sair)
    flyer/, incc/, vendas/
  lib/{api,auth,constants,benchmark,swot}, proxy.ts (Next 16, com tokenExpirado)
  .env.local       NEXT_PUBLIC_API_URL (gitignored)
  vercel.json      força framework: "nextjs" (sem ele, Vercel não monta o roteamento)
render.yaml        blueprint do Render (deploy backend)
docs/DEPLOY.md     guia de deploy (referência)
docs/CONTINUAR.md  ESTE arquivo
```

## O que está PRONTO (master atualizado, 13 PRs mergeados)
- **Backend (no Render):** `/auth/login` (JWT), `/me`, `/gemini/{analisar-flyer,ficha,buscar-empreendimento}`,
  hierarquia (`/incorporadoras` GET/POST/DELETE, `/empreendimentos` GET/POST/DELETE/`{id}/kpis`/`{id}/ficha`/`{id}/ficha-dossie`/`{id}/tabelas-precos`/`{id}/fluxo-comercial`/`{id}/vendas-mensais`),
  `/benchmark/eventos`, `/mercado/comparativo` (aceita PDF/imagem via Gemini),
  `/incc/{variacoes,reajustar}`, `/vendas/kpis`, documentos.
  `/health` mostra flags gemini/supabase. **Limite de 25 MB** nos uploads;
  DELETE de incorporadora bloqueia se houver empreendimentos vinculados.
- **Supabase:** tabelas `incorporadoras`, `empreendimentos` (com colunas KPI e ficha
  expandida — preco_m2_medio, vso, vgv_total, metragens, vagas_*, distancia_metro_km,
  tipo_uso, etc.), `documentos`, `eventos_promocionais`, **`tabelas_precos`**
  (versionada, JSONB de unidades+condições+promoções), **`vendas_mensais`**
  (UNIQUE empreendimento+mês para upsert). RLS LIGADO; backend usa service_role.
  Bucket **`documentos`** (privado), + `benchmark_fichas` (Streamlit legado, RLS off).
- **Frontend (no Vercel):** **Design refresh completo** alinhado ao handoff
  `design_handoff_tablm_redesign` — royal `#2347C5` + Hanken Grotesk + indicadores
  verde/vermelho/âmbar.
  - Tokens em `@theme` do `globals.css`; átomos UI reutilizáveis em `components/ui/`
    (Card, RoyalCard, PageHeader, Button, Tabs, KpiCard, KpiDelta, Chip, Dropzone,
    HBar, DonutConic, **EditableField** click-to-edit com badge "via IA").
  - **Benchmark Competitivo** (rota central `/benchmark`) com barra de **Recorte**
    (Território/Padrão/Concorrente) persistido na URL e 6 sub-abas:
    Panorama (scatter + ranking de ameaça), Head-to-head, SWOT viva (`lib/swot.ts`),
    Oportunidades (heatmap com células GAP), Movimentos (timeline), Base (upload
    PDF/CSV/XLS com **IA detectando promoções** + botão "Vincular ao empreendimento").
  - **Dossiê do empreendimento** (`/empreendimentos/[id]`) com **5 abas**:
    - **Ficha Técnica**: 4 seções editáveis (Identificação/Produto/Estrutura/Datas);
      botões **"📄 Subir book/memorial"** (IA lê PDF e popula campos + arquiva como
      `book_empreendimento`) e **"🔎 Buscar online"** (Gemini + Google Search grounding
      com fallback); cada campo populado pela IA fica com Chip "via IA" antes do
      Salvar (N).
    - **Tabela de Preços** (versionada): histórico de versões (chips), modal de
      nova versão com Dropzone (PDF/imagem/CSV/XLS via Gemini), grid read-only de
      unidades, condições comerciais estruturadas, promoções detectadas.
    - **Fluxo Comercial**: tabela comparativa por tipo de pagamento + cards de
      delta (KpiDelta verde/vermelho).
    - **Histórico de Vendas**: 4 KPIs (Total/Média/Melhor/VGV), HBar por mês,
      form upsert (mês YYYY-MM, unidades_vendidas, vgv_mes opcional).
    - **Documentos**: tipos = flyer, memorial, tabela, tabela_precos, planta,
      **book_empreendimento**, book_concorrente, material_interno, ri_documento, outro.
  - `/mercado` e `/benchmark/eventos` viraram **redirects** para `/benchmark?aba=…`.
  - Sidebar gradiente royal com 5 itens (Benchmark / Vendas / Análise por IA /
    Carteira / INCC), rodapé com Leonardo + relógio ao vivo + Sair.
  - Login split 46/54 (painel gradiente + 3 mini-stats + form refinado).
  - Análise de Flyer **sem o robô**, com dropzone elegante e modal de confirmação;
    se a IA detecta uma incorporadora ainda não cadastrada, a opção "+ Cadastrar nova
    incorporadora…" já vem **pré-selecionada** com o nome detectado.
- **Hardening** herdado e portado: `AbortSignal.timeout(25s)` em todos os fetches
  (60s no upload de book/ficha-dossie),
  `tokenExpirado()` no `proxy.ts` (redireciona pra /login se JWT expirou).
- **88 testes pytest + typecheck OK.**

## Rodar local (2 terminais, AMBOS abertos ao mesmo tempo)
- **Terminal 1 — backend (raiz):**
  `& "C:\Users\AZUL\AppData\Local\Programs\Python\Python311\python.exe" -m uvicorn api.main:app --reload --port 8000`
- **Terminal 2 — frontend (`tablm-web`, janela NOVA):** `npm.cmd run dev` → http://localhost:3000
- Login: **leonardo** + senha (mesma do Streamlit). Backend lê `api/.env` sozinho.
- ⚠️ NÃO clique dentro dos terminais — o modo "Selecionar" (QuickEdit) congela o processo; **Esc** destrava.

## Deploy
- **Automático:** todo push em `master` re-deploya backend (Render) **e** frontend (Vercel).
- **MCP do Vercel** (já conectado) faz o monitoramento — ferramentas úteis:
  `list_deployments`, `get_deployment`, `get_deployment_build_logs`, `get_runtime_logs`,
  `get_runtime_errors`, `web_fetch_vercel_url` (passa pelo Vercel Auth).
- **Vercel Authentication ainda está LIGADO** (Deployment Protection). Hoje só o dono
  consegue acessar logado no Vercel. Para abrir a outros usuários:
  **Settings → Deployment Protection → Vercel Authentication → Disabled → Save**.
- **CORS:** o frontend chama o backend só server-side (Server Components + route handlers),
  então `CORS_ORIGINS=http://localhost:3000` no Render não bloqueia o app em produção.
  Por correção, mude no Render para `https://ribeira-tabelas-tablm.vercel.app`.

## O que entrou após PR #19 (58 PRs no total)
- **PR #20** — docs: handoff atualizado.
- **PR #21** — **Busca na Carteira** (search em `/incorporadoras` e detalhe).
- **PR #22** — **Diff por unidade** entre versões na Aba Tabela (Adicionadas /
  Alteradas / Removidas + tabela detalhada com Antes/Depois/Δ).
- **PR #23** — **Fluxo Comercial com distribuição real** por modalidade. Nova
  tabela `vendas_por_modalidade` (UNIQUE 3-col, índice, RLS). Helper
  `_montar_comparativo_fluxo` ganhou caminho "real" + retorna `fonte` e
  `total_vendas`. 3 endpoints novos sob `/empreendimentos/{id}/vendas-mensais/`:
  GET/POST `/distribuicao` + GET `/modalidades-sugeridas`. AbaVendasMensais
  ganha card "Distribuição por modalidade" (select de mês, tabela editável,
  validação inline). AbaFluxoComercial mostra chip **Real**/**Estimado**.
- **PR #24** — **Promoções ativas** no dashboard (eventos com `data_fim`
  futuro, badge de urgência verde/âmbar/vermelho, ordenadas por proximidade
  do término). Backend ganha query `?ativos=true` em `/benchmark/eventos`.
- **PR #25** — **Exportar PDF** do dossiê do empreendimento (e do Benchmark)
  via `window.print()`. CSS `@media print` em `globals.css` esconde sidebar/
  botões e força fundo branco. Reusa botão `BotaoExportarPdf` nas duas rotas.
- **PR #26** — chore: handoff (PRs #20-#25) + atalho de PDF no Benchmark.
- **PR #27** — Cleanup do legado `/gemini/ficha` + atalho PDF em mais rotas
  (INCC, Vendas, /incorporadoras/[id]) + **detectar coluna de modalidade** na
  planilha de vendas (backend devolve `colunas.modalidade` + `distribuicao`;
  frontend mostra card "Distribuição detectada"). `BotaoExportarPdf` movido
  para `components/ui/`.
- **PR #28** — **Auto-popular distribuição** ao vincular planilha de vendas
  a um empreendimento. Em 1 clique faz upsert do mês (`/vendas-mensais`) +
  salva a distribuição por modalidade (`/vendas-mensais/distribuicao`). O
  Fluxo Comercial troca pra **Real** automaticamente. Página `/vendas`
  passou a server component, carrega empreendimentos.
- **PR #29** — Nova rota **`/promocoes`** com 4 filtros (Ativas / Vencendo 7d
  / Todas / Expiradas), busca, 4 KPIs (Ativas / Vencendo / Expiradas / Total)
  e lista de cards ordenada por proximidade do término. Sidebar passa a ter
  6 itens com **"Promoções"** entre Análise por IA e Carteira.
- **PR #30** — Chip 🔥 "promoção" no card do empreendimento em
  `/incorporadoras/[id]` (alimentado por `/benchmark/eventos?ativos=true`) +
  handoff atualizado.
- **PR #31** — Lote `Promoções: badge na sidebar + filtros/timeline em
  /promocoes + inferência de modalidade` (4 commits temáticos):
  - **Sidebar badge** — `app/(dashboard)/layout.tsx` virou async, busca
    `/benchmark/eventos?ativos=true` server-side e passa `vencendo7d`/
    `vencendo3d` para o `<Sidebar />`. Badge âmbar (≤7d) ou vermelho (≤3d)
    no item Promoções. Helper `diasAteVencer` foi extraído para
    `tablm-web/lib/promocoes.ts` e reusado pelo `ListaPromocoes`.
  - **Filtros + URL em `/promocoes`** — dois selects ("Todas incorporadoras",
    "Todos padrões") ao lado da busca. Estado persistido em
    `?status&inc&padrao&q` copiando o padrão `useSearchParams +
    router.replace` do `BenchmarkApp.tsx`. Botão "Limpar filtros" quando há
    filtro não-default.
  - **Timeline horizontal** — novo `TimelineCronograma.tsx` (SVG sem lib,
    seguindo o sparkline de `AbaTabela`). Janela `[hoje-30d, hoje+90d]`,
    linha pontilhada royal marcando "hoje", barras coloridas por urgência
    (verde/âmbar/vermelho/cinza), tooltip por barra. Limita a 30 linhas com
    contador para o resto.
  - **Inferência de modalidade no `vendas_api`** — quando a planilha não
    tem coluna de modalidade, o backend classifica linha por linha via (a)
    regex no nome da unidade (FGTS/MCMV/SBPE/SFH/À vista/Financiamento) e
    (b) composição do pagamento (`subsidio > 0` → MCMV; `financ > 0` e
    `entrada < 25%` → Financiamento; só entrada → À vista). Response ganha
    `colunas.modalidade_origem = "explicita" | "inferida" | None`; frontend
    mostra Chip warn "inferida automaticamente" no card de distribuição.
- **PR #33** — Lote `Timeline drill-down + testes pytest da inferência` (2
  commits):
  - **Drill-down na timeline** — cada barra do `TimelineCronograma` agora
    navega para `/empreendimentos/[id]` ao clicar. Hover/foco com
    `opacity-75`, `role="button"`, `tabIndex`, Enter/Space, `aria-label`.
    Tooltip ganha "clique para abrir o dossiê". Barras órfãs (sem
    empreendimento no map) ficam inertes.
  - **Testes pytest da inferência** — 3 fixtures novas em
    `tests/test_api.py` cobrindo coluna explícita (`modalidade_origem =
    "explicita"`), inferência por nome (FGTS/MCMV) e inferência por
    composição (entrada/financ/subsídio). `test_vendas_kpis_via_csv` antigo
    foi estendido para confirmar que sem sinal a `distribuicao` segue
    ausente. Suite passou de 88 para **91 passed**.
- **PR #35** — Notificações por email diário (Resend + Vercel Cron 9h BRT).
  - **Migration nova**: `notificacoes_enviadas` (UNIQUE `evento_id,
    data_envio`, FK pra `eventos_promocionais` com ON DELETE CASCADE,
    RLS LIGADO). Dedup automático: mesma promoção não entra em emails
    consecutivos.
  - **Backend**: novo `api/notificacoes.py` (pipeline busca →
    dedup → monta HTML inline → envia → registra) + endpoint
    `POST /notificacoes/disparar-promocoes-vencendo` autenticado por
    `Authorization: Bearer ${CRON_SECRET}`. `resend==2.7.0` no
    `requirements.txt`. 4 envs novas no `config.py` e `.env.example`:
    `RESEND_API_KEY`, `CRON_SECRET`, `NOTIFICACOES_EMAIL_DESTINO`,
    `NOTIFICACOES_EMAIL_REMETENTE`.
  - **Frontend**: `vercel.json` ganha `crons[0]` com schedule
    `0 12 * * *` (12h UTC = 9h BRT). Novo route handler
    `tablm-web/app/api/cron/promocoes-vencendo/route.ts` valida
    `CRON_SECRET` e repassa pro backend.
  - **Doc**: `docs/DEPLOY.md` ganha seção 4 com setup completo
    (criar conta Resend, envs no Render + Vercel, como rodar
    manualmente, estados retornados).
  - **Setup pendente (você no painel):** Resend → API key, depois
    adicionar `RESEND_API_KEY`/`CRON_SECRET`/
    `NOTIFICACOES_EMAIL_DESTINO` no Render e `CRON_SECRET` no Vercel.
- **PR #37** — CI ganha job `frontend` paralelo ao `test` (que roda
  pytest): setup Node 22, `npm ci` em `tablm-web`, `tsc --noEmit` e
  `next build`. Cache de `node_modules` por `package-lock.json`. A
  partir daí, PR que quebrar tipo/build do Next não consegue ser
  mergeada — antes, falhas de SSR ou `params`/`searchParams` Promise
  só apareciam local ou no preview do Vercel.
- **PR #39** — `TimelineCronograma` ganha prop opcional
  `onFiltrarIncorporadora`. `ListaPromocoes` passa o
  `trocarIncorporadora` — assim **shift+click** numa barra atualiza
  o select de Incorporadora e o `?inc=` na URL sem sair da página.
  Clique sem shift mantém o drill-down (abrir dossiê). Tooltip e
  `aria-label` refletem a ação dupla; Enter/Space também respeitam
  o estado da shift.
- **PR #41** — Aba **Histórico de Vendas** ganha Card "VSO acumulado"
  com gráfico de área SVG (sem lib, mesmo padrão do sparkline da
  AbaTabela). Calcula `sum(vendidas até o mês) / total_unidades_calc`
  por mês ordenado; eixo Y 0-100% com linhas de referência em
  25/50/75/100; eixo X em MM/AA. Chip royal mostra VSO atual. Esconde
  silenciosamente quando o empreendimento não tem `total_unidades`
  cadastrado.
- **PR #42** — Admin de promoções dentro de `/promocoes` (antes
  promoção só nascia via flyer e ficava imutável). Backend ganha
  `EventoPatch` + `PATCH /benchmark/eventos/{id}` (404/400) e
  `DELETE /benchmark/eventos/{id}`. Frontend ganha
  `ModalEvento.tsx` (overlay com form completo, fecha por Escape ou
  clique fora, `role="dialog"`, Excluir no rodapé em modo edição com
  confirm) + route handler proxy
  `app/api/benchmark/eventos/[id]/route.ts`. ListaPromocoes ganha
  botão **"+ Nova promoção"** no header e **Editar** em cada card;
  `router.refresh()` após salvar/excluir. Quando o filtro de
  incorporadora está aplicado, o modal abre com um empreendimento
  daquela incorporadora pré-selecionado.
- **PR #44** — Lote `testes pytest + sparkline trio` (2 commits):
  - **Testes pytest do admin de promoções** (`tests/test_api.py`):
    8 fixtures novas cobrindo `PATCH/DELETE /benchmark/eventos/{id}`
    da #42 (body vazio → 400; sem Supabase → 503; id inexistente →
    404; fluxo feliz; `exclude_none` descarta campos omitidos
    protegendo contra wipe acidental). Suite 91 → 99.
  - **Sparkline trio** na AbaTabela: Card "Evolução entre versões"
    com 3 mini-sparklines (preço/m² royal, ticket verde, VGV âmbar)
    em pequenos múltiplos. Cada um auto-normaliza no próprio range
    + chip de delta % vs versão inicial + valor atual em destaque.
    Empty state inline quando preço/m² ou ticket não tem ≥2 pontos
    válidos.
- **PR #45** — **Vitest no frontend** (16 testes em 3 arquivos):
  - Setup `vitest.config.ts` (jsdom, alias `@`, glob
    `{lib,components}/**/*.{test,spec}.{ts,tsx}`) +
    `vitest.setup.ts` (jest-dom matchers).
  - `lib/promocoes.test.ts` (8): `diasAteVencer` em casos
    null/inválido/hoje/futuro/passado/ISO-com-hora; `contarVencendo`
    em listas vazias, expiradas ignoradas, faixas `<=3` e `<=7`.
    `vi.useFakeTimers` trava o relógio em 2026-06-20 UTC.
  - `components/ui/Chip.test.tsx` (5): render + classes por tom +
    `className` extra preservando tom.
  - `components/ui/KpiDelta.test.tsx` (3): seta + cor por direção.
  - CI: job `frontend` ganha step **Vitest** entre tsc e next build
    — falha de teste bloqueia merge.
- **PR #47** — Botão de **excluir empreendimento** no card da
  Carteira. Antes era impossível remover via UI — só via Supabase
  direto. Server action `excluirEmpreendimento(id, incorporadoraId)`
  devolve `{ok, erro?}` (padrão Next 16). Card vira `opacity-50 +
  pointer-events-none` durante a action; erro vira banner vermelho.
  Confirm nativo descreve o estrago (documentos/tabelas/vendas
  vinculados também somem). `preventDefault + stopPropagation` no
  clique para não disparar o `<Link>` que envolve o card.
- **PR #48** — Helper **`lib/csv`** reusável (escaparCelula,
  montarCsv, baixarCsv, exportarTabelaCsv) + export plugado em duas
  telas:
  - `/promocoes` — botão "Baixar CSV" ao lado de "+ Nova promoção"
    exporta os eventos **filtrados** (empreendimento, incorporadora,
    descrição, condições, datas, dias até vencer).
  - `/incorporadoras/[id]` — link "Baixar CSV" ao lado da busca
    exporta os empreendimentos **filtrados** com KPIs (preço/m²,
    ticket, VGV, VSO, unidades).
  - Refatora `AbaTabela.baixarCsvUnidades` para usar o helper (~25
    linhas a menos de código duplicado).
  - 8 testes Vitest novos em `lib/csv.test.ts` cobrindo escapamento
    RFC4180.
- **PR #50** — Export CSV na **AbaVendasMensais**: dois botões
  "Baixar CSV" novos no dossiê (Card "Vendas por mês" exporta a
  série ordenada; Card "Distribuição por modalidade" exporta as
  linhas > 0 do mês selecionado). Tudo client-side sobre o estado
  já carregado.
- **PR #51** — **25 testes Vitest** novos cobrindo
  `lib/benchmark` (18) e `lib/swot` (7). Cobre toda a API pública
  de helpers do Benchmark Competitivo: KPIs (real vs fallback
  determinístico), score/corAmeaca, ranking de ameaça, scatter,
  movimentos classificados, heatmap excluindo Ribeira. Para SWOT:
  estrutura sempre presente, max 3 bullets, conteúdo concreto
  quando há dados.
- **PR #53** — **15 testes Vitest** novos cobrindo `KpiCard` (5),
  `Tabs` (4) e `Button` (6). Renders, variantes/tons, `onClick` com
  `fireEvent`, `disabled` bloqueando, `className` extra preservando
  classes da variante.
- **PR #54** — Quinta tela com **export CSV**: AbaFluxoComercial
  ganha link "Baixar CSV" no header do Card principal exportando a
  tabela comparativa (condicao, ticket_medio, pct_total,
  valor_medio_parcela, n_parcelas, unidades). Nome inclui versão da
  tabela + mês usado em modo Real. **Totais agora**: pytest 99 +
  vitest 64 = **163 testes**.
- **PR #56** — Botão **excluir incorporadora** no card da Carteira
  fecha o último gap de admin. Server action `excluirIncorporadora`
  detecta o 409 do backend (DELETE bloqueia quando há
  empreendimentos vinculados) e mostra mensagem amigável no banner
  vermelho em vez do "Erro 409" cru. Mesma UX do excluir
  empreendimento (#47): × no canto, confirm, opacity-50 durante a
  ação, `preventDefault + stopPropagation` no clique para não disparar
  o Link.
- **PR #58** — Nova rota **`/empreendimentos`**: visão global
  cross-incorporadora que faltava na Carteira. Server component
  carrega todos empreendimentos + incorporadoras; client
  `ListaGlobalEmpreendimentos` tem busca + 4 selects (Incorporadora,
  Padrão, Cidade, Bairro com cascata pela cidade), URL sync,
  "Limpar filtros", 3 KPIs do subset, cards-link pro dossiê com
  chips/KPIs em destaque e Baixar CSV (sexta tela). Atalho discreto
  "Ver todos os empreendimentos →" no PageHeader de
  `/incorporadoras` leva pra rota nova. Coexiste sem conflito com
  `/empreendimentos/[id]`.

## Smoke test manual

Roteiro completo das 17 features novas em [docs/SMOKE_TEST.md](SMOKE_TEST.md)
— 6 seções com critérios de aceite e prompt pronto pra usar com Claude in
Chrome ou Cowork. Use antes de qualquer nova rodada de feature.

## Próximos passos sugeridos

Lista de **código pendente** está vazia. O que sobra é setup
operacional seu nos painéis:

1. **Configurar Resend + envs (você)** — sem isso a PR #35 fica inerte.
   Passo a passo em [docs/DEPLOY.md secao 4](docs/DEPLOY.md).
2. **Desligar Vercel Authentication** (ação no painel, Settings → Deployment
   Protection).
3. **Domínio próprio** (ex.: `tablm.ribeira.com.br`) — Vercel + Render aceitam
   custom.
4. **Trocar senha do leonardo** (apareceu no chat em sessão antiga). Gerar hash:
   `python -c "import hashlib;print(hashlib.sha256('SENHA'.encode()).hexdigest())"`
   → atualizar `TABLM_USERS` no `api/.env` local **e** no painel do Render.

Ideias maiores que ainda não viraram pedido — listadas só para futura
sessão decidir: notificação por **push** (web push opt-in), tabela
real de `usuarios` com email (hoje `TABLM_USERS` é env), painel de
admin global de empreendimentos (criar/editar fora do dossiê de uma
incorporadora), mais cobertura Vitest (átomos restantes:
Dropzone/HBar/DonutConic/Card/PageHeader; componentes maiores como
ListaPromocoes/TimelineCronograma com testes de interação; testes
para os route handlers).

## Segurança (MANTER)
- Repo público → nenhum segredo no código. `api/.env` e `tablm-web/.env.local` são gitignored.
  Sempre `git grep`/checar antes de commitar.
- Backend usa a chave **service_role** (`sb_secret_`) — server-side, ignora RLS com segurança.
- **Não digitar senhas em campos de login** (quem loga é o usuário).

## Gotchas (importantes)
- **Next 16 quer `proxy.ts`, não `middleware.ts`** — o `middleware.ts` legado roda em Edge
  e falha o deploy do Vercel ("unsupported modules"). Se aparecer um `middleware.ts` de novo,
  porte a lógica pro `proxy.ts` e remova.
- **`vercel.json` com `"framework": "nextjs"` é obrigatório** — sem ele, o Vercel não monta
  o roteamento do Next e todas as rotas dão 404 NOT_FOUND (mesmo com build verde).
- **`searchParams` e `params` agora são Promises no Next 16** — use `const { ... } = await searchParams;`.
- `streamlit==1.58.0` pinado (extra-streamlit-components exige >=1.40.1) — não desalinhar.
- PowerShell: here-string com aspas/`<>` quebra → usar `git commit -F arquivo.txt`.
- `npm` bloqueado por ExecutionPolicy → usar `npm.cmd` (ou `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`).
- INCC oficial = **BCB SGS série 192** (NÃO 7456 = INCC-M).
- Validar antes de commitar: raiz `python -m pytest -q`; `tablm-web` `npx.cmd tsc --noEmit` (com PATH do Node).

## Material de design (não versionado)
`E:\Claudinho\ribeira_tabelas\App moderno azul royalv2\design_handoff_tablm_redesign\`
contém `README.md`, `REFINAR_UI.md` (Seção 3b = Benchmark) e `screens/`. Está no
`.gitignore`. É a referência visual fonte de verdade — abra `TabLM.dc.html` no navegador
quando precisar comparar pixel.
