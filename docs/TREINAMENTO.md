# 📚 Treinamento — App Ribeira Tabelas

Guia completo de uso, do início ao fim. Voltado para quem vai **usar** o app no
dia a dia (vendas, stand, escritório), sem necessidade de conhecimento técnico.

**Acesse em:** https://ribeira-tabelas.streamlit.app

---

## 1. O que é o app

O **Ribeira Tabelas** é um aplicativo online (acessível por celular, tablet ou
computador) que ajuda a trabalhar com as tabelas de vendas dos empreendimentos.
Ele faz **quatro coisas**:

| Aba | Para quê serve |
|-----|----------------|
| 📊 **Dashboards** | Ver indicadores de vendas e preços, e comparar com a tabela anterior |
| 🔍 **Detectar Padrão** | Identificar automaticamente as colunas de uma planilha |
| 🔁 **Comparar Versões** | Ver o que mudou entre duas versões de uma tabela |
| 📈 **Reajustar por INCC** | Atualizar os valores das unidades pelo índice do mês + acréscimos |

Tudo protegido por **login com senha** — ninguém acessa sem usuário e senha.

---

## 2. Como entrar (login)

1. Abra https://ribeira-tabelas.streamlit.app no navegador (funciona no celular).
2. Digite seu **usuário** e **senha**.
3. Clique em **Entrar**.

> 🔒 As senhas ficam guardadas de forma criptografada (hash SHA-256). Nem quem
> tem acesso ao sistema consegue ver a senha original.

Para **sair**, use o botão **Sair** no canto superior direito.

---

## 3. Preparando sua planilha

O app aceita arquivos **Excel** (`.xlsx`, `.xls`) ou **CSV**, com até **50 MB**.

A planilha deve ter, no mínimo, colunas com:
- **Unidade** (identificador único: nº do apto, código da unidade…)
- **Valor** (preço da unidade)
- **Situação** (Disponível / Vendido / Reservado) — necessária para os dashboards

Os nomes das colunas **não precisam ser exatos** — o app deixa você escolher
qual coluna é qual na hora de usar.

> 💡 Dica: a primeira linha da planilha deve ser o **cabeçalho** (nomes das
> colunas). Os dados começam na segunda linha.

---

## 4. 📊 Aba Dashboards

Mostra os indicadores da sua tabela e, se você quiser, compara com a tabela
anterior.

### Passo a passo
1. Em **Tabela ATUAL**, envie a planilha mais recente.
2. (Opcional) Em **Tabela ANTERIOR**, envie a versão antiga para comparar.
3. Selecione as colunas: **Unidade**, **Valor** e **Situação**.

### O que você vê (tabela atual)
- **Total de unidades**, **Disponíveis**, **Vendidas**, **Reservadas**
- **VGV total** (soma de todos os valores) e **VGV disponível**
- **Ticket médio** (preço médio por unidade)
- **VSO** — Velocidade de Vendas (% de unidades vendidas)
- **Gráfico de pizza** com a distribuição por situação
- **Histograma** com a distribuição de preços

### O que você vê (comparando com a anterior)
- **Vendidas no período** — unidades que estavam disponíveis/reservadas e foram vendidas
- **Voltaram à disponibilidade** — unidades que estavam vendidas/reservadas e voltaram a ficar disponíveis
- **Aumento médio de preço (%)** e **Aumento total (R$)**
- **Novas unidades**, **Unidades removidas**, **Unidades em ambas**
- A lista das unidades vendidas e das que voltaram à disponibilidade

---

## 5. 🔍 Aba Detectar Padrão

Útil quando você recebe uma planilha nova e quer saber se ela está no formato
esperado.

1. Envie a planilha.
2. O app mostra um **mapeamento automático**: qual coluna ele acha que é
   unidade, bloco, valor, data e cliente.
3. Mostra também a **confiança** da detecção (quanto maior, mais campos ele reconheceu).

---

## 6. 🔁 Aba Comparar Versões

Mostra o que mudou entre **duas versões** de uma mesma tabela.

1. Envie a **Versão antiga** e a **Versão nova**.
2. Escolha a **coluna-chave** (a que identifica cada linha, normalmente a unidade).
3. Clique em **Comparar**.

Resultado:
- **Linhas adicionadas** (existem na nova, não existiam na antiga)
- **Linhas removidas** (existiam na antiga, sumiram na nova)
- **Linhas alteradas** (mudaram algum valor) — com o antes e o depois

---

## 7. 📈 Aba Reajustar por INCC

Atualiza os valores das unidades pelo índice do mês, com a opção de somar um
acréscimo extra.

### 1️⃣ Índice INCC do mês
- **Buscar da API oficial (BCB/FGV):** clique no botão e o app traz os últimos
  meses do **INCC-DI oficial** (calculado pela FGV, fornecido pelo Banco
  Central). Já vem selecionado o **último mês publicado**. Você pode trocar o mês.
- **Digitar manualmente:** se você já sabe o percentual do mês, digite direto
  (ex.: `0,88`).

### 2️⃣ Acréscimo adicional (opcional)
- **% adicional** — somado ao INCC (ex.: INCC 0,88% + 1% = 1,88%).
- **Valor bruto por unidade (R$)** — acréscimo fixo em reais, somado a cada unidade.

> A conta aplicada é: **novo valor = valor × (1 + total% / 100) + valor bruto**.
> O app mostra um resumo do reajuste antes de aplicar.

### 3️⃣ Tabela de unidades
1. Envie a planilha de valores.
2. Escolha a **coluna de valores** a reajustar.
3. Clique em **Reajustar e gerar nova tabela**.
4. Baixe o resultado:
   - **⬇️ Excel reajustado** (planilha com a coluna nova `_reajustado`)
   - **⬇️ PDF executivo** (resumo com total antes/depois e a diferença)

> 🎯 Exemplo: unidade de R$ 350.000 com INCC 0,77% + 1% extra + R$ 500 →
> **R$ 356.695,00**.

---

## 8. Precisão dos cálculos

Todos os reajustes usam **precisão decimal** (não usa "ponto flutuante" comum),
então os valores em reais são exatos, sem erros de centavos.

---

## 9. Glossário rápido

| Termo | Significado |
|-------|-------------|
| **VGV** | Valor Geral de Vendas — soma dos valores de todas as unidades |
| **VSO** | Velocidade de Vendas — % de unidades já vendidas |
| **Ticket médio** | Preço médio por unidade |
| **INCC-DI** | Índice Nacional de Custo da Construção (FGV), usado para reajuste |
| **Competência** | O mês de referência do índice (ex.: 2026-05 = maio/2026) |

---

## 10. Perguntas frequentes

**O app perde meus arquivos?**
Sim, por design. Os arquivos que você envia são **temporários** e somem quando
o app reinicia. Sempre **baixe** os resultados (Excel/PDF) antes de fechar.

**Por que o app demora para abrir às vezes?**
No plano gratuito, o app "hiberna" após alguns dias sem uso. O primeiro acesso
"acorda" o app e leva alguns segundos.

**Os índices do INCC são oficiais?**
Sim. Vêm direto da API do Banco Central (série 192 do SGS), que publica o
INCC-DI calculado pela FGV. Os valores conferem com a tabela oficial da
FGV/SindusCon.

**Posso acessar do celular?**
Sim. É só abrir o link no navegador do celular e fazer login.

---

## 11. Suporte

Problemas técnicos, novos usuários ou ajustes: consulte o
[README.md](../README.md) (seção *Troubleshooting* e *Como adicionar/remover
usuários*).
