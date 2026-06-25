# TabLM — CONTINUAR (handoff para nova janela do Claude)

> Cole/abra este arquivo numa nova janela do Claude Code. Tem TUDO para continuar
> a migração do TabLM de onde paramos. **Sem segredos** (ficam só em `api/.env`,
> gitignored). Atualizado em 2026-06-25.

## Resumo de 1 linha
TabLM (Ribeira Empreendimentos) foi migrado de **Streamlit** para **Next.js (frontend) +
FastAPI (backend)**, monorepo. A migração está **feature-completa**; falta só o **deploy**.

## Ambiente
- **Pasta:** `E:\Claudinho\ribeira_tabelas` (Windows, shell **PowerShell**).
- **Python:** `C:\Users\AZUL\AppData\Local\Programs\Python\Python311\python.exe`
- **Node:** `C:\Program Files\nodejs` — prefixe o PATH e use `npm.cmd`/`npx.cmd`:
  `$env:PATH = "C:\Program Files\nodejs;$env:PATH"`
- **GitHub:** https://github.com/us7926-beep/ribeira_tabelas (**PÚBLICO** — nada de segredo no código). `gh` CLI instalado e autenticado.
- Commits terminam com `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Streamlit original ainda no ar: https://ribeira-tabelas.streamlit.app
- **MCPs conectados:** Supabase (projeto `zejnnymfxrrrizwokudk`) e **Vercel**.

## Estrutura
```
src/        lógica Python pura/legada (Streamlit): mercado, dashboard, incc, detector, etc.
app.py      app Streamlit original (mantido no ar)
api/        BACKEND FastAPI (novo) — rodar da raiz: uvicorn api.main:app
  main.py        rotas REST
  config.py      lê env (load_dotenv de api/.env)
  security.py    senha SHA-256 + JWT (PyJWT)
  db.py          Supabase (tabelas) + Storage (bucket documentos)
  gemini.py      analisar_flyer / extrair_ficha (google-genai)
  mercado_api.py vendas_api.py incc_api.py   (reusam src/ puro)
  .env           >>> SEGREDOS (gitignored): TABLM_USERS, JWT_SECRET, GEMINI_API_KEY,
                 SUPABASE_URL, SUPABASE_KEY (service_role sb_secret_), CORS_ORIGINS
  requirements.txt  .env.example  README.md
tablm-web/  FRONTEND Next.js 16 + React 19 + Tailwind v4 (novo) — npm.cmd run dev
  app/(auth)/login/, app/(dashboard)/{page, incorporadoras/[id], empreendimentos/[id],
    flyers, benchmark/eventos, mercado, incc, vendas}
  app/api/*        route handlers (proxy multipart -> backend com JWT do cookie)
  components/, lib/{api,auth,constants}, middleware.ts
  .env.local       NEXT_PUBLIC_API_URL (gitignored)
render.yaml        blueprint do Render (deploy backend)
docs/DEPLOY.md     guia de deploy passo a passo
docs/BRIEFING.md   estado anterior
```

## O que está PRONTO (tudo no `master`; PRs #1, #2, #3 mergeados)
- **Backend:** `/auth/login` (JWT), `/me`, `/gemini/{analisar-flyer,ficha}`, hierarquia
  (`/incorporadoras`, `/empreendimentos`), `/benchmark/eventos`, `/mercado/comparativo`,
  `/incc/{variacoes,reajustar}`, `/vendas/kpis`, documentos
  (`GET/POST /empreendimentos/{id}/documentos`, `GET /documentos/{id}/url`, `DELETE /documentos/{id}`).
  `/health` mostra flags gemini/supabase.
- **Supabase:** tabelas `incorporadoras`, `empreendimentos`, `documentos`,
  `eventos_promocionais` (**RLS LIGADO** — backend usa service_role que ignora com segurança),
  bucket **`documentos`** (privado), + `benchmark_fichas` (do Streamlit, RLS off).
- **Frontend:** login (cookie httpOnly + middleware), dashboard royal (#2347C5, Hanken),
  hierarquia, **análise de flyer por IA + modal de confirmação**, **timeline de eventos**,
  **Mercado** (upload→KPIs), **Reajuste INCC** (BCB série 192), **Vendas** (KPIs),
  **Repositório de Documentos** por empreendimento.
- **88 testes pytest + typecheck OK.** CI roda backend (instala api/requirements.txt).

## Rodar local (2 terminais, AMBOS abertos ao mesmo tempo)
- **Terminal 1 — backend (raiz):**
  `& "C:\Users\AZUL\AppData\Local\Programs\Python\Python311\python.exe" -m uvicorn api.main:app --reload --port 8000`
- **Terminal 2 — frontend (`tablm-web`, janela NOVA):** `npm.cmd run dev` → http://localhost:3000
- Login: **leonardo** + senha (mesma do Streamlit). Backend lê `api/.env` sozinho.
- ⚠️ NÃO clique dentro dos terminais — o modo "Selecionar" (QuickEdit) congela o processo; **Esc** destrava.

## >>> DEPLOY — É O PRÓXIMO PASSO (#23) <<<
Ordem: **backend (Render) → frontend (Vercel) → ajustar CORS**.
1. **Backend no Render** (ação do usuário; Render não tem MCP): render.com → New ➜ Blueprint →
   repo `ribeira_tabelas` → lê `render.yaml` → Apply. Preencher env vars copiando de `api/.env`
   (**sem o espaço após o `=`**): TABLM_USERS, JWT_SECRET, GEMINI_API_KEY, SUPABASE_URL,
   SUPABASE_KEY, CORS_ORIGINS=http://localhost:3000. Pegar a URL pública, testar `/health`.
2. **Frontend no Vercel:** Root Directory = **`tablm-web`**, env `NEXT_PUBLIC_API_URL` = URL do Render.
   **O MCP do Vercel está conectado** (ferramentas: `deploy_to_vercel`, `list_projects`,
   `get_project`, `list_deployments`, `get_deployment`, `get_deployment_build_logs`,
   `get_runtime_logs`, `get_runtime_errors`, `list_teams`, `search_vercel_documentation`) —
   dá pra deployar/monitorar pelo MCP (carregar via ToolSearch `select:...`).
3. **CORS:** no Render, `CORS_ORIGINS` = URL do Vercel → re-deploya.
- Detalhes em `docs/DEPLOY.md`. Após deploy, todo push em `master` re-deploya os dois.

## Segurança (MANTER)
- Repo público → nenhum segredo no código. `api/.env` e `tablm-web/.env.local` são gitignored.
  Sempre `git grep`/checar antes de commitar.
- Backend usa a chave **service_role** (`sb_secret_`) — server-side, ignora RLS com segurança.
- **Não digitar senhas em campos de login** (quem loga é o usuário).
- A senha do `leonardo` apareceu no chat → recomendar trocar. Gerar hash:
  `python -c "import hashlib;print(hashlib.sha256('SENHA'.encode()).hexdigest())"` → atualizar
  TABLM_USERS no `api/.env` (local) e nos Secrets do Streamlit Cloud.

## Gotchas
- `streamlit==1.58.0` pinado (extra-streamlit-components exige >=1.40.1) — não desalinhar.
- PowerShell: here-string com aspas/`<>` quebra → usar `git commit -F arquivo.txt`.
- `npm` bloqueado por ExecutionPolicy → usar `npm.cmd` (ou `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`).
- INCC oficial = **BCB SGS série 192** (NÃO 7456 = INCC-M).
- Relógio do sistema é a fonte da verdade pra agendamentos (estava ~12h em 25/06).
- Validar antes de commitar: raiz `python -m pytest -q`; `tablm-web` `npx.cmd tsc --noEmit` (com PATH do Node).

## Tarefa agendada
Há um check-in agendado para **26/06 08:00 (BRT)** que reporta o estado e continua a migração
(dispara com o app aberto; senão, no próximo arranque).

## Próximo passo concreto (para a nova janela)
**Conduzir o deploy.** Orientar o usuário no **Render** (backend) — ele cria a conta e preenche
as env vars; pegar a URL e testar `/health`. Depois o **frontend no Vercel** com
`NEXT_PUBLIC_API_URL` = URL do Render (pode usar o **MCP do Vercel**, já conectado), e por fim
ajustar `CORS_ORIGINS` no Render para a URL do Vercel.
