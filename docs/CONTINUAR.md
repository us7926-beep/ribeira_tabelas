# TabLM — CONTINUAR (handoff para nova janela do Claude)

> Cole/abra este arquivo numa nova janela do Claude Code. Tem TUDO para continuar
> a evolução do TabLM de onde paramos. **Sem segredos** (ficam só em `api/.env` e
> nos painéis de Render/Vercel; gitignored). Atualizado em 2026-06-26 (após PR #33).

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

## O que entrou após PR #19 (33 PRs no total)
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

## Próximos passos sugeridos
1. **Notificação por email/push** — badge in-app já está em produção (PR #31),
   mas o sinal proativo "fora do app" continua aberto. Requer: tabela
   `usuarios` (hoje `TABLM_USERS` é só env), integração Resend/Sendgrid e
   cron externo (Render free não tem worker).
2. **Filtro pré-aplicado de incorporadora ao clicar timeline** — alternativa
   ao drill-down atual: em vez de ir pro dossiê, pré-aplicar
   `?inc=<id>` em `/promocoes`. Útil para comparar promoções da mesma
   incorporadora sem sair da tela.
3. **CI: adicionar `tsc --noEmit` + `next build`** — hoje GitHub Actions
   roda só pytest. Falhas de tipo/SSR só pegamos local. Pode ser
   workflow novo ou step no existente.
4. **Desligar Vercel Authentication** (ação no painel, Settings → Deployment
   Protection).
5. **Domínio próprio** (ex.: `tablm.ribeira.com.br`) — Vercel + Render aceitam
   custom.
6. **Trocar senha do leonardo** (apareceu no chat em sessão antiga). Gerar hash:
   `python -c "import hashlib;print(hashlib.sha256('SENHA'.encode()).hexdigest())"`
   → atualizar `TABLM_USERS` no `api/.env` local **e** no painel do Render.

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
