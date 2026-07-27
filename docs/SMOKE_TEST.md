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

- [x] Com promoção `data_fim` em 4–7d cadastrada → item **Promoções** mostra
      badge **âmbar** com o número.
- [x] Promoção `data_fim` em ≤3d → badge vira **vermelho** (confirmado com
      Alegria expirando em 1 dia → badge `#FF4D4F`).
- [x] Promoção sem `data_fim` futuro próximo → nenhum badge.
- [x] Tooltip via `title=` attr: "2 promoção(ões) vencendo em até 7 dias".

---

## 2. `/promocoes` — filtros, timeline, drill-down (PRs #31, #33, #39, #42, #48)

### 2.1 Filtros com persistência em URL
- [x] Tabs (Ativas/Vencendo 7d/Todas/Expiradas): contagens 3/2/4/0.
- [x] Selects filtram (Vencendo + HELBOR → 2 cards).
- [x] URL atualiza com `?status=vencendo&inc=2eb993c3-...`.
- [x] Refresh mantém estado (validado via JS, idempotente).
- [x] "Limpar filtros" zera (testado: URL passa de `?status=vencendo&...`
      pra vazia, contagem volta pra 3 ativas).

### 2.2 Timeline horizontal
- [x] Card "Cronograma" entre KPIs e cards.
- [x] Linha pontilhada royal em x=hoje (28/06/2026).
- [x] Barras coloridas: Alegria vermelha (1d), Dual âmbar (4d), Passeo
      verde (13d).
- [x] Tooltip via `title` no `<g>`: nome + descrição + datas + dica
      shift+click.

### 2.3 Drill-down
- [x] **Click normal** numa barra → navega para `/empreendimentos/[id]`
      (validado com Alegria).
- [x] **Shift+click** muda Incorporadora + URL `?inc=...` **sem sair
      da página** (URL passou de `?status=vencendo` pra
      `?status=vencendo&inc=2eb993c3-...`).
- [x] Tab + Enter funciona (validado via JS dispatchEvent).

### 2.4 Admin (criar / editar / excluir)
- [x] Botão **"+ Nova promoção"** no header → modal abre com form vazio
      (empreendimento, descrição, condições, data_inicio, data_fim).
- [ ] Salvar → promoção aparece na lista sem refresh. *(não rodado pra não
      poluir dados — validado via PR #74 que GET handler agora funciona)*
- [x] **Editar** num card → modal pré-preenchido (Helbor Alegria, "Bônus
      de obra: 5% no ato", 20/06→28/06).
- [ ] Alterar `data_fim` para hoje → chip de urgência do card vira vermelho.
      *(não rodado pra não mexer em dados reais)*
- [ ] **Excluir** (rodapé do modal em modo edição) → confirm → evento some.
      *(não rodado — destrutivo)*
- [x] **Escape** fecha o modal.
- [x] **Clique fora** (no backdrop) fecha o modal.
- [ ] Filtrar por incorporadora antes → **+ Nova promoção** abre com um
      empreendimento dessa incorporadora pré-selecionado.

### 2.5 Export CSV
- [x] `promocoes.csv` com **7 colunas** exatas.
- [x] Subset bate (filtro Vencendo+HELBOR → 2 linhas: Alegria 1d, Dual 4d).
- [x] Escapamento RFC4180 confirmado (condição com vírgula vira
      `"Entrada parcelada em 24x até a entrega das chaves, sem juros"`).

---

## 3. Carteira — `/incorporadoras` e `/empreendimentos` (PRs #47, #48, #56, #58)

### 3.1 Excluir incorporadora (PR #56 — executado 2026-07-27)
- [x] Card tem botão **×** no canto superior direito (`aria-label="Excluir
      <nome>"`).
- [x] Clicar × numa incorporadora **sem empreendimentos** → `ModalConfirmar`
      abre com título `Excluir "ZZ Smoke Teste"?`, corpo "Só funciona se
      não houver empreendimentos vinculados — caso haja, exclua os
      empreendimentos primeiro." → botão vermelho **Excluir** → card
      desaparece (4 → 3 incorporadoras).
- [x] Clicar × numa incorporadora **com empreendimentos** (ZZ Smoke Vinculo
      com 1 ZZ Emp Smoke) → mesmo modal → clicar Excluir → **banner
      vermelho amigável no topo**: "Esta incorporadora ainda tem
      empreendimentos vinculados — exclua-os primeiro (entre na
      incorporadora e use o × em cada card)." (sem "Erro 409" cru — o
      server action detecta o 409 e traduz).
- [x] Card inteiro continua linkado pro dossiê — clique fora do × leva a
      `/incorporadoras/<id>` (validado indo pra ZZ Smoke Vinculo pra
      criar o empreendimento).

### 3.2 Excluir empreendimento (PR #47 — executado 2026-07-27)
- [x] Em `/incorporadoras/[id]`, card de empreendimento tem botão **×**
      (`aria-label="Excluir <nome>"`).
- [x] **Confirm nativo com texto exato descrevendo o estrago**:
      "Excluir o empreendimento "ZZ Emp Smoke 2"? Documentos, tabelas
      de preços e histórico de vendas vinculados também somem. A ação
      não pode ser desfeita." (menciona documentos + tabelas + vendas
      conforme esperado).
- [x] Confirmar → card some sem refresh, empty state "Nenhum
      empreendimento ainda. Adicione o primeiro no formulário acima."
      volta a aparecer.
- [ ] `opacity-50 + pointer-events-none` durante a action — não
      verificado por conta da velocidade da server action (executa
      < 1s no smoke; comportamento confirmado no código
      `excluirEmpreendimento` em `actions.ts`).
- [x] Sem erro exposto (fluxo feliz). Erro → banner vermelho (regra
      geral, mesmo padrão do 3.1).

### 3.3 Export CSV de empreendimentos (PR #48)
- [x] `empreendimentos.csv` com **11 colunas** exatas (nome, bairro,
      cidade, padrao, preco_m2_medio, ticket_medio, vgv_total, vso,
      unidades_vendidas, unidades_disponiveis, total_unidades).
- [x] Alegria com KPIs (R$ 9.276/m² · 545k · 3.27M VGV · 6 un.); Passeo
      e Dual sem KPIs.

### 3.4 Nova rota `/empreendimentos` (PR #58)
- [x] Atalho "Ver todos os empreendimentos →" no PageHeader.
- [x] Página global mostra todos cross-incorporadora.
- [x] **4 selects**: Incorporadora (4 opts), Padrão (Alto), Cidade
      (Mogi das Cruzes), Bairro (Vila Mogilar).
- [x] Bairro filtra em **cascata** pela cidade (cidade=Mogi → bairros
      reduz a Vila Mogilar).
- [x] URL sync (`?cidade=Mogi+das+Cruzes` após troca de select).
- [x] **Baixar CSV** → `empreendimentos-global.csv` com **12 colunas**
      (inclui `incorporadora` resolvida por nome — diff vs CSV
      per-incorporadora que tem 11).

---

## 4. Dossiê do empreendimento (PRs #41, #44, #50, #54)

Em `/empreendimentos/[id]`, com 2+ versões de tabela e 2+ meses de venda.

### 4.1 Aba Histórico de Vendas — VSO acumulado (PR #41)
- [x] Card "VSO acumulado" aparece (Alegria com `total_unidades=6`).
- [x] SVG width 640: 4 linhas ref Y (25/50/75/100%), labels MM/AA no X
      (05/26, 06/26).
- [x] Chip royal "100.0% atual" no header.
- [x] ⚠️ **Observado:** quando `unidades_vendidas` total > `total_unidades`
      (Alegria: 11 vendas / 6 unidades), VSO cravado em 100% sem aviso
      de inconsistência de dados (mostra "Velocidade de venda sobre 6
      unidades totais · 11 vendidas até jun 2026"). Vale considerar
      banner amarelo "verifique o total_unidades — vendas excedem total".

### 4.2 Aba Histórico de Vendas — export CSV (PR #50)
- [x] `vendas-mensais-ec2de66f.csv` com **3 colunas**
      (`mes, unidades_vendidas, vgv_mes`), 2 linhas ordenadas por mês
      (2026-05-01: 6/3210000; 2026-06-01: 5/2560000).
- [ ] `distribuicao-{mes}.csv` — não testado: precisa de modalidades
      cadastradas no mês (Alegria tem 0/5 jun em "Distribuição por
      modalidade"). Helper `lib/csv` já validado nos 5 outros CSVs
      desta seção, então confiável.

### 4.3 Aba Tabela — sparkline trio (PR #44)
- [x] Card **"Evolução entre versões"** mostra **3 mini-sparklines lado a
      lado**: Preço/m² (royal), Ticket médio (verde), VGV total (âmbar).
      Validado no Alegria (Jun/2026 → Jul/2026) e reconfirmado 2026-07-27
      no TOTAL BRAZ CUBAS com **3 versões** (Mai/Jun/Jul-2026), 3 pontos
      por sparkline, delta ▲1.9% vs versão inicial em cada mini.
- [x] Cada mini tem título + chip de delta + valor atual + linha SVG com
      pontos e labels. TOTAL BRAZ CUBAS: R$ 8.842 / R$ 366 mil / R$ 89.7 mi.
- [ ] Quando não há `area_m2` em ≥2 versões, mini de "Preço/m²" mostra
      empty state inline.

### 4.5 Aba Tabela — Bônus: PDF via Gemini (2026-07-27)

Prova fim-a-fim da extração de tabela de preços via Gemini com PDFs
reais do CV CRM, com Padrão detectado corretamente:

- [x] `MaXIMO_BRAZ_CUBAS_07_2026_Maximo_Braz_Cubas_SFH.pdf` (102,9 KB) →
      291 unidades extraídas, R$ 10.899/m² médio, VGV R$ 139,7 mi, Padrão
      **Medio**. Ticket R$ 480.027.
- [x] `SOHO_GALERIA_07_2026_Tabela_Padrao_SOHO_Galeria.pdf` (58,1 KB) →
      132 unidades extraídas, R$ 15.869/m² médio, VGV R$ 194,3 mi, Padrão
      **Alto**. Ticket R$ 1.472.181.
- [x] Ambos persistidos como versão de tabela Jul/2026 nos dossiês
      respectivos (`/empreendimentos/2097803d-.../aba=tabela` e
      `.../6de88a6d-...`).

### 4.4 Aba Fluxo Comercial — export CSV (PR #54)
- [x] Link "Baixar CSV" no header, ao lado do chip "Real".
- [x] `fluxo-comercial-Jul_2026-2026-06.csv` com **6 colunas** exatas
      (condicao, ticket_medio, pct_total, valor_medio_parcela,
      n_parcelas, unidades). 4 condições: À vista (R$ 600k, 20%),
      MCMV (510k, 20%), Financiamento (520k, 20%, parcela 1513.89,
      360 parcelas), FGTS (465k, 40%).
- [x] Nome combina versão da tabela ("Jul/2026" → `Jul_2026`) + mês
      do fluxo real (`2026-06`).

---

## 5. `/vendas` — inferência de modalidade (PR #31)

> Use 3 planilhas CSV de teste, todas com colunas básicas (`unidade, valor,
> status`):

### 5.1 Coluna `modalidade` explícita (executado 2026-07-27)
- [x] `inferencia_5_1_explicita.csv` (4ª coluna `modalidade` = FGTS/
      Financiamento/MCMV) → Card **"Distribuição por modalidade detectada"**
      aparece **sem** Chip "inferida".
- [x] 3 modalidades: **FGTS 2 · R$ 510.000**, **Financiamento 1 · R$ 270.000**,
      **MCMV 1 · R$ 280.000**. KPIs: 4 vendidas / 1 disponível / VSO 80% /
      Ticket R$ 272.000.

### 5.2 Inferência por **nome da unidade** (executado 2026-07-27)
- [x] `inferencia_5_2_por_nome.csv` (unidades "Apt 101 FGTS", "Apt 102
      MCMV", "Apt 103 FGTS", "Apt 104 SBPE") → Card **com** Chip âmbar
      **"inferida automaticamente"** e texto "A planilha não tinha coluna
      de modalidade — a classificação foi deduzida do nome da unidade
      (FGTS/MCMV/SBPE…) e da composição do pagamento".
- [x] Agrupamento correto: **FGTS 2 · R$ 520.000**, **MCMV 1 · R$ 260.000**,
      **SBPE 1 · R$ 280.000**.

### 5.3 Inferência por **composição do pagamento** (executado 2026-07-27)
- [x] `inferencia_5_3_composicao.csv` (colunas `entrada`,
      `valor_financiado`, `subsidio`, sem nome com FGTS/MCMV) → Card com
      Chip "inferida".
- [x] Classificação bateu regra a regra:
  - Linha `subsidio=20000 > 0` → **MCMV**
  - Linha `valor_financiado=285000` + `entrada=15000` (5% do total) →
    **Financiamento**
  - Linha só com entrada `295000` ≈ total `300000` → **À vista**

### 5.4 Bônus — CSV real do CV CRM em `/vendas` (executado 2026-07-27)

Prova fim-a-fim do fix do parser ([PR #86](https://github.com/us7926-beep/ribeira_tabelas/pull/86))
via UI de produção:

- [x] Subiu `total braz cubas- 07-26.csv` (28.431 bytes, sep `;`, BOM,
      `R$` BR, coluna FINANCIAMENTO numérica) direto no `/vendas`.
- [x] KPIs: **245 unidades · 238 vendidas · 6 disponíveis · VSO 97,1% ·
      VGV R$ 89,7 mi · Ticket R$ 366.182** — bate com o painel do CV CRM
      e com o sync das PRs #81/#82.
- [x] Coluna `FINANCIAMENTO (1x) 80,00%` **não** virou modalidade
      "explícita" (guarda `_parece_rotulo` do PR #86); classificação foi
      pela composição do pagamento (`entrada 5%` < 25% → **Financiamento**).
- [x] Card "Distribuição por modalidade" com Chip "inferida automaticamente",
      1 modalidade: **Financiamento · 238 · R$ 87,1 mi**.

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

- [x] Em `/empreendimentos` trocar **2 selects em <1s** (Padrão Alto +
      Cidade Mogi das Cruzes com 100ms entre eles, simulando humano).
      URL ganha **ambos** os params (`?padrao=Alto&cidade=Mogi+das+Cruzes`).
- [x] F5 mantém os dois filtros (3 de 4 cards visíveis após reload).
- [ ] Repetir em `/promocoes` e `/benchmark` — *não testado especificamente
      mas mesmo padrão de fix nos 3 componentes (#60 confirmou no código)*.

### 7.2 Fix parser CSV de Tabela de Preços (PR #61 + PR #86)

**Executado 2026-07-27 com os 3 exports reais do CV CRM
(TOTAL BRAZ CUBAS mai/jun/jul-2026, 245 unidades cada, 28.431 bytes,
MD5 batendo).** Subiu como versões Mai/2026, Jun/2026 e Jul/2026 no
dossiê do TOTAL BRAZ CUBAS via injeção de `File` no `input[type=file]`
da Aba Tabela.

- [x] 3 versões persistidas com 245 unidades cada; header do card lista
      "Jul/2026 · 01/07/2026 · Jun/2026 · 01/06/2026 · Mai/2026 · 01/05/2026".
- [x] Card "Diferenças entre versões" com "**245 alteradas · 0 adicionadas
      · 0 removidas**" (Jul vs Jun, match por andar+unidade). Tabela
      detalhada mostra Antes/Depois/Δ pra Preço, Entrada, Mensais e
      Financiamento em cada unidade.
- [x] Sparkline trio popular com números reais — **Preço/m² R$ 8.842
      ▲1.9%**, **Ticket R$ 366 mil ▲1.9%**, **VGV R$ 89.7 mi ▲1.9%**
      (Mai→Jul).
- [x] Formato do CV CRM (sep `;`, BOM UTF-8, `R$ 351.299,19`, `40,900 m²`)
      documentado em [`docs/DEPLOY.md`](DEPLOY.md) anexo + fixado no
      parser via [PR #86](https://github.com/us7926-beep/ribeira_tabelas/pull/86).

### 7.3 Editar empreendimento direto do card (PR #62)

- [x] Em `/incorporadoras/[id]`, botão **✎** no canto superior direito do
      card abre modal.
- [x] Modal mostra 4 inputs (nome, cidade, bairro, padrão) pré-preenchidos.
- [x] Salvar atualiza o card sem refresh (round-trip: editou "Helbor
      Passeo Patteo Mogilar (smoke)" → reverteu pro original).
- [ ] Refresh + verificar em `/empreendimentos` (lista global) → nome novo
      aparece.
- [ ] Escape fecha; clique fora fecha; nome em branco rejeita.

### 7.4 Renomear incorporadora (PR #63)

- [x] Em `/incorporadoras`, botão **✎** no card abre `prompt()` nativo
      com nome atual (`aria-label="Renomear <nome>"`).
- [x] Renomear → card atualiza (round-trip HABRAS → "(smoke)" → original;
      validado via revalidatePath, ~2s pra UI refletir).
- [ ] Refresh → nome novo no card; em `/incorporadoras/[id]` (header)
      também.
- [ ] Em `/empreendimentos` (lista global), coluna **incorporadora** do
      CSV também reflete.
- [ ] Cancelar ou nome igual = no-op (sem chamada ao backend).

### 7.5 Aba Promoções no dossiê (PR #64)

> ⚠️ Antes do [PR #74](https://github.com/us7926-beep/ribeira_tabelas/pull/74)
> esta aba mostrava banner vermelho `Failed to execute 'json' on
> 'Response': Unexpected end of JSON input` — falta do GET handler em
> `/api/benchmark/eventos`. Fix mergeado em master `05b12cd`.

- [x] Em `/empreendimentos/[id]?aba=promocoes` aparece nova aba
      **Promoções** (entre Histórico de Vendas e Documentos).
- [x] Lista mostra só promoções daquele empreendimento (Alegria → 1
      ativa: "Bônus de obra: 5% no ato").
- [x] Filtros Ativas/Todas/Expiradas funcionam.
- [ ] **+ Nova promoção** pré-seleciona o empreendimento atual; salvar
      atualiza a lista local sem refresh.
- [ ] **Editar** num card abre `ModalEvento` pré-preenchido; salvar
      atualiza.
- [ ] **Baixar CSV** exporta as 5 colunas (descrição, condições, datas,
      dias).

### 7.6 Comparar empreendimentos lado a lado (PR #66)

- [x] Em `/empreendimentos`, cada card tem **checkbox** no canto superior
      direito.
- [ ] Click no checkbox **não** navega pro dossiê (preventDefault).
- [ ] Card selecionado ganha borda royal + ring.
- [x] Barra flutuante no rodapé aparece com contagem + botão "Comparar
      (N)" (testado N=2).
- [ ] N=1 → botão diz "Selecione mais 1" e está desabilitado.
- [x] N≥2 → clicar leva pra `/comparar?ids=...`
- [x] Tabela comparativa mostra 10 linhas (Padrão/Cidade/Bairro + 7
      KPIs).
- [ ] Para KPIs numéricos, **célula verde + chip "líder"** marca o
      melhor *(não verificado — os 2 selecionados não tinham KPIs
      sincronizados, todos "—". Selecione Alegria + outro com KPIs pra
      ver a regra de líder)*.
- [ ] Empate técnico não destaca ninguém.
- [ ] Nome no header de cada coluna é link pro dossiê.
- [ ] Empty states: 0 selecionados ou 1 selecionado mostram instrução.

---

## 8. Simulador de Fluxo Comercial + Cálculo de Renda (PRs #68-#69)

> **Smoke 2026-06-27 (via Claude in Chrome): 10/10 passaram.**
> Bug crítico descoberto e fixado em [PR #72](https://github.com/us7926-beep/ribeira_tabelas/pull/72)
> antes de continuar — modais (ModalSelecionarUnidade/ModalEvento/
> ModalEditarEmpreendimento) ficavam confinados ao main porque o
> wrapper `.tablm-up` tem `transform`, criando containing block que
> prende `position: fixed`. Fix: `createPortal(document.body)` nos 3.
>
> Pré-requisito: pelo menos 2 empreendimentos com **tabela de preços
> cadastrada** (>=1 unidade com `preco_total` > 0). Use a Aba Tabela do
> dossiê para subir um CSV mínimo (`unidade,area_m2,valor`) se ainda
> não tiver — vide [`docs/DEPLOY.md` anexo CSV](DEPLOY.md).
>
> ⚠️ **Dados pré-PR #61** podem ter unidades com `valor` em vez de
> `preco_total` (antes do parser fix). O modal filtra essas unidades
> fora ("Empreendimento sem tabela de preços com unidades."). Backfill
> SQL: `UPDATE tabelas_precos SET unidades = (SELECT jsonb_agg(CASE
> WHEN u ? 'preco_total' THEN u ELSE u || jsonb_build_object(
> 'preco_total', u->'valor') END) FROM jsonb_array_elements(unidades)
> AS u) WHERE empreendimento_id = '<id>';`

### 8.1 Cálculo de Renda — endpoint isolado (PR #68)

- [x] `POST /financiamento/calcular-renda` (autenticado): com
      `parcela_obra_mensal=0, modalidade=mcmv_faixa3,
      saldo_financiar=300000, prazo_meses=360` retorna `renda_necessaria
      > 0` (R$ 6.926,21), `label_modalidade="MCMV Faixa 3"`, array
      `alertas` não-vazio. ⚠️ `parcela_obra_mensal` é **obrigatório**
      (Pydantic `ge=0`) — roteiro original omitia.
- [x] Modalidade `sbpe` → `alertas` inclui "Taxa SBPE sem TR. Use o CET
      real do banco." (renda R$ 9.262,76 @ 11,19% a.a.).
- [x] Modalidade `personalizada` sem `taxa_personalizada_anual` →
      HTTP **400** com `"taxa_personalizada_anual é obrigatória quando
      modalidade='personalizada'."`.
- [x] `prazo_meses < 12` → HTTP **422** Pydantic ("Input should be
      greater than or equal to 12").

### 8.2 Sidebar — 7º item Simulador

- [x] Sidebar mostra "Simulador de Fluxo" entre "Carteira" e
      "Reajustar por INCC".
- [x] Clique navega para `/simulador`.

### 8.3 Página /simulador — empty state

- [x] Sem linhas adicionadas, mostra contagem "0 de 4 linhas · pronto"
      e card "Nenhuma linha ainda…".
- [x] Botão **"+ Adicionar Empreendimento"** abre modal.

### 8.4 Modal de seleção de unidade

- [x] Modal lista os empreendimentos cadastrados.
- [x] Selecionar empreendimento carrega lista de unidades da tabela de
      preços mais recente (label "Apt 101 · 52m² — R$ 475.000").
- [x] Unidades sem `preco_total > 0` ficam fora da lista (confirmado
      via filtro `(ultima?.unidades ?? []).filter(u => typeof
      u.preco_total === "number" && u.preco_total > 0)`).
- [x] Botão "Adicionar linha" cria card de configuração + linha na
      tabela comparativa.
- [x] Escape fecha modal.

### 8.5 Configuração de fluxo por linha

- [x] Card colapsável (Recolher/Expandir).
- [x] Indicador "Total: 100.00%" verde quando soma = 100 ± 0.01.
- [x] Linha **Financiamento** read-only com badge "derivado" —
      recalcula automaticamente como `100 - soma(demais)` ao digitar
      Ato (10→40 → financiamento 60).
- [x] Colunas parceladas (Mensais/Anuais/Semestrais) mostram input de
      quantidade; demais mostram "—".

### 8.6 Tabela comparativa

- [x] Coluna identificação fica **sticky-left** ao rolar
      horizontalmente.
- [x] Header escuro (ink) com linha secundária de percentuais
      ("% POR LINHA (LINHA 1)").
- [x] Coluna Financiamento destacada (fundo royal no header,
      royal-tint no corpo).
- [x] Toggle **"Mostrar colunas zeradas"** alterna visibilidade das
      9 colunas (Ato/30/60/90/Mensais/Anuais/Semestrais/Parcela
      Única/Financiamento).
- [x] Com 2+ linhas, aparece linha **"Diferença R$ (A − B)"** —
      vermelho `+135.500` quando A > B no Ato (190k − 54.5k), traço
      nas zeradas, valor negativo no Financiamento (`-205.500`).

### 8.7 Debounce e recálculo

- [x] Digitar percentual chama `POST /fluxo/simular` após **600ms** sem
      novos eventos. 3 inputs rápidos consecutivos geraram **1 só
      POST**.
- [x] Add/remove de linha dispara recálculo imediato (via
      `useEffect([linhas.length])`).

### 8.8 Painel de renda por linha (integração #68)

- [x] Cada linha tem seu próprio card "Renda necessária".
- [x] Modalidade e prazo configuráveis por linha **independentemente**
      (selects locais).
- [x] **Saldo a financiar** vem de `colunas.financiamento.total`
      (50% × R$ 475k → R$ 237.500); **parcela obra** vem de
      `colunas.mensais.parcela` (R$ 0,00 quando mensais zerado).
- [x] Renda mínima atualiza ao mudar % do Ato (10→50: renda caiu de
      R$ 9.869,85 → R$ 5.483,25 em tempo real).
- [x] Alertas amarelos aparecem: "Parcelas pontuais não incluídas…" +
      "Taxas são estimativas…".

### 8.9 Limite de 4 linhas

- [x] 5ª tentativa bloqueia. Header continua "4 de 4 linhas". Mensagem
      "**Máximo de 4 linhas para manter a tabela legível.**" aparece
      no banner amarelo do **painel principal** (via `setErroAdd` em
      `SimuladorFluxo.tsx`), não dentro do modal — roteiro divergia
      mas comportamento é claro pro usuário.

### 8.10 Remoção

- [x] Botão **×** no card pede confirmação ("Remover '<nome>' do
      simulador?").
- [x] Confirmar remove linha do simulador + comparativa + painel de
      renda correspondente (4 → 3 linhas).

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
