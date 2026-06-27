# TabLM — Deploy (backend no Render + frontend no Vercel)

Backend FastAPI no **Render** (free tier) e frontend Next.js no **Vercel** (free tier).
O app Streamlit original continua no ar separadamente; isto é a versão nova.

## Ordem: backend → frontend → ajustar CORS

---

## 1. Backend no Render

1. Crie conta em **render.com** (faça login com o GitHub).
2. **New → Blueprint** → selecione o repositório `us7926-beep/ribeira_tabelas`.
   O Render lê o `render.yaml` automaticamente (serviço `tablm-api`).
   - *Alternativa manual:* **New → Web Service** → conecte o repo →
     Build: `pip install -r api/requirements.txt` ·
     Start: `uvicorn api.main:app --host 0.0.0.0 --port $PORT`.
3. Em **Environment**, preencha as variáveis (copie os valores do seu `api/.env` local):
   - `TABLM_USERS` = `{"leonardo":"<hash>"}`
   - `JWT_SECRET` = (o segredo longo)
   - `GEMINI_API_KEY` = (sua chave)
   - `SUPABASE_URL` = `https://<projeto>.supabase.co`
   - `SUPABASE_KEY` = (a **service_role / secret**, `sb_secret_...`)
   - `CORS_ORIGINS` = `http://localhost:3000` (atualiza no passo 3, com a URL do Vercel)
4. **Create / Deploy**. Anote a URL pública (ex.: `https://tablm-api.onrender.com`).
5. Teste: abra `https://tablm-api.onrender.com/health` → deve mostrar
   `{"status":"ok","gemini":true,"supabase":true}`.

> ⚠️ O free tier do Render "dorme" após ~15 min sem uso; a 1ª requisição depois
> disso demora ~30s para acordar. Normal para uso interno.

---

## 2. Frontend no Vercel

1. Crie conta em **vercel.com** (login com o GitHub).
2. **Add New → Project** → importe `us7926-beep/ribeira_tabelas`.
3. **Root Directory: `tablm-web`** ← MUITO IMPORTANTE (o app Next.js fica nessa subpasta).
4. Framework: **Next.js** (detecta sozinho).
5. **Environment Variables:**
   - `NEXT_PUBLIC_API_URL` = a URL do Render (ex.: `https://tablm-api.onrender.com`)
6. **Deploy**. Anote a URL (ex.: `https://tablm.vercel.app`).

---

## 3. Ajustar o CORS (liga o frontend ao backend)

1. Volte no **Render** → serviço `tablm-api` → **Environment**.
2. Edite `CORS_ORIGINS` = a URL do Vercel (ex.: `https://tablm.vercel.app`).
   (Pode listar várias separadas por vírgula.)
3. Salve → o Render re-deploya sozinho.

---

## Pronto ✅
Acesse a URL do **Vercel** → faça login (leonardo + senha) → app no ar, falando com
o backend no Render e o banco no Supabase.

### Atualizações futuras
Todo `git push` para `master` re-deploya automaticamente os dois (Render e Vercel
ficam ligados ao branch `master`).

### Segredos
Nada de segredo no repositório (público). As chaves vivem só nos painéis de
Environment do Render/Vercel e no `api/.env` local (gitignored).

---

## Anexo: formato de arquivos aceitos na Tabela de Preços

`POST /empreendimentos/{id}/tabelas-precos` aceita 2 caminhos:

**1. PDF ou imagem** (`.pdf`, `.png`, `.jpg`, `.jpeg`) → Gemini extrai
unidades + condições + promoções. Funciona com espelho-tabela
fotografado/scaneado.

**2. CSV ou Excel** (`.csv`, `.xlsx`) → detecção por **substring case-insensitive** no nome das colunas. Mínimo necessário:

| Conceito | Substrings aceitas (qualquer uma) | Obrigatória? |
|---|---|---|
| Valor | `valor`, `preço`, `preco`, `r$` | **sim** |
| Área | `área`, `area`, `priv`, `m2`, `m²`, `metragem` | **sim** |
| Unidade | `unid`, `apto`, `apt`, `casa`, `lote`, `sala` | recomendada |
| Andar | `andar`, `pavimento` | opcional |
| Vaga | `vaga` | opcional |
| Entrada | `entrada`, `ato` | opcional |
| Parcelas mensais | `parcela`, `mensal` | opcional |
| Financiamento | `financ` | opcional |

Exemplo mínimo que funciona:

```csv
unidade,area_m2,valor
101,50,500000
102,60,600000
```

Exemplo completo (todos os opcionais):

```csv
unidade,andar,vaga,area_m2,valor,entrada,parcelas_mensais,financiamento
101,5,1,50,500000,50000,3000,400000
```

Sem coluna de valor ou área a request devolve `400` com o detalhe
"Não identifiquei as colunas de valor e/ou área".

---

## 4. Notificações por email (Vercel Cron + Resend)

Email diário às **9h BRT** (12h UTC) listando as promoções com `data_fim`
nos próximos 7 dias. Dedup automático na tabela `notificacoes_enviadas`
(mesma promoção não é incluída duas vezes no mesmo dia).

### Conta Resend

1. Crie conta em **resend.com**.
2. **API Keys → Create** → role *Sending access*. Copie a chave (`re_…`).
3. (Opcional) **Domains → Add Domain** se quiser enviar de
   `noreply@seudominio.com`. Sem isso, o sandbox `onboarding@resend.dev`
   serve para testar (vai mais fácil para o Spam).

### Envs no Render (backend)

Adicione no painel do `tablm-api`:

- `RESEND_API_KEY` = a chave do Resend (`re_…`)
- `CRON_SECRET` = qualquer string longa aleatória (ex.: gere com `openssl rand -hex 32`)
- `NOTIFICACOES_EMAIL_DESTINO` = o email do destinatário (ex.: `leonardo@…`)
- `NOTIFICACOES_EMAIL_REMETENTE` = `"TabLM <noreply@seudominio.com>"` (opcional;
  vazio usa o sandbox)

Salvar → Render re-deploya.

### Envs no Vercel (cron caller)

Settings → Environment Variables:

- `CRON_SECRET` = **mesmo valor** do Render (o cron envia esse Bearer no header).

Não precisa redeployar manualmente — a próxima execução do cron pega a env nova.

### Como rodar/testar

- **Cron real**: roda automaticamente todo dia às 12:00 UTC. Logs em
  Vercel → Project → Logs (procure `/api/cron/promocoes-vencendo`).
- **Disparo manual** (autenticado): no Vercel, vá em **Settings → Cron Jobs**
  e clique em **Run now**. Ou via curl com o secret:
  ```bash
  curl -H "Authorization: Bearer <CRON_SECRET>" \
    https://ribeira-tabelas-tablm.vercel.app/api/cron/promocoes-vencendo
  ```
- **Sem email para enviar**: o endpoint responde
  `{"enviado": false, "motivo": "nenhuma promoção vencendo"}` (não erra).
- **Dedup**: chamar duas vezes no mesmo dia → segunda devolve
  `{"enviado": false, "motivo": "todas já notificadas hoje"}`.
