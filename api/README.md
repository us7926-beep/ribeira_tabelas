# TabLM — Backend FastAPI

Expõe a lógica Python (mercado, Gemini, Supabase) via REST para o frontend Next.js.
Reaproveita os módulos puros de `../src/` e tem versões nativas (lendo env vars)
para o que era acoplado ao Streamlit.

## Rodar localmente

```powershell
# 1. defina as variáveis (veja .env.example) — no PowerShell:
$env:TABLM_USERS = '{"leonardo":"<hash sha256 da senha>"}'
$env:JWT_SECRET  = "um-segredo-longo"
$env:GEMINI_API_KEY = "..."      # opcional
$env:SUPABASE_URL = "https://...".; $env:SUPABASE_KEY = "service_role"   # opcional

# 2. suba o servidor (a partir da RAIZ do repo, para o pacote `api` resolver)
python -m uvicorn api.main:app --reload --port 8000
```

Docs interativas em http://localhost:8000/docs.

## Endpoints (fase 1)

| Método | Rota | Descrição |
|---|---|---|
| GET  | `/health` | status + flags de gemini/supabase |
| POST | `/auth/login` | `{usuario, senha}` → `{token, usuario}` (JWT) |
| GET  | `/me` | usuário do token (protegido) |
| POST | `/gemini/analisar-flyer` | upload → detecção (nome, incorporadora, evento, condições) |
| POST | `/gemini/buscar-empreendimento` | busca pública via Google Search |
| GET/POST | `/incorporadoras` | hierarquia |
| GET/POST | `/empreendimentos` (`?incorporadora_id=`) | hierarquia |
| GET  | `/empreendimentos/{id}` | detalhe |
| GET/POST | `/benchmark/eventos` | eventos/promoções |

Rotas protegidas exigem `Authorization: Bearer <token>`.

## Deploy (Railway ou Render)

- Comando de start: `uvicorn api.main:app --host 0.0.0.0 --port $PORT`
- Instalar: `pip install -r api/requirements.txt`
- Variáveis de ambiente: ver `.env.example` (nunca commitar valores reais).
- `CORS_ORIGINS` = domínio do frontend no Vercel.
