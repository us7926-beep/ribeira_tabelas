# TabLM — CONTINUAR (handoff para nova janela do Claude)

> Cole/abra este arquivo numa nova janela do Claude Code. Tem TUDO para continuar
> a evolução do TabLM de onde paramos. **Sem segredos** (ficam só em `api/.env` e
> nos painéis de Render/Vercel; gitignored). Atualizado em 2026-06-25 (noite, após PR #13).

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

## Próximos passos sugeridos
1. **Unificar a leitura do book** entre as abas Ficha e Tabela de Preços. Hoje a
   Aba Ficha chama `/ficha-dossie` (campos da ficha) e a Aba Tabela chama
   `tabelas-precos` (unidades + condições + promoções). Quando o usuário sobe o
   mesmo book denso, faz sentido detectar e oferecer "extrair também ___".
2. **Botão "+ Criar empreendimento" na Aba Base do Benchmark.** Quando o usuário
   sobe uma planilha lá, hoje a IA detecta o nome/incorporadora mas é preciso
   ir até Carteira para criar manualmente. Idem ao fluxo do Flyer (PR #7).
3. **Persistir distribuição real entre tipos de pagamento** em `fluxo-comercial`.
   Hoje `_montar_comparativo_fluxo` usa distribuição uniforme — quando o backend
   souber contar por modalidade (a partir de tabelas reais), trocar.
4. **Desligar Vercel Authentication** (ação no painel, Settings → Deployment Protection).
5. **Domínio próprio** (ex.: `tablm.ribeira.com.br`) — Vercel + Render aceitam custom.
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
