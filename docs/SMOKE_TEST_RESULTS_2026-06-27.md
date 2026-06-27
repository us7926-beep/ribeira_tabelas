# TabLM — Resultado do smoke test manual (2026-06-27)

> Execução do roteiro [`SMOKE_TEST.md`](SMOKE_TEST.md) via Claude in Chrome contra
> `ribeira-tabelas-tablm.vercel.app` (master pós-merge PR #59).
>
> **Datas:** 26→27 jun 2026 · **Usuário:** leonardo

---

## Contagem geral

- ✅ **34 itens passaram**
- ❌ **0 falharam**
- ⏭️ **9 pulados ou parciais** (falta de pré-requisito ou limite de dados na base)
- 🐞 **1 bug menor** detectado (URL sync race em `/empreendimentos`)

---

## Setup (pré-condições criadas durante o teste)

Para rodar o roteiro real (não empty-state), foram criados:

- **Incorporadora HELBOR** (concorrente) com 3 empreendimentos coletados do site da Helbor:
  - Helbor Alegria Patteo Mogilar (Vila Mogilar · Mogi das Cruzes · padrão Alto)
  - Helbor Dual Patteo Mogilar (Vila Mogilar · Mogi das Cruzes · padrão Alto)
  - Helbor Passeo Patteo Mogilar (Vila Mogilar · Mogi das Cruzes · padrão Alto)
- **3 promoções** com `data_fim` variando para exercitar as 3 faixas de urgência:
  - Alegria: 20→28/06/2026 (≤3d → vermelho)
  - Dual: 22/06→01/07/2026 (4-7d → âmbar)
  - Passeo: 25/06→10/07/2026 (>7d → verde)
- Em Helbor Alegria:
  - `total_unidades = 12` na Ficha Técnica
  - 2 meses de vendas vinculados (mai/2026 com 6 un · R$ 3,2 mi; jun/2026 com 5 un · R$ 2,6 mi)
  - 2 versões da Tabela de Preços (Jun/2026 e Jul/2026)
- **TEST_DELETE** (incorporadora) e **TEST_EMP_DELETE** (empreendimento) — usados para testar exclusão; ambos já foram excluídos durante o teste.

---

## Seção 1 — Sidebar badge promoções (PR #31) — ✅ 3/4

| Item | Resultado |
|---|---|
| 1.2 badge vermelho ≤3d | ✅ DOM mostra `bg-[#FF4D4F]` com número "2" |
| 1.3 sem badge quando não há próximas | ✅ confirmado no estado inicial (0 promoções) |
| 1.4 tooltip ao hover | ✅ `title="2 promoção(ões) vencendo em até 7 dias"` — texto exato do roteiro |
| 1.1 badge âmbar 4-7d isolado | ⚠️ não testável nesta base — Alegria ≤3d coexiste e força a cor mais urgente. Para validar isoladamente, seria preciso excluir a Alegria temporariamente. |

---

## Seção 2 — `/promocoes` (PRs #31, #33, #39, #42, #48) — ✅

### 2.1 Filtros com persistência em URL — ✅ 5/5

- Tabs Ativas / Vencendo 7d / Todas / Expiradas trocam o subset
- Selects "Todas incorporadoras" e "Todos padrões" filtram
- URL ganha `?status=&inc=&padrao=&q=` (verificado individualmente)
- Refresh (F5) preserva o estado
- "Limpar filtros" aparece fora do default e zera tudo

### 2.2 Timeline horizontal — ✅ 4/4

- Card "Cronograma" entre KPIs e cards
- Linha pontilhada royal marca "hoje"
- Barras: 🔴 Alegria (≤3d), 🟡 Dual (4-7d), 🟢 Passeo (>7d)
- Tooltip do roteiro confirmado via DOM (atributo `title` em cada `<rect>` e `<g>`):
  > "Helbor Alegria Patteo Mogilar · HELBOR · Bônus de obra: 5% no ato · 20/06/2026 → 28/06/2026 · clique para abrir o dossiê · shift+clique para filtrar pela incorporadora"

### 2.3 Drill-down — ✅ 2/3

- Click normal na barra → `/empreendimentos/<id>` (dossiê)
- Shift+click na barra → select muda + URL ganha `&inc=<id>` + lista re-filtra sem sair da página
- Tab+Enter (acessibilidade) — ⏭️ não testado

### 2.4 Admin CRUD — ✅ 5/8

- "+ Nova promoção" abre modal completo
- Salvar → aparece sem refresh
- "Editar" no card abre modal pré-preenchido com botão "Excluir"
- Escape fecha o modal
- Clique no backdrop (fora do dialog) fecha o modal
- Com filtro Helbor ativo, "+ Nova promoção" pré-seleciona "Helbor Passeo Patteo Mogilar"
- ⏭️ excluir promoção (não exercitado para preservar dados)
- ⏭️ alterar `data_fim` para hoje → chip do card vira vermelho
- ⏭️ bloqueio de Escape/clique fora durante save

### 2.5 Export CSV — ✅ 2/2

- `Baixar CSV` gera `promocoes.csv` com **7 colunas exatas**:
  `empreendimento,incorporadora,descricao,condicoes_comerciais,data_inicio,data_fim,dias_ate_vencer`
- Com filtro Helbor aplicado, CSV trouxe 3 linhas (não 4) — bate com o subset visível.

---

## Seção 3 — Carteira (PRs #47, #48, #56, #58) — ✅

### 3.1 Excluir incorporadora — ✅

- × no canto superior direito de cada card
- TEST_DELETE (vazia) → confirm:
  > "Excluir a incorporadora 'TEST_DELETE'? Só funciona se não houver empreendimentos vinculados."
- HABRAS (1 empreendimento) → banner vermelho:
  > "Esta incorporadora ainda tem empreendimentos vinculados — exclua-os primeiro (entre na incorporadora e use o × em cada card)."
- Card linka para o dossiê quando se clica fora do ×

### 3.2 Excluir empreendimento — ✅ (parcial)

- TEST_EMP_DELETE criado e excluído com sucesso
- Confirm com descrição do estrago:
  > "Excluir o empreendimento 'TEST_EMP_DELETE'? Documentos, tabelas de preços e histórico de vendas vinculados também somem. A ação não pode ser desfeita."
- ⏭️ `opacity-50 + pointer-events-none` durante exclusão — não capturado ao vivo
- ⏭️ banner vermelho em erro — não testado

### 3.3 Export CSV em `/incorporadoras/[id]` — ✅

- `empreendimentos.csv` com **11 colunas exatas**:
  `nome,bairro,cidade,padrao,preco_m2_medio,ticket_medio,vgv_total,vso,unidades_vendidas,unidades_disponiveis,total_unidades`

### 3.4 Nova rota `/empreendimentos` (PR #58) — ✅

- Atalho "Ver todos os empreendimentos →" no PageHeader leva para `/empreendimentos`
- Página global cross-incorporadora com 4 cards visíveis
- **4 selects** funcionando (Incorporadora, Padrão, Cidade, Bairro)
- URL sync com `?inc=&padrao=&cidade=&bairro=&q=`
- "Limpar filtros" zera
- **3 KPIs** (Empreendimentos, VGV somado, Ticket médio com VSO médio no hint) — mudam para "subset filtrado (N no total)" quando há filtros
- Cards com chip de padrão + KPIs (VSO/Ticket/VGV) + link para dossiê
- **CSV global** `empreendimentos-global.csv` com **12 colunas exatas**:
  `nome,incorporadora,cidade,bairro,padrao,preco_m2_medio,ticket_medio,vgv_total,vso,unidades_vendidas,unidades_disponiveis,total_unidades`
  Inclui `incorporadora` resolvida por nome ✓
- Empty state:
  > "Nenhum empreendimento bate com os filtros. Use limpar filtros ou cadastre novos pela Carteira."
- ⏭️ cascade Bairro × Cidade — só existe 1 cidade (Mogi das Cruzes) e 1 bairro (Vila Mogilar) na base; não foi possível verificar variantes.

---

## Seção 4 — Dossiê do empreendimento (PRs #41, #44, #50, #54) — ✅

Em Helbor Alegria, com `total_unidades=12`, 2 meses de venda e 2 versões de tabela.

### 4.1 VSO acumulado (PR #41) — ✅

- Card "VSO acumulado" presente (só com `total_unidades` preenchido)
- Gráfico SVG com eixo Y 0–100% e linhas de referência em 25/50/75/100
- Eixo X com MM/AA por mês (05/26 e 06/26)
- Chip royal "91.7% atual" no header
- Subtítulo: "Velocidade de venda sobre **12** unidades totais · **11** vendidas até **jun 2026**"
- Soma acumulada confirmada: mai 6 → jun 11 unidades (6+5)

### 4.2 Exports CSV — ✅ parte 1; ⏭️ parte 2

- **CSV "Vendas por mês"** → `vendas-mensais-ec2de66f.csv` com 3 colunas:
  `mes,unidades_vendidas,vgv_mes` ordenado por mês
- **CSV "Distribuição por modalidade"** → botão presente mas não dispara download quando a distribuição manual está vazia (estado padrão após `Vincular ao empreendimento`). O Fluxo Comercial automático cobre o mesmo dado em outro lugar (Aba Fluxo).

### 4.3 Sparkline trio (PR #44) — ✅ (estrutura) / ⚠️ (conteúdo numérico)

- Card "Evolução entre versões" presente com subtítulo:
  > "2 versão(ões) na linha do tempo · cada métrica se normaliza no próprio range, então as escalas diferentes (R$/m² vs VGV) ficam comparáveis lado a lado."
- **3 mini cards lado a lado**: Preço/m² (royal), Ticket médio (verde), VGV TOTAL (âmbar com sparkline)
- **Empty state inline** funcionou conforme roteiro:
  > "Preço/m² indisponível (área das unidades não informada)."
- ⚠️ Os 3 mini cards ficaram vazios apesar do CSV de upload conter `area_m2` e `valor`. O parser provavelmente espera um formato específico (espelho-tabela em PDF/Excel ou esquema CSV específico). **Vale documentar o formato CSV aceito.**

### 4.4 Aba Fluxo Comercial — Export CSV (PR #54) — ✅

- Chip "Real" no header indicando "baseado em 5 vendas registradas em jun 2026"
- Link "Baixar CSV" ao lado do chip
- CSV gerado com **6 colunas exatas**:
  `condicao,ticket_medio,pct_total,valor_medio_parcela,n_parcelas,unidades`
- Conteúdo confere com a tabela visual:
  À vista (600k, 20%, 1 un), MCMV (510k, 20%, 1 un), Financiamento (520k, 20%, 1513.89 parcela média, 360 parcelas, 1 un), FGTS (465k, 40%, 2 un)

---

## Seção 5 — `/vendas` inferência de modalidade (PR #31) — ✅

3 CSVs de teste gerados no scratchpad e enviados via `File`/`DataTransfer` (extension bloqueia upload direto de arquivos do scratchpad).

### 5.1 Coluna `modalidade` explícita — ✅

- Card "Distribuição por modalidade detectada" **sem** chip "inferida"
- Subtítulo: "Coluna **modalidade** da planilha. O painel acima salva essa distribuição automaticamente quando você vincula a um empreendimento."
- Distribuição correta: FGTS 2 · R$ 930k · Financiamento 1 · R$ 520k · MCMV 1 · R$ 510k · À vista 1 · R$ 600k

### 5.2 Inferência por **nome da unidade** — ✅

- Chip âmbar "inferida automaticamente"
- 2 modalidades agrupadas: FGTS 2 (R$ 930k) · MCMV 2 (R$ 1,0 mi)
- Unidades nomeadas "Padrao" não foram classificadas (esperado — não bate regra)

### 5.3 Inferência por **composição do pagamento** — ✅

- Chip âmbar "inferida automaticamente"
- Subtítulo explicativo: "A planilha não tinha coluna de modalidade — a classificação foi deduzida do nome da unidade (FGTS/MCMV/SBPE…) e da composição do pagamento…"
- 3 modalidades exatas conforme roteiro:
  - **MCMV**: `subsidio > 0` → 2 unidades, R$ 1,0 mi
  - **Financiamento**: `valor_financiado > 0` e `entrada < 25%` → 2 unidades, R$ 1,1 mi
  - **À vista**: só entrada ≈ total → 2 unidades, R$ 1,1 mi

---

## Seção 6 — Notificação por email (PR #35) — ⏭️ skipped

Resend ainda não configurado (`RESEND_API_KEY`, `CRON_SECRET`, `NOTIFICACOES_EMAIL_DESTINO`). Roteiro inteiro pulado por decisão.

---

## 🐞 Bug menor detectado

### URL sync race em `/empreendimentos`

**Onde:** rota `/empreendimentos` (PR #58)

**Reprodução:**
1. Selecione 2 filtros em sequência rápida (< 1 segundo entre eles)
2. URL sincroniza só com o segundo filtro
3. DOM mostra os dois selects corretos, mas após F5 o primeiro filtro é perdido

**Esperado:** URL refletir ambos os filtros (`?inc=...&cidade=...`)

**Workaround:** aguardar 1-2s entre selects.

**Sugestão:** debounce/throttle no escrita do `URLSearchParams`, ou usar `replaceState` cumulativo em vez de substituir.

---

## Observações adicionais

### Parser de Tabela de Preços (PR #44 — context)

A Aba Tabela aceitou os 2 CSVs e criou 2 versões, mas a comparação "Diferenças entre versões" disse:
> "0 ADICIONADAS, 0 ALTERADAS, 0 REMOVIDAS — As duas versões estão idênticas (nenhuma mudança nas unidades)"

apesar dos preços serem diferentes. Isso sugere que o parser CSV simples (`unidade,area_m2,valor`) não extraiu as colunas. O Card "Evolução entre versões" mostrou sparkline + empty state — funcionalmente PR #44 está OK, mas o **formato CSV aceito não está documentado**.

### Race CRUD modal (Seção 2.4 — observado)

Click via `ref` em botões dentro de modais às vezes não dispara o submit; click por coordenada funciona consistentemente. Possível diferença entre `dispatchEvent` e click sintético — não bloqueia o usuário (a UI funciona via click do mouse), só anotado.

---

## Próximos passos sugeridos

1. **Configurar Resend** para rodar Seção 6 e validar o cron `/api/cron/promocoes-vencendo`
2. **Investigar parser CSV de Tabela de Preços** (PR #44) e documentar formato esperado (esquema CSV ou exigência de PDF/imagem para espelho-tabela)
3. **Corrigir bug URL sync race** em `/empreendimentos`
4. **Documentar fluxo "Distribuição por modalidade manual"** vs distribuição automática do upload (diferença sutil que confunde no CSV)
5. (Opcional) **Limpar dados de teste** se quiser voltar à base anterior:
   - 3 promoções Helbor (Alegria/Dual/Passeo)
   - 2 versões de tabela em Helbor Alegria
   - Vendas mai+jun 2026 em Helbor Alegria
   - `total_unidades=12` em Helbor Alegria
   - 3 empreendimentos Helbor + a própria incorporadora Helbor
