# TabLM — Contexto completo da sessão (2026-06-25)

> Documento único com **tudo** que importa para continuar o trabalho em qualquer
> janela: estado, arquitetura, PRs feitos, decisões, gotchas e próximos passos.
> Complementar a [`CONTINUAR.md`](CONTINUAR.md) (handoff curto) e
> [`DEPLOY.md`](DEPLOY.md) (guia operacional). Última atualização: 2026-06-25 madrugada (após PR #25).

> **Addendum desta sessão (PRs #20-#25):**
> - **#20 — docs: handoff atualizado.**
> - **#21 — Busca na Carteira.** Campo de search em `/incorporadoras` e em
>   `/incorporadoras/[id]` (filtragem por nome/bairro/cidade, client-side).
> - **#22 — Diff por unidade entre versões.** Quando há ≥2 versões da tabela,
>   AbaTabela ganha card "Diferenças entre versões" com select da versão alvo,
>   3 KpiCards (Adicionadas/Alteradas/Removidas) e tabela detalhada das
>   alterações (Antes/Depois/Δ). Frontend-only — match por andar+unidade.
> - **#23 — Fluxo Comercial com distribuição real por modalidade.** Nova
>   tabela `vendas_por_modalidade` (UNIQUE 3-col, índice, RLS). Helper
>   `_montar_comparativo_fluxo` ganhou caminho "real" (3º parâmetro
>   `distribuicao_real`); retorna `comparativo.fonte = "real"|"estimado"` e
>   `total_vendas`. 3 endpoints novos sob `/empreendimentos/{id}/vendas-mensais/`:
>   GET/POST `/distribuicao` (substitui linhas do mês: delete + insert) e GET
>   `/modalidades-sugeridas` (chaves canônicas de `condicoes` + histórico).
>   AbaVendasMensais ganha card "Distribuição por modalidade"; AbaFluxoComercial
>   mostra chip Real/Estimado + select de mês.
> - **#24 — Promoções ativas no dashboard.** Card lista até 5 eventos com
>   `data_fim` futuro, ordenados por proximidade do término, com badge de
>   urgência verde (>14d) / âmbar (>3d) / vermelho (≤3d). Backend ganha
>   `GET /benchmark/eventos?ativos=true` (filtra `data_fim >= hoje UTC`).
> - **#25 — Exportar PDF do dossiê (e Benchmark).** Botão "🖨 Exportar PDF"
>   no PageHeader chama `window.print()`. CSS `@media print` no `globals.css`
>   esconde sidebar/botões, força fundo branco, remove sombras pesadas;
>   classes `.print-hide` e `.print-keep` para controle fino. Componente
>   `BotaoExportarPdf` reusado em `/empreendimentos/[id]` e `/benchmark`.
>
> **Addendum anterior (PRs #14-#19):**
> - **#14 — chore: handoff + cleanup.** Atualiza docs/CONTINUAR.md e
>   docs/CONTEXTO.md. Remove `components/mercado/MercadoAnalise.tsx` (órfão
>   pós design refresh; a Aba Base do Benchmark substituiu o uso).
> - **#15 — AbaBase: "+ Criar empreendimento" quando IA detecta inédito.**
>   Server Action `criarEmpreendimentoDaIA` em
>   `app/(dashboard)/benchmark/actions.ts`. Quando o `nome_empreendimento` do
>   JSON da IA não casa com nenhum cadastrado, um painel destacado aparece
>   com select de incorporadora (com opção "+ Cadastrar nova" pré-preenchida
>   com o nome detectado) e um clique cria empreendimento + inc e já grava
>   os KPIs.
> - **#16 — Unifica leitura do book (ficha + tabela).** Endpoint novo
>   `POST /empreendimentos/{id}/importar-book` com flags `extrair_ficha` e
>   `extrair_tabela`. Cada modal (Aba Ficha + Aba Tabela) ganha um checkbox
>   para "extrair também o outro lado" — quando marcado, troca o endpoint
>   chamado para o unificado. 1 upload → 1 cópia no Storage → 2 chamadas
>   Gemini → ficha aplicada + nova versão em `tabelas_precos` + KPIs
>   sincronizados.
> - **#17 — Carteira: "Importar via book" cria do zero.** Novo endpoint
>   `POST /empreendimentos/importar-book` (sem id) que cria
>   empreendimento + incorporadora (se nova, via match por nome ou IA) e
>   salva tudo a partir de um PDF. Componente
>   `ImportarEmpreendimentoBook.tsx` com modal completo no PageHeader de
>   `/incorporadoras`. Fecha o ciclo zero-to-one.
> - **#18 — AbaTabela: KPIs com delta + sparkline + baixar CSV.** Quando há
>   ≥2 versões, mostra Preço/m² médio · Ticket médio · VGV total recalculados
>   das unidades persistidas, com KpiDelta verde/vermelho comparando com a
>   versão anterior. Sparkline SVG (sem lib) do preço/m² médio. Botão
>   secundário "📊 Baixar CSV" exporta as unidades client-side.
> - **#19 — Dashboard inicial com top empreendimentos por VGV.** Página `/`
>   ganha tabela com os top 5 (preço/m², ticket, VGV) + link "Abrir". Atalho
>   "+ Importar via book" no PageHeader, ao lado do "Abrir Benchmark".
>
> **Addendum anterior (PRs #12 e #13):**
> - **PR #12 — Dossiê comercial do empreendimento.** 3 migrations Supabase
>   (`empreendimentos` +9 colunas, `tabelas_precos`, `vendas_mensais`).
>   7 endpoints novos (`PATCH /ficha`, `GET/POST /tabelas-precos`,
>   `GET /fluxo-comercial`, `GET/POST /vendas-mensais`,
>   `POST /gemini/buscar-empreendimento`). Frontend ganha rota
>   `/empreendimentos/[id]` com 4 abas (Ficha/Tabela/Fluxo/Vendas) + Documentos,
>   átomo `EditableField` (click-to-edit com badge "via IA"), deep link
>   `?aba=`. POST `/tabelas-precos` sincroniza o snapshot de KPIs no
>   empreendimento — Benchmark Competitivo segue refletindo dados reais sem
>   alterar `lib/benchmark.ts`.
> - **PR #13 — Auto-preencher ficha por book/memorial.** Nova função
>   `gemini.extrair_ficha_dossie` com prompt já alinhado às colunas atuais.
>   `POST /empreendimentos/{id}/ficha-dossie` — pipeline atômico: IA primeiro,
>   depois Storage upload e registro em `documentos` como
>   `tipo='book_empreendimento'`. Rollback se algo falhar. Frontend: a Aba
>   Ficha agora tem 3 botões no header (📄 Subir book/memorial, 🔎 Buscar
>   online, Salvar (N)). Refactor extraiu `aplicarPreenchimentoIA` reusada
>   pelos dois fluxos.

---

## 1. Resumo de 1 minuto

**TabLM** (Ribeira Empreendimentos) é uma plataforma de **inteligência competitiva**
para o portfólio imobiliário. Foi migrado de **Streamlit** para
**Next.js 16 + FastAPI**, monorepo, deploy automático.

- **Frontend:** https://ribeira-tabelas-tablm.vercel.app (Vercel, time **TABLM**)
- **Backend:** https://tablm-api.onrender.com (Render, blueprint via `render.yaml`)
- **Banco:** Supabase project `zejnnymfxrrrizwokudk` (Postgres + Storage)
- **Streamlit antigo** ainda no ar como fallback: https://ribeira-tabelas.streamlit.app
- **Repo (público, sem segredos):** https://github.com/us7926-beep/ribeira_tabelas

**Rota central do produto: `/benchmark` (Benchmark Competitivo).** 6 sub-abas
(Panorama, Head-to-head, SWOT, Oportunidades, Movimentos, Base) com barra de
Recorte (Território / Padrão / Concorrente) e deep link via `searchParams`.

---

## 2. Ambiente de desenvolvimento

- **Pasta:** `E:\Claudinho\ribeira_tabelas` (Windows, shell **PowerShell**)
- **Python:** `C:\Users\AZUL\AppData\Local\Programs\Python\Python311\python.exe`
- **Node:** `C:\Program Files\nodejs` — prefixe o PATH e use `npm.cmd`/`npx.cmd`:
  ```powershell
  $env:PATH = "C:\Program Files\nodejs;$env:PATH"
  ```
- **`gh` CLI** instalado e autenticado.
- Commits terminam com `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **MCPs conectados:**
  - **Supabase** (project `zejnnymfxrrrizwokudk`): `apply_migration`, `list_tables`, `execute_sql`, etc.
  - **Vercel** (team `tablm`, project `ribeira-tabelas`): `list_deployments`, `get_deployment_build_logs`, `get_runtime_logs`, `web_fetch_vercel_url`, etc.
  - Render **não tem MCP** — ações dele são via dashboard.

### Rodar local (2 terminais)
```powershell
# Terminal 1 — backend (na raiz)
& "C:\Users\AZUL\AppData\Local\Programs\Python\Python311\python.exe" -m uvicorn api.main:app --reload --port 8000

# Terminal 2 — frontend (em tablm-web/)
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
npm.cmd run dev   # http://localhost:3000
```

Login: **leonardo** + senha (mesma do Streamlit). ⚠️ Não clique dentro dos
terminais — modo "Selecionar" (QuickEdit) congela o processo; **Esc** destrava.

---

## 3. Arquitetura

```
                                         ┌──────────────────────┐
                                         │   Vercel             │
                                         │   tablm-web (Next 16)│
   Usuário ─────► Browser ──► proxy.ts ──┤                      │
                  (cookie JWT)            │   - Server Components│
                                          │   - Route handlers  │
                                          │     (proxy SSR p/    │
                                          │      backend)        │
                                          └──────────┬───────────┘
                                                     │ Bearer JWT
                                                     ▼
                                          ┌──────────────────────┐
                                          │  Render              │
                                          │  api/ (FastAPI)      │
                                          │                      │
                                          │  - JWT auth (12h)    │
                                          │  - Gemini (PDF/img)  │
                                          │  - Pandas (CSV/XLSX) │
                                          │  - BCB (INCC série192│
                                          └──────────┬───────────┘
                                                     │ service_role
                                                     ▼
                                          ┌──────────────────────┐
                                          │  Supabase            │
                                          │  - Postgres (tabelas)│
                                          │  - Storage (docs)    │
                                          └──────────────────────┘
```

**Importante:** o navegador **nunca** chama o backend FastAPI direto — todas as
chamadas passam pelos **route handlers** do Next (`app/api/*`), que proxiam
server-side colando o JWT do cookie. Por isso o CORS no Render
(`CORS_ORIGINS=http://localhost:3000`) não bloqueia produção.

---

## 4. Estrutura de arquivos

```
ribeira_tabelas/
├── src/                          # Lógica Python pura/legada (compartilhada com Streamlit)
│   ├── mercado.py                # KPIs de mercado
│   ├── dashboard.py              # KPIs de vendas
│   ├── incc.py                   # Reajuste por INCC
│   └── ...
├── app.py                        # Streamlit original (mantido no ar)
│
├── api/                          # BACKEND FastAPI
│   ├── main.py                   # Rotas REST (rodar: uvicorn api.main:app)
│   ├── config.py                 # Lê env (load_dotenv de api/.env)
│   ├── security.py               # SHA-256 senha + JWT (PyJWT)
│   ├── db.py                     # Supabase: listar/obter/inserir/atualizar/deletar + Storage
│   ├── gemini.py                 # analisar_flyer / extrair_ficha / extrair_tabela_precos
│   ├── mercado_api.py            # ler_planilha (CSV/XLS/PDF/imagem) + comparativo
│   ├── vendas_api.py             # kpis (situação das unidades)
│   ├── incc_api.py               # BCB série 192 + reajuste
│   ├── requirements.txt
│   ├── .env                      # >>> SEGREDOS (gitignored)
│   └── .env.example
│
├── tablm-web/                    # FRONTEND Next.js 16 + React 19 + Tailwind v4
│   ├── app/
│   │   ├── layout.tsx            # Root: Hanken Grotesk via next/font
│   │   ├── globals.css           # @theme com todos os tokens do design system
│   │   ├── (auth)/login/page.tsx # Login split 46/54
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx        # Shell: Sidebar + main bg-canvas max-w-1160px
│   │   │   ├── page.tsx          # / Visão geral
│   │   │   ├── benchmark/page.tsx          # ROTA CENTRAL (server, carrega dados)
│   │   │   ├── benchmark/eventos/page.tsx  # → redirect /benchmark?aba=movimentos
│   │   │   ├── mercado/page.tsx            # → redirect /benchmark?aba=base
│   │   │   ├── flyers/{page,actions}.tsx
│   │   │   ├── incc/page.tsx
│   │   │   ├── vendas/page.tsx
│   │   │   ├── incorporadoras/{page,actions,[id]/page}.tsx
│   │   │   └── empreendimentos/[id]/{page,actions}.tsx
│   │   └── api/                  # Route handlers (proxy server-side)
│   │       ├── auth/{login,logout}/route.ts
│   │       ├── benchmark/eventos/route.ts          # POST eventos
│   │       ├── documentos/{upload,url}/route.ts
│   │       ├── empreendimentos/[id]/kpis/route.ts  # POST persistir KPIs
│   │       ├── flyer/analisar/route.ts
│   │       ├── incc/reajustar/route.ts
│   │       ├── mercado/comparativo/route.ts        # GET/POST tabela (PDF/CSV)
│   │       └── vendas/kpis/route.ts
│   ├── components/
│   │   ├── ui/                   # Átomos do design system (11)
│   │   │   ├── Card.tsx, RoyalCard.tsx
│   │   │   ├── PageHeader.tsx, Tabs.tsx, Button.tsx, Chip.tsx
│   │   │   ├── KpiCard.tsx, KpiDelta.tsx
│   │   │   ├── Dropzone.tsx, HBar.tsx, DonutConic.tsx
│   │   ├── benchmark/            # Benchmark Competitivo (rota central)
│   │   │   ├── BenchmarkApp.tsx  # Orquestrador client (sub-abas + filtros + deep link)
│   │   │   ├── Recorte.tsx       # Barra de filtros
│   │   │   ├── AbaPanorama.tsx   # KPIs + scatter + ranking de ameaça
│   │   │   ├── AbaHeadToHead.tsx # 3-col VOCÊ vs CONCORRENTE
│   │   │   ├── AbaSwot.tsx       # Matriz 2×2 (consome lib/swot.ts)
│   │   │   ├── AbaOportunidades.tsx  # Heatmap território × padrão + janelas
│   │   │   ├── AbaMovimentos.tsx     # Timeline de eventos
│   │   │   └── AbaBase.tsx           # Upload + KPIs + vincular + promoções IA
│   │   ├── layout/Sidebar.tsx    # Gradiente royal vertical, 5 itens, rodapé
│   │   ├── flyer/AnaliseFlyer.tsx
│   │   ├── incc/ReajusteIncc.tsx
│   │   ├── vendas/VendasKpis.tsx
│   │   └── empreendimento/Documentos.tsx
│   ├── lib/
│   │   ├── api.ts                # fetch client com AbortSignal.timeout(25s)
│   │   ├── auth.ts               # getToken() do cookie
│   │   ├── constants.ts          # COOKIE_TOKEN, TOKEN_MAX_AGE
│   │   ├── benchmark.ts          # Helpers de dados derivados (real + heurística)
│   │   └── swot.ts               # analisarSwot() regras simples
│   ├── proxy.ts                  # Next 16: substitui middleware.ts (Node runtime)
│   ├── vercel.json               # { "framework": "nextjs" } — OBRIGATÓRIO
│   ├── next.config.ts
│   └── package.json
│
├── render.yaml                   # Blueprint do Render (backend)
├── docs/
│   ├── CONTINUAR.md              # Handoff curto pra próxima janela
│   ├── CONTEXTO.md               # ESTE arquivo
│   ├── DEPLOY.md                 # Guia operacional de deploy
│   ├── BRIEFING.md               # Estado anterior à migração
│   ├── HANDOFF.md                # Histórico antigo
│   ├── TREINAMENTO.md            # Treinamento de uso
│   └── CONVERSA.md               # Histórico de conversas com Claude
└── .gitignore                    # api/.env, tablm-web/.env.local, App moderno azul royalv2/
```

---

## 5. Design system

### 5.1 Tokens (em `tablm-web/app/globals.css`, via Tailwind v4 `@theme`)

| Token | Hex | Uso |
|---|---|---|
| `royal` / `royal-hover` / `royal-deep` / `royal-deepest` | `#2347C5` / `#1C3BAE` / `#1A38A8` / `#122A82` | Botões, ativos, gradientes |
| `royal-tint` | `#EAF0FE` | Chip / fundo de ícone |
| `ink` / `body` / `muted` / `faint` | `#14203A` / `#2C3850` / `#6B7689` / `#97A2B5` | Hierarquia de texto |
| `canvas` / `line` / `line-soft` / `thead` | `#F4F6FB` / `#E5E9F2` / `#EDF0F6` / `#F6F8FC` | Superfícies |
| `up` (3 níveis), `down` (3), `warn` (3) | verde / vermelho / âmbar | Sinais ▲▼ apenas |
| `font-sans` | Hanken Grotesk (via `next/font`) | Tudo |
| Raios | `ctl=12px`, `card=16px`, `pill=20px` | — |
| Sombras | `shadow-card`, `shadow-btn`, `shadow-royal` | — |
| Animação | `.tablm-up` (só transform, `.34s`) | Entrada de tela |
| Util | `.tnum` (tabular-nums) | KPIs/tabelas |

### 5.2 Átomos disponíveis em `components/ui/`

```
Card           border line, shadow-card, raio 16, padding 5/22
RoyalCard      gradiente royal, shadow-royal
PageHeader     eyebrow uppercase royal + título 30/extrabold + subtítulo + ação
Button         primary / secondary / ghost
Tabs           Segmented control royal
KpiCard        Label + valor 26/extrabold tnum + hint/delta
KpiDelta       ▲▼ verde/vermelho/neutro
Chip           royal / up / down / warn / neutro
Dropzone       Tracejado, drag-and-drop, ícone +
HBar           Barra horizontal customizável
DonutConic     Rosca via conic-gradient (sem lib)
```

### 5.3 Sidebar

Largura 256px, gradiente `linear-gradient(180deg,#1F40BC 0%,#16308F 60%,#102678 100%)`,
logo "T" branco, label MENU, **5 itens** com bolinha branca (ativo sólido /
inativo 30% opacity), rodapé com **L**eonardo + data/hora ao vivo + Sair.

```typescript
const NAV = [
  { href: "/benchmark", label: "Benchmark Competitivo" },   // ROTA CENTRAL
  { href: "/", label: "Dashboards de Vendas" },
  { href: "/flyers", label: "Análise por IA" },
  { href: "/incorporadoras", label: "Carteira" },
  { href: "/incc", label: "Reajustar por INCC" },
];
```

---

## 6. Schema do banco (Supabase)

Todas com **RLS LIGADO** — backend usa `service_role` (`sb_secret_…`), que
ignora RLS com segurança.

```sql
-- incorporadoras
id uuid PK · nome text · criado_em timestamptz

-- empreendimentos
id uuid PK · incorporadora_id uuid FK · nome text
cidade text · bairro text · padrao text · tipologias text
total_unidades int · data_lancamento date · data_entrega date
pavimentos int · torres int · elevadores_por_torre int
cnpj_spe text · ri text · criado_em timestamptz

-- KPIs derivados (migration add_kpis_to_empreendimentos)
preco_m2_medio numeric · ticket_medio numeric · vso numeric
vgv_total numeric · total_unidades_calc int · unidades_vendidas int
unidades_disponiveis int · kpis_atualizados_em timestamptz

-- documentos
id uuid PK · empreendimento_id uuid FK · nome text · tipo text
storage_path text · criado_em timestamptz

-- eventos_promocionais
id uuid PK · empreendimento_id uuid FK · documento_id uuid FK
descricao text · data_inicio date · data_fim date
condicoes_comerciais text · raw_gemini jsonb · criado_em timestamptz

-- benchmark_fichas (legado do Streamlit, RLS off)
id bigint PK identity · texto plain (não usar em produção nova)
```

**Storage:** bucket `documentos` (privado), acessado via signed URL pelo backend.

---

## 7. Endpoints do backend (`api/main.py`)

```
POST  /auth/login                   { usuario, senha } → { token, usuario }
GET   /me                           (auth) → { usuario }
GET   /health                       → { status, gemini, supabase }

POST  /gemini/analisar-flyer        (auth, multipart) → detecção rápida
POST  /gemini/ficha                 (auth, multipart) → ficha técnica completa

GET   /incorporadoras               (auth) → list
POST  /incorporadoras               (auth) { nome } → criado
DELETE /incorporadoras/{id}         (auth) → 409 se houver empreendimentos vinculados

GET   /empreendimentos              (auth, ?incorporadora_id=) → list
POST  /empreendimentos              (auth) → criado
GET   /empreendimentos/{id}         (auth)
DELETE /empreendimentos/{id}        (auth)
POST  /empreendimentos/{id}/kpis    (auth, multipart: arquivo, tipo=mercado|vendas)
                                    → persiste preco_m2_medio, ticket_medio, vso, vgv_total, etc.

GET   /benchmark/eventos            (auth) → list
POST  /benchmark/eventos            (auth) { empreendimento_id, descricao, datas, condicoes }

POST  /mercado/comparativo          (auth, multipart: CSV/XLS/PDF/imagem)
                                    → { kpis, ia? } — bloco "ia" quando PDF/imagem
GET   /incc/variacoes               (auth, ?meses=18) → BCB série 192
POST  /incc/reajustar               (auth, multipart)
POST  /vendas/kpis                  (auth, multipart) → { colunas, kpis }

GET   /empreendimentos/{id}/documentos    (auth)
POST  /empreendimentos/{id}/documentos    (auth, multipart) → upload p/ Supabase Storage
GET   /documentos/{id}/url                (auth) → signed URL
DELETE /documentos/{id}                   (auth) → remove banco + storage
```

**Hardening transversal:**
- Limite de upload: **25 MB** (HTTP 413).
- Todos os fetches do frontend usam `AbortSignal.timeout(25_000)`.
- `proxy.ts` valida `exp` do JWT e redireciona pra `/login` se expirou.

---

## 8. Cronologia desta sessão (commits/PRs)

Em ordem cronológica do dia 2026-06-25:

| PR | Commit | Resumo |
|---|---|---|
| `#4` | `0560215` | **Migra `middleware.ts` → `proxy.ts`** — Next 16 quer `proxy` (Node runtime), `middleware` rodava em Edge e falhava o deploy. |
| `#5` | `d7f71d1` | **Força framework preset Next.js no Vercel** (`vercel.json`). Sem isso, o Vercel não montava o roteamento e tudo retornava `NOT_FOUND` (mesmo com build verde). |
| `#6` | `2c7ffb2` + `7d57536` | **Design refresh:** tokens, átomos UI, Sidebar gradient, Login split, Benchmark Competitivo com 6 sub-abas, refino de todas as rotas. Hardening herdado: upload 25MB, timeout HTTP, `tokenExpirado()` no proxy. |
| `#7` | `ac8ca7c` | **Flyer:** opção "+ Cadastrar nova incorporadora" no modal, pré-selecionada quando IA detecta uma inédita. Erro de Server Action passou a retornar `{ok, erro}` em vez de lançar (Next mascarava em prod). |
| `#8` | `2571253` | Backend ganhou `DELETE /incorporadoras/{id}` (com guarda 409 se órfão). Rollback do flyer restaurado. `docs/CONTINUAR.md` atualizado. |
| `#9` | `f7c7fc5` | **KPIs reais por empreendimento + SWOT viva + deep link.** Migration adicionando colunas KPI. `POST /empreendimentos/{id}/kpis`. `lib/benchmark.ts` prefere real, fallback heurístico. `lib/swot.ts` deriva quadrantes dos dados. Aba + filtros na URL via `searchParams`. Empty state global. |
| `#10` | `4645771` | **Aba Base aceita PDF/imagem.** `gemini.extrair_tabela_precos()` lê tabela de preços + promoções. `mercado_api.ler_planilha()` detecta PDF/imagem e chama Gemini. UI mostra "IA detectei N unidades…" + cards de promoção com "Registrar como evento". |

**Estado:** master em `c07758f`, deploy READY no Vercel e Render.

---

## 9. Conversa destilada — o que aconteceu e por quê

Cronologia das demandas do usuário e como cada uma se transformou em código:

### 9.1 Deploy
- **Demanda:** continuar a migração de onde parou (handoff dizia "feature-completo,
  falta deploy").
- **Render:** usuário criou conta, deu Blueprint, colei env vars, `/health` 200 OK.
- **Vercel:** importou via dashboard, primeiro build falhou em "Deploying outputs"
  por causa do `middleware.ts` rodando em Edge. **PR #4** migrou para `proxy.ts`.
- Segundo build deu **404 em todas as rotas** (`NOT_FOUND` no edge do Vercel) mesmo
  com `next build` verde. Causa: `framework: null` no projeto — sem o preset,
  Vercel tratava como site estático. **PR #5** com `vercel.json` `"framework":
  "nextjs"` resolveu. Confirmação na metadata: `lambdaRuntimeStats: {nodejs: 2}`
  (antes era zero).

### 9.2 Design
- **Demanda:** "tirei o robô, refinar visual alinhado ao /design-sync".
- Usuário apontou material em `App moderno azul royalv2/design_handoff_tablm_redesign/`
  (não versionado, foi para `.gitignore`). README + REFINAR_UI.md + screens.
- **PR #6** aplicou: tokens em `@theme`, átomos `ui/`, Sidebar gradient royal,
  Login split 46/54, **Benchmark Competitivo** (rota central com 6 sub-abas),
  refino de todas as rotas. Junto entrou hardening pendente da sessão anterior
  (upload 25MB, timeout fetch, JWT exp check).

### 9.3 Erro de UX no flyer
- **Demanda:** flyer detectou a incorporadora, mas modal não deixava cadastrar
  nova — só vincular a existentes.
- **PR #7** adicionou opção **"+ Cadastrar nova incorporadora…"** no select,
  pré-selecionada quando o nome detectado pela IA não casa com nenhuma cadastrada.
  Server Action passou a retornar `{ok, erro}` em vez de lançar (Next 16 mascara
  Server Action errors em produção como "An error occurred in the Server
  Components render…").

### 9.4 Dados reais no Benchmark
- **Demanda:** "continue" — implicação clara de evoluir o Benchmark.
- `lib/benchmark.ts` usava heurísticas hash. Como o backend já processa planilhas
  e devolve KPIs, faltava **persistir por empreendimento**.
- **PR #9** adicionou migration Supabase (8 colunas KPI), endpoint
  `POST /empreendimentos/{id}/kpis`, fallback heurístico no front, painel
  "Vincular ao empreendimento" na Aba Base, **SWOT viva** (`lib/swot.ts` com
  regras simples), **deep link** (`searchParams` para aba + filtros), empty state.

### 9.5 PDF do Urban
- **Demanda:** "Eu coloquei o book do urban no qual ele consegue puxar muitas
  informações sobre o empreendimento mas ele não me trouxe nada".
- Diagnóstico: usuário subiu **PDF** na Aba Base; `mercado_api.ler_planilha`
  só lia CSV/XLS. Erro: "Excel file format cannot be determined".
- Análise do PDF revelou: tabela com ~73 unidades, áreas 49-71m², preços
  R$ 405-504k, padrão Médio inferível, promoção real (ITBI até 31/01/2026).
- **PR #10** adicionou `gemini.extrair_tabela_precos()` com prompt específico
  (devolve `unidades[]` + `promocoes[]` + metadados). Backend monta DataFrame
  como se fosse Excel; KPIs seguem inalterados. Frontend mostra card "IA
  detectei N unidades…" e painel "Promoções detectadas" com botão
  "Registrar como evento".

### 9.6 Aprendizados de design da sessão
- **Server Actions do Next 16 em produção mascaram erros lançados.** Sempre
  retornar `{ok, erro}` em fluxos de UX onde a mensagem importa.
- **Vercel precisa de `vercel.json` com `framework: "nextjs"`** se o auto-detect
  falhar — `framework: null` faz a app silenciosamente não rotear.
- **Backend usa `service_role`** — tudo passa por dentro, RLS é defesa em
  profundidade. Frontend nunca chama Supabase direto.
- **Heurística com fallback** > vazio: `lib/benchmark.ts` prefere KPI real,
  cai pra hash determinístico se faltar. App nunca mostra zerado.

---

## 10. Gotchas (importantes ao continuar)

### Next.js 16
- **`proxy.ts` substitui `middleware.ts`** — quem aparecer com `middleware.ts`
  novo, porte a lógica e remova. Middleware roda em Edge, proxy em Node.
- **`vercel.json` com `"framework": "nextjs"`** é OBRIGATÓRIO. Sem ele = 404
  em todas as rotas.
- **`params` e `searchParams` são `Promise`** nas pages — sempre `await`.
- **Server Actions que lançam** têm mensagem mascarada em produção. Use o
  padrão `{ok: true} | {ok: false, erro: string}` quando quiser feedback real.
- `revalidateTag(tag, profile)` — segundo argumento obrigatório no Next 16.

### Vercel
- **Deployment Protection** (Vercel Authentication) está **LIGADO**. Hoje só
  o owner logado no Vercel consegue acessar a URL. Para abrir aos usuários:
  Settings → Deployment Protection → Vercel Authentication → **Disabled**.
- `web_fetch_vercel_url` no MCP fura o muro pra você (eu) quando precisar
  testar de fora; redirect-loop com `_vercel_share` é normal — ainda assim,
  para HTML cru o login dá 200 OK.
- Domain "limpo" `ribeira-tabelas.vercel.app` NÃO é deste projeto. A URL
  canônica é **`ribeira-tabelas-tablm.vercel.app`** (sufixo do team).

### Render
- Free tier "dorme" após ~15 min sem uso; primeira requisição leva ~30s para
  acordar. Esperado para uso interno.
- **Render demora mais que Vercel** para redeployar (1-3 min vs ~25s do
  Vercel). Sempre verificar `/health` depois de push em master.

### Supabase
- Migrations só pelo MCP `apply_migration` — não rodo `execute_sql` para DDL.
- Service-role key começa com `sb_secret_`. Nunca expor no frontend.

### Local dev (Windows / PowerShell)
- `npm` bloqueado por ExecutionPolicy → use `npm.cmd` / `npx.cmd`.
- PowerShell here-string com `<>` quebra → use `git commit -F arquivo.txt`.
- Modo "Selecionar" do terminal (QuickEdit) congela o processo. **Esc** destrava.

### INCC
- **BCB série 192** = INCC-DI (oficial). Não confundir com 7456 = INCC-M.

---

## 11. Próximos passos sugeridos (ordem de impacto)

### Alto impacto (produto)
1. **"Importar Book" — modal único** (Onda 3 planejada mas não feita). Botão
   no header do Benchmark → upload de PDF → IA extrai ficha + tabela +
   promoções → modal de confirmação cria/atualiza tudo de uma vez
   (empreendimento + KPIs + eventos). Reduz vai-volta entre Carteira ↔ Base.
2. **Aba Base com "+ Criar empreendimento"** — mesma feature do flyer
   (PR #7), mas no select de vínculo da Base. Elimina necessidade de
   pré-cadastrar antes de processar a tabela.
3. **Backend persistir tabelas/versões.** Hoje os KPIs por empreendimento
   atualizam in-place. Para comparação de versões (módulo do protótipo) é
   preciso persistir cada upload como uma "versão". Tabela nova
   `tabelas_versoes` com FK + colunas processadas.

### Médio impacto (operacional)
4. **Desligar Vercel Authentication** (ação do usuário no painel).
5. **CORS_ORIGINS no Render** → `https://ribeira-tabelas-tablm.vercel.app`
   (correção; hoje não bloqueia porque tudo passa pelo route handler).
6. **Domínio próprio** (`tablm.ribeira.com.br` ou similar) no Vercel +
   Render — ambos aceitam custom domain a 1 clique.
7. **Trocar senha do leonardo** (apareceu em chat antigo). Gerar hash:
   ```python
   python -c "import hashlib;print(hashlib.sha256('SENHA'.encode()).hexdigest())"
   ```
   Atualizar `TABLM_USERS` no `api/.env` local e no painel do Render.

### Baixo impacto (qualidade)
8. **Testes do frontend** — hoje só `pytest` cobre o backend. Adicionar
   Vitest + Testing Library para os átomos de `ui/` e fluxos críticos
   (login, benchmark navigation).
9. **CI no GitHub** já roda pytest. Adicionar `tsc --noEmit` e `next build`.
10. **Renomear** as últimas referências legadas (`MercadoAnalise` em
    `components/mercado/` é órfão agora que /mercado vira redirect).

---

## 12. Comandos úteis (cola e usa)

### Validar
```bash
# Raiz
python -m pytest -q                          # 88 passed (atual)

# tablm-web/
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
npx.cmd tsc --noEmit
```

### Operacional
```bash
# Health check
curl https://tablm-api.onrender.com/health

# Smoke test login via MCP (já no contexto da Sonia)
# get_access_to_vercel_url + web_fetch_vercel_url
```

### Git
```bash
# Commit padrão da sessão
git commit -F mensagem.txt   # heredoc PowerShell quebra, use arquivo

# Co-author obrigatório
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

# Push direto em master bloqueado por safety. Sempre via PR:
git checkout -b nome/branch
git push -u origin nome/branch
gh pr create --base master --head nome/branch --title "..." --body-file body.txt
gh pr merge N --merge --delete-branch
```

---

## 13. Onde estamos AGORA

```
master: c07758f (PR #10 mergeado)
Vercel READY: dpl_5N1ipn7pF5WkHVRUotC77aFSvgVn
Render: redeployando (verificar /health)
Tasks: #1..#29 todas completed, exceto #28 (Importar Book — atalho modal único)
```

**Próxima janela do Claude** deve começar lendo este arquivo + `CONTINUAR.md`,
verificar `git log --oneline -5`, rodar `curl /health` e seguir o próximo passo
combinado com o usuário (provavelmente Onda 3 "Importar Book" se ele confirmar
que o fluxo da Onda 1+2 com o PDF do Urban funcionou).
