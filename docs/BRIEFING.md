# TabLM — Briefing da migração Next.js (atualizado de madrugada)

> Resumo do que foi construído no automático e, principalmente, **o que precisa
> de você** (ação manual / aprovação). Atualizado em 2026-06-25, madrugada.

## ✅ Pronto e funcionando (local)
- **Backend FastAPI** (`api/`): login JWT, Gemini (análise de flyer + ficha),
  CRUD de incorporadoras/empreendimentos, eventos. Lê `api/.env` sozinho.
- **Banco Supabase**: 4 tabelas criadas, RLS desligado, **lê/grava/apaga
  confirmado** (testei de verdade).
- **Frontend Next.js** (`tablm-web/`): design royal + Hanken, login (cookie
  httpOnly), dashboard, **hierarquia Incorporadoras → Empreendimentos**,
  **Análise de Flyer por IA com modal de confirmação**, **timeline de Eventos**.
- Tudo type-clean e commitado no GitHub.

## 👉 O que precisa de VOCÊ (ação manual)
1. **(rápido, 1 min) Criar o bucket de arquivos no Supabase** — necessário para
   o *Repositório de Documentos* por empreendimento (próxima feature).
   Supabase → **Storage** → **New bucket** → nome **`documentos`** → **Private** →
   Create. Sem isso, eu construo a tela mas o upload de arquivo não grava.
2. **(quando for publicar) Deploy na nuvem** — precisa de contas que só você
   cria: **Railway** ou **Render** (backend) e **Vercel** (frontend). Eu gero o
   código/configuração e te passo o passo a passo; você cria as contas e cola as
   variáveis de ambiente. Hoje roda tudo local, então não é urgente.
3. **(segurança, recomendado) Trocar a senha de login** — ela apareceu no nosso
   chat. Eu gero o novo hash em 1 minuto quando você pedir.

## 🔄 O que sigo construindo (não precisa de você)
- **Repositório de Documentos** por empreendimento (depende do bucket acima para
  gravar o arquivo, mas a tela eu já deixo pronta).
- **Migração de Mercado / Vendas / Reajuste INCC** para o FastAPI + Next.js
  (#22).
- Refinamentos: filtros na timeline de eventos, sidebar em árvore, contadores
  reais na visão geral.

## ▶️ Como rodar local (2 terminais)
- **Backend** (raiz): `python -m uvicorn api.main:app --reload --port 8000`
  (lê `api/.env`; reinicie se editar o `.env`).
- **Frontend** (`tablm-web/`): `npm.cmd run dev` → http://localhost:3000.
- Dica: não clique dentro das janelas dos terminais (congela — modo
  "Selecionar"; aperte Esc se acontecer).

## 🗺️ Mapa das fases
| Fase | Status |
|---|---|
| Backend FastAPI | ✅ |
| Supabase (tabelas + RLS) | ✅ |
| Frontend: scaffold + design + login | ✅ |
| Hierarquia incorporadora→empreendimento | ✅ |
| Análise de flyer por IA + modal | ✅ |
| Timeline de Eventos & Promoções | ✅ |
| Repositório de documentos (Storage) | ⏳ (precisa do bucket) |
| Migrar Mercado/Vendas/INCC | ⏳ |
| Deploy (Railway + Vercel) | ⏳ (precisa de você) |
