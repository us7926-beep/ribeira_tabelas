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
