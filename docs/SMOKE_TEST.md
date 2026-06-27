# TabLM — Roteiro de smoke test manual

> Checklist das **17 features novas** acumuladas (PRs #31–#58, sessão de
> 2026-06-26). Use junto com Cowork / Claude in Chrome — o prompt sugerido
> está no fim deste arquivo.
>
> **Setup mínimo** antes de começar:
> 1. App no ar em https://ribeira-tabelas-tablm.vercel.app
> 2. Login como `leonardo` (senha conhecida)
> 3. Pelo menos **2 incorporadoras**, **3+ empreendimentos** em pelo menos
>    duas dessas incorporadoras, com KPIs preenchidos (ticket/VGV/VSO via
>    upload de planilha em `/vendas` ou na Aba Tabela do dossiê).
> 4. Pelo menos **3 promoções cadastradas** com `data_fim` variando:
>    - 1 expirando hoje ou em ≤3 dias (testa badge vermelho)
>    - 1 expirando em 4–7 dias (testa badge âmbar)
>    - 1 expirando em >7 dias
> 5. Pelo menos **2 meses de vendas** registrados no `/empreendimentos/[id]?aba=vendas`
>    de um empreendimento com `total_unidades` preenchido (testa VSO acumulado).
> 6. Pelo menos **2 versões de tabela de preços** num empreendimento
>    (testa sparkline trio).
>
> **Convenção:** marque `[x]` quando passar; `[!]` se falhar (anote o que
> aconteceu na linha abaixo).

---

## 1. Sidebar — badge de promoções vencendo (PR #31)

- [ ] Com promoção `data_fim` em 4–7d cadastrada → item **Promoções** mostra
      badge **âmbar** com o número.
- [ ] Promoção `data_fim` em ≤3d → badge vira **vermelho**.
- [ ] Promoção sem `data_fim` futuro próximo → nenhum badge.
- [ ] Passar mouse no badge mostra tooltip "X promoção(ões) vencendo em até 7 dias".

---

## 2. `/promocoes` — filtros, timeline, drill-down (PRs #31, #33, #39, #42, #48)

### 2.1 Filtros com persistência em URL
- [ ] Tabs no topo (Ativas / Vencendo 7d / Todas / Expiradas) trocam o subset
      visível.
- [ ] Selects **"Todas incorporadoras"** e **"Todos padrões"** filtram.
- [ ] Cada troca atualiza a URL com `?status=&inc=&padrao=&q=`.
- [ ] Refresh (F5) mantém o estado.
- [ ] Botão **"Limpar filtros"** aparece quando algo não-default está ativo
      e zera tudo.

### 2.2 Timeline horizontal
- [ ] Card **"Cronograma"** aparece entre os KPIs e a lista de cards.
- [ ] Linha pontilhada royal marca o "hoje".
- [ ] Barras coloridas por urgência: verde (>7d), âmbar (≤7d), vermelho
      (≤3d), cinza-claro (expiradas).
- [ ] Tooltip ao passar mouse mostra nome do empreendimento + descrição +
      datas + "clique para abrir o dossiê · shift+clique para filtrar pela
      incorporadora".

### 2.3 Drill-down
- [ ] **Click normal** numa barra → navega para `/empreendimentos/[id]`
      (dossiê).
- [ ] **Shift+click** numa barra → select de Incorporadora muda + URL ganha
      `?inc=<id>` + lista re-filtra **sem sair da página**.
- [ ] Tab + Enter na barra também funciona (acessibilidade).

### 2.4 Admin (criar / editar / excluir)
- [ ] Botão **"+ Nova promoção"** no header → modal abre com form completo
      (empreendimento, descrição, condições, data_inicio, data_fim).
- [ ] Salvar → promoção aparece na lista sem refresh.
- [ ] **Editar** num card → modal pré-preenchido.
- [ ] Alterar `data_fim` para hoje → chip de urgência do card vira vermelho.
- [ ] **Excluir** (rodapé do modal em modo edição) → confirm → evento some.
- [ ] **Escape** ou **clique fora** fecha o modal; durante save, ambos são
      bloqueados.
- [ ] Filtrar por incorporadora antes → **+ Nova promoção** abre com um
      empreendimento dessa incorporadora pré-selecionado.

### 2.5 Export CSV
- [ ] Botão **"Baixar CSV"** ao lado de "+ Nova promoção" baixa
      `promocoes.csv` com **7 colunas** (empreendimento, incorporadora,
      descrição, condições, data_inicio, data_fim, dias_ate_vencer).
- [ ] Aplicar filtro → CSV bate com o subset visível.

---

## 3. Carteira — `/incorporadoras` e `/empreendimentos` (PRs #47, #48, #56, #58)

### 3.1 Excluir incorporadora (PR #56)
- [ ] Card de incorporadora tem botão **×** no canto superior direito.
- [ ] Clicar × numa incorporadora **sem empreendimentos** → confirm →
      desaparece.
- [ ] Clicar × numa incorporadora **com empreendimentos** → banner vermelho
      no topo: "Esta incorporadora ainda tem empreendimentos vinculados…".
- [ ] Card inteiro continua linkado pro dossiê — clique fora do × abre.

### 3.2 Excluir empreendimento (PR #47)
- [ ] Em `/incorporadoras/[id]`, cada card de empreendimento tem botão **×**.
- [ ] Confirm descreve o estrago (documentos, tabelas, vendas vinculados).
- [ ] Durante exclusão, card vira **opacity-50 + pointer-events-none**.
- [ ] Erro → banner vermelho.

### 3.3 Export CSV de empreendimentos (PR #48)
- [ ] Em `/incorporadoras/[id]`, link **"Baixar CSV"** ao lado da busca
      exporta `empreendimentos.csv` com **11 colunas** (nome, bairro, cidade,
      padrão + 7 KPIs).
- [ ] Buscar por bairro → CSV traz só o subset.

### 3.4 Nova rota `/empreendimentos` (PR #58)
- [ ] Em `/incorporadoras`, atalho **"Ver todos os empreendimentos →"** no
      PageHeader leva pra `/empreendimentos`.
- [ ] Página global mostra todos empreendimentos cross-incorporadora.
- [ ] **4 selects** funcionam: Incorporadora, Padrão, Cidade, Bairro.
- [ ] Bairro filtra em cascata pela cidade (só mostra bairros da cidade
      selecionada).
- [ ] URL sync (`?inc=&padrao=&cidade=&bairro=&q=`); refresh mantém.
- [ ] Botão **"Limpar filtros"** zera.
- [ ] **3 KPIs** do subset: count, VGV somado, ticket médio (com VSO médio
      no hint).
- [ ] Cards mostram chip de padrão + KPIs em destaque (VSO, ticket, VGV) +
      link pro dossiê.
- [ ] **Baixar CSV** exporta `empreendimentos-global.csv` com **12 colunas**
      (inclui incorporadora resolvida por nome).
- [ ] Empty state quando filtros não retornam nada.

---

## 4. Dossiê do empreendimento (PRs #41, #44, #50, #54)

Em `/empreendimentos/[id]`, com 2+ versões de tabela e 2+ meses de venda.

### 4.1 Aba Histórico de Vendas — VSO acumulado (PR #41)
- [ ] Card **"VSO acumulado"** aparece (só se `total_unidades` preenchido).
- [ ] Gráfico SVG com eixo Y 0–100% e linhas de referência em 25/50/75/100.
- [ ] Eixo X com MM/AA por mês.
- [ ] Chip royal no header mostra "X% atual".
- [ ] Soma acumulada bate com `unidades_vendidas` por mês registrados.

### 4.2 Aba Histórico de Vendas — export CSV (PR #50)
- [ ] **"Baixar CSV"** no Card "Vendas por mês" → `vendas-mensais-XXXXXXXX.csv`
      ordenado por mês com colunas `mes, unidades_vendidas, vgv_mes`.
- [ ] Selecionar mês no Card "Distribuição por modalidade" → **"Baixar CSV"**
      no rodapé → `distribuicao-{mes}.csv` com `mes, modalidade, unidades,
      vgv` (só linhas > 0).

### 4.3 Aba Tabela — sparkline trio (PR #44)
- [ ] Card **"Evolução entre versões"** mostra **3 mini-sparklines lado a
      lado**: Preço/m² (royal), Ticket médio (verde), VGV total (âmbar).
- [ ] Cada mini tem título + chip de delta % vs versão inicial + valor atual
      + linha SVG com pontos e labels.
- [ ] Quando não há `area_m2` em ≥2 versões, mini de "Preço/m²" mostra empty
      state inline.

### 4.4 Aba Fluxo Comercial — export CSV (PR #54)
- [ ] Header do Card principal tem link **"Baixar CSV"** ao lado do chip
      Real/Estimado.
- [ ] Arquivo `fluxo-comercial-{versao}-{mes?}.csv` com 6 colunas
      (condicao, ticket_medio, pct_total, valor_medio_parcela, n_parcelas,
      unidades).
- [ ] Trocar de mês (quando há real) → nome do arquivo reflete o novo mês.

---

## 5. `/vendas` — inferência de modalidade (PR #31)

> Use 3 planilhas CSV de teste, todas com colunas básicas (`unidade, valor,
> status`):

### 5.1 Coluna `modalidade` explícita
- [ ] Planilha com 4ª coluna `modalidade` (valores FGTS / Financiamento /
      etc.) → Card **"Distribuição por modalidade detectada"** aparece **sem**
      Chip "inferida" (comportamento antigo).
- [ ] Subtítulo diz "Coluna **modalidade** da planilha".

### 5.2 Inferência por **nome da unidade**
- [ ] Planilha **sem** coluna modalidade, mas com unidades nomeadas
      "Apt 101 FGTS", "Apt 102 MCMV", etc. → Card aparece **com** Chip âmbar
      **"inferida automaticamente"**.
- [ ] Distribuição agrupa FGTS, MCMV, etc. corretamente.

### 5.3 Inferência por **composição do pagamento**
- [ ] Planilha sem coluna modalidade nem nome com FGTS/MCMV, mas com colunas
      `entrada`, `valor_financiado`, `subsidio` → Card aparece com Chip
      "inferida".
- [ ] Classifica:
  - `subsidio > 0` → **MCMV**
  - `valor_financiado > 0` e `entrada < 25% do total` → **Financiamento**
  - só entrada ≈ total → **À vista**

---

## 6. Notificação por email (PR #35) — *só se você tiver configurado o setup*

> Requer: conta Resend + envs no Render (`RESEND_API_KEY`, `CRON_SECRET`,
> `NOTIFICACOES_EMAIL_DESTINO`) e Vercel (`CRON_SECRET`). Passo a passo em
> [`docs/DEPLOY.md` seção 4](DEPLOY.md).

- [ ] **Vercel → Project → Settings → Cron Jobs** lista
      `/api/cron/promocoes-vencendo` com schedule `0 12 * * *`.
- [ ] Clicar **Run now** retorna `{enviado: bool, ...}` no log.
- [ ] Com promoção vencendo em ≤7d → email chega no destinatário com lista
      formatada (paleta royal + chips de urgência).
- [ ] Chamar de novo no mesmo dia → resposta
      `{enviado: false, motivo: "todas já notificadas hoje"}` (dedup).
- [ ] Sem promoções vencendo →
      `{enviado: false, motivo: "nenhuma promoção vencendo"}`.

---

## 7. Pós-smoke 2026-06-27 (PRs #60–#66) — adicionado na rodada de fix+rush

### 7.1 Fix URL sync race (PR #60)

- [ ] Em `/empreendimentos` trocar **2 selects em <1s** (ex.: Padrão Alto + Cidade Mogi). URL ganha **ambos** os params (`?padrao=...&cidade=...`).
- [ ] F5 mantém os dois filtros.
- [ ] Repetir em `/promocoes` e `/benchmark` — comportamento idêntico.

### 7.2 Fix parser CSV de Tabela de Preços (PR #61)

- [ ] Subir 2 CSVs simples (`unidade,area_m2,valor`) com **preços diferentes** em versões distintas na Aba Tabela.
- [ ] Card "Diferenças entre versões" agora mostra **N alteradas** (não mais "0").
- [ ] Sparkline trio (Preço/m² + Ticket + VGV) popula com números reais.
- [ ] Documentação do formato CSV aceito está em [`docs/DEPLOY.md`](DEPLOY.md) anexo.

### 7.3 Editar empreendimento direto do card (PR #62)

- [ ] Em `/incorporadoras/[id]`, botão **✎** no canto superior direito do card abre modal.
- [ ] Modal mostra 4 inputs (nome, cidade, bairro, padrão) pré-preenchidos.
- [ ] Salvar atualiza o card sem refresh.
- [ ] Refresh + verificar em `/empreendimentos` (lista global) → nome novo aparece.
- [ ] Escape fecha; clique fora fecha; nome em branco rejeita.

### 7.4 Renomear incorporadora (PR #63)

- [ ] Em `/incorporadoras`, botão **✎** no card abre `prompt()` nativo com nome atual.
- [ ] Renomear → card atualiza.
- [ ] Refresh → nome novo no card; em `/incorporadoras/[id]` (header) também.
- [ ] Em `/empreendimentos` (lista global), coluna **incorporadora** do CSV também reflete.
- [ ] Cancelar ou nome igual = no-op (sem chamada ao backend).

### 7.5 Aba Promoções no dossiê (PR #64)

- [ ] Em `/empreendimentos/[id]?aba=promocoes` aparece nova aba **Promoções**.
- [ ] Lista mostra só promoções daquele empreendimento (filtra por `empreendimento_id` no client).
- [ ] Filtros Ativas/Todas/Expiradas funcionam.
- [ ] **+ Nova promoção** pré-seleciona o empreendimento atual; salvar atualiza a lista local sem refresh.
- [ ] **Editar** num card abre `ModalEvento` pré-preenchido; salvar atualiza.
- [ ] **Baixar CSV** exporta as 5 colunas (descrição, condições, datas, dias).

### 7.6 Comparar empreendimentos lado a lado (PR #66)

- [ ] Em `/empreendimentos`, cada card tem **checkbox** no canto superior direito.
- [ ] Click no checkbox **não** navega pro dossiê (preventDefault funciona).
- [ ] Card selecionado ganha borda royal + ring.
- [ ] Barra flutuante no rodapé aparece com contagem + botão "Comparar (N)".
- [ ] N=1 → botão diz "Selecione mais 1" e está desabilitado.
- [ ] N≥2 → clicar leva pra `/comparar?ids=...`
- [ ] Tabela comparativa mostra 10 linhas (Padrão/Cidade/Bairro + 7 KPIs).
- [ ] Para KPIs numéricos, **célula verde + chip "líder"** marca o melhor (maior valor; exceto "unidades disponíveis" onde menor é melhor).
- [ ] Empate técnico não destaca ninguém.
- [ ] Nome no header de cada coluna é link pro dossiê.
- [ ] Empty states: 0 selecionados ou 1 selecionado mostram instrução.

---

## 8. Simulador de Fluxo Comercial + Cálculo de Renda (PRs #68 e #seguinte)

> Pré-requisito: pelo menos 2 empreendimentos com **tabela de preços
> cadastrada** (>=1 unidade com `preco_total` > 0). Use a Aba Tabela do
> dossiê para subir um CSV mínimo (`unidade,area_m2,valor`) se ainda
> não tiver — vide [`docs/DEPLOY.md` anexo CSV](DEPLOY.md).

### 8.1 Cálculo de Renda — endpoint isolado (PR #68)

- [ ] `POST /financiamento/calcular-renda` (autenticado): com
      `modalidade=mcmv_faixa3, saldo_financiar=300000, prazo_meses=360`
      retorna `renda_necessaria > 0`, `label_modalidade="MCMV Faixa 3"`,
      array `alertas` não-vazio.
- [ ] Modalidade `sbpe` → array `alertas` inclui menção à TR.
- [ ] Modalidade `personalizada` sem `taxa_personalizada_anual` →
      HTTP 400 com mensagem clara.
- [ ] `prazo_meses < 12` ou `> 420` → HTTP 422 (Pydantic).

### 8.2 Sidebar — 7º item Simulador

- [ ] Sidebar mostra "Simulador de Fluxo" entre "Carteira" e
      "Reajustar por INCC".
- [ ] Clique navega para `/simulador`.

### 8.3 Página /simulador — empty state

- [ ] Sem linhas adicionadas, mostra contagem "0 de 4 linhas" e card
      "Nenhuma linha ainda…".
- [ ] Botão **"+ Adicionar Empreendimento"** abre modal.

### 8.4 Modal de seleção de unidade

- [ ] Modal lista os empreendimentos cadastrados.
- [ ] Selecionar empreendimento carrega lista de unidades da tabela de
      preços mais recente.
- [ ] Unidades sem `preco_total > 0` ficam fora da lista.
- [ ] Botão "Adicionar linha" cria card de configuração + linha na
      tabela comparativa.
- [ ] Escape fecha modal.

### 8.5 Configuração de fluxo por linha

- [ ] Card colapsável (Recolher/Expandir).
- [ ] Indicador "Total: XX%" verde quando soma = 100 ± 0.01, vermelho
      caso contrário.
- [ ] Linha **Financiamento** read-only com badge "derivado" — recalcula
      automaticamente como `100 - soma(demais)` ao digitar qualquer outro
      percentual.
- [ ] Colunas parceladas (Mensais/Anuais/Semestrais) mostram input de
      quantidade; demais mostram "—".

### 8.6 Tabela comparativa

- [ ] Coluna identificação fica **sticky-left** ao rolar horizontalmente.
- [ ] Header escuro (ink) com linha secundária de percentuais.
- [ ] Coluna Financiamento destacada (fundo royal no header, royal-tint
      no corpo).
- [ ] Toggle **"Mostrar colunas zeradas"** alterna visibilidade das
      colunas sem percentual/quantidade.
- [ ] Com 2 linhas, aparece linha **"Diferença R$ (A − B)"** —
      vermelho se A > B, verde se A < B, traço se zero.

### 8.7 Debounce e recálculo

- [ ] Digitar percentual chama `POST /fluxo/simular` após **600ms** sem
      novos eventos (DevTools → Network).
- [ ] Add/remove de linha dispara recálculo imediato.

### 8.8 Painel de renda por linha (integração #68)

- [ ] Cada linha tem seu próprio card "Renda necessária".
- [ ] Modalidade e prazo configuráveis por linha **independentemente**.
- [ ] **Saldo a financiar** vem de `colunas.financiamento.total`;
      **parcela obra** vem de `colunas.mensais.parcela`.
- [ ] Render mínima atualiza ao mudar modalidade/prazo (debounce 500ms).
- [ ] Modalidade `personalizada` mostra input de taxa adicional.
- [ ] Alertas amarelos aparecem (parcelas pontuais, presets são
      estimativas, TR se modalidade SBPE).

### 8.9 Limite de 4 linhas

- [ ] Adicionar 5ª linha → modal mostra erro "Máximo de 4 linhas…" e
      bloqueia.

### 8.10 Remoção

- [ ] Botão **×** no card de uma linha pede confirmação.
- [ ] Confirmar remove linha do simulador, do comparativo e do painel
      de renda correspondente.

---

## Como reportar problemas

Pra cada item que falhar, abrir issue ou comentário no PR original com:

```
[FALHA] <seção>.<item> — <PR #>
Esperado: ...
Observado: ...
Print/console: ...
```

Lista das PRs e o que cada uma traz está em [`docs/CONTINUAR.md`](CONTINUAR.md).

---

## Prompt sugerido para Claude in Chrome / Cowork

> Cole o bloco abaixo numa sessão nova do Claude que tenha **claude-in-chrome
> conectado** (extensão Chrome instalada). O agente vai conduzir o smoke
> usando esse arquivo como roteiro.

```text
Você vai conduzir um smoke test manual do TabLM seguindo o roteiro em
docs/SMOKE_TEST.md (no repositório us7926-beep/ribeira_tabelas, branch
master) usando claude-in-chrome.

Setup:
- URL: https://ribeira-tabelas-tablm.vercel.app
- Login: usuário "leonardo" + senha (vou colar quando você pedir).
- A página tem Vercel Authentication ligada — se aparecer tela de login do
  Vercel antes da app, eu autentico manualmente e te aviso para continuar.

Plano:
1. Leia docs/SMOKE_TEST.md inteiro antes de começar (você pode usar a
   ferramenta de leitura de repositório do GitHub se tiver, ou eu colo o
   conteúdo).
2. Para cada item do checklist, em ordem:
   a. Navegue até a tela usando claude-in-chrome.
   b. Execute a ação descrita (clique, preencha, observe).
   c. Compare com o "esperado".
   d. Reporte pass/fail/observação. Se passar, marque `[x]` e siga. Se
      falhar, capture screenshot + console errors, marque `[!]` e descreva.
3. **Não invente dados** — se faltar pré-condição (ex.: "preciso de
   promoção vencendo em ≤3d e não existe nenhuma"), pause, me explique o
   que precisa e me peça pra criar via UI antes de continuar.
4. **Não execute ações destrutivas sem confirmar comigo** primeiro (ex.:
   excluir incorporadora real). Para testar excluir, use dados de teste
   que você mesmo crie ou peça pra eu criar.
5. Pule a seção 6 (notificação por email) se eu te avisar que ainda não
   configurei Resend.

No final, gere um resumo no formato:
- ✅ X passaram
- ❌ Y falharam (com link/seção de cada)
- ⏭️ Z pulados (com motivo)

Comece confirmando que você conectou no Chrome e que consegue acessar a
URL. Depois me peça a senha.
```
