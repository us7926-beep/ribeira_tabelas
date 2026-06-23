# Ribeira Tabelas

Aplicativo Streamlit para a Ribeira Empreendimentos com três funcionalidades:

- 🔍 **Detectar padrão de tabela** — identifica colunas (unidade, bloco, valor, data, cliente) em planilhas enviadas.
- 🔁 **Comparar versões** — compara duas versões de uma tabela e mostra linhas adicionadas, removidas e alteradas.
- 📈 **Reajustar por INCC** — reajusta valores monetários entre duas competências, com precisão `Decimal`.

Protegido por login (usuário + senha com hash SHA-256).

## 🚀 Rodando localmente

```bash
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt

# Crie seu secrets.toml a partir do exemplo
copy .streamlit\secrets.toml.example .streamlit\secrets.toml

# Gere o hash da sua senha e cole em secrets.toml
python scripts/gerar_hash_senha.py

streamlit run app.py
```

## 🌐 Deploy no Streamlit Cloud

1. Suba este repositório no GitHub (sem o `secrets.toml` real — ele já está no `.gitignore`).
2. Acesse [share.streamlit.io](https://share.streamlit.io) e clique em **New app**.
3. Selecione o repositório, branch e o arquivo principal `app.py`.
4. Em **Advanced settings → Secrets**, cole o conteúdo do seu `.streamlit/secrets.toml` (com os hashes reais).
5. Clique em **Deploy**. A primeira build leva alguns minutos.
6. A URL pública gerada (`https://<app>.streamlit.app`) já exige login antes de mostrar qualquer conteúdo.

Para atualizar o app, basta fazer `git push` — o Streamlit Cloud reconstrói automaticamente.

## 🔐 Como gerar hashes de senha

Nunca coloque senhas em texto puro no `secrets.toml`. Gere o hash SHA-256 com:

```bash
python scripts/gerar_hash_senha.py
```

O script pede a senha (sem ecoar no terminal) e imprime o hash correspondente. Cole esse hash em `secrets.toml`:

```toml
[auth.usuarios]
leonardo = "8f3b...hash..."
```

## 👥 Como adicionar/remover usuários

- **Adicionar**: gere o hash da nova senha e adicione uma linha em `[auth.usuarios]` no `secrets.toml` (local) ou no painel de Secrets do Streamlit Cloud (produção).
- **Remover**: apague a linha correspondente ao usuário.
- Após editar os secrets em produção, o app reinicia automaticamente (ou clique em "Reboot app" no painel do Streamlit Cloud).

## 🛠️ Troubleshooting comum

| Problema | Causa provável | Solução |
|---|---|---|
| Tela de login não aparece | `secrets.toml` ausente ou mal formatado | Verifique se o arquivo existe e segue o formato do `.example` |
| "Usuário ou senha inválidos" mesmo com senha certa | Hash incorreto no secrets | Regenere o hash com `scripts/gerar_hash_senha.py` e confira espaços/aspas |
| Upload falha em arquivos grandes | Limite de 50 MB configurado em `config.toml` | Divida a planilha ou aumente `maxUploadSize` (cuidado com o limite do plano) |
| App "dormindo" / demora para abrir | Apps gratuitos hibernam após 7 dias sem uso | Acesse a URL para "despertar" o app, aguarde a build |
| Dados somem ao reiniciar o app | Streamlit Cloud não persiste disco | Esperado — baixe os arquivos de resultado (Excel/PDF) antes de sair |

## 📸 Screenshots

`> [placeholder] tela de login`

`> [placeholder] aba de comparação de versões`

`> [placeholder] aba de reajuste por INCC com PDF executivo`

## ⚠️ Limitações do Streamlit Cloud (plano gratuito)

- **Arquivos enviados são temporários**: ficam em `tempfile.gettempdir()` e somem quando o app reinicia ou hiberna. Baixe os resultados (Excel/PDF) antes de fechar a sessão.
- **Cache fica em memória da sessão** (`st.cache_data`), não em disco — não sobrevive a reinícios do container.
- **Apps no plano gratuito hibernam após ~7 dias sem acesso** e levam alguns segundos para "acordar" no próximo acesso.
- **Limite de ~1 GB de RAM** por app — planilhas muito grandes podem causar lentidão ou falha.
- Os índices INCC incluídos no código (`src/incc.py` → `INDICES_EXEMPLO`) são **apenas exemplos ilustrativos** para testes offline.

## 📡 Fonte oficial do INCC-DI

A FGV não publica uma API própria do INCC-DI. Os índices oficiais reais vêm
do **SGS (Sistema Gerenciador de Séries Temporais) do Banco Central**, que
redistribui gratuitamente a série calculada pela FGV (código `7456`, sem
necessidade de chave de acesso):

```
https://api.bcb.gov.br/dados/serie/bcdata.sgs.7456/dados?formato=json&dataInicial=DD/MM/AAAA&dataFinal=DD/MM/AAAA
```

Na aba "Reajustar por INCC", escolha **"API oficial (BCB/FGV INCC-DI)"** e
informe o período — o app busca as variações mensais e calcula o índice
acumulado em `Decimal` automaticamente (`src/incc.py:buscar_indices_incc_di`).
Resultado fica em cache por 24h (`st.cache_data(ttl=86400)`) para não
sobrecarregar a API a cada interação.
