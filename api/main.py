"""App FastAPI do TabLM — expõe a lógica Python via REST para o frontend Next.js.

Fase 1: auth (JWT), análise/ficha via Gemini e CRUD da hierarquia
(incorporadoras → empreendimentos) + eventos. Upload de arquivos para o
Supabase Storage e migração das telas de mercado/vendas/INCC vêm nas próximas
fases.
"""
import uuid
from datetime import datetime, timezone
from pathlib import PurePosixPath

from fastapi import Depends, FastAPI, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import config, db, gemini, incc_api, mercado_api, security, vendas_api

app = FastAPI(title="TabLM API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_MAX_UPLOAD_BYTES = 25 * 1024 * 1024  # 25 MB


async def _ler_upload(arquivo) -> bytes:
    conteudo = await arquivo.read(_MAX_UPLOAD_BYTES + 1)
    if len(conteudo) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Arquivo excede 25 MB")
    return conteudo


# --------------------------------------------------------------------------- #
# Schemas
# --------------------------------------------------------------------------- #
class LoginIn(BaseModel):
    usuario: str
    senha: str


class LoginOut(BaseModel):
    token: str
    usuario: str


class IncorporadoraIn(BaseModel):
    nome: str


class EmpreendimentoIn(BaseModel):
    incorporadora_id: str
    nome: str
    cidade: str | None = None
    bairro: str | None = None
    padrao: str | None = None


class EventoIn(BaseModel):
    empreendimento_id: str
    documento_id: str | None = None
    descricao: str | None = None
    data_inicio: str | None = None
    data_fim: str | None = None
    condicoes_comerciais: str | None = None


def _db_ou_503(funcao, *args, **kwargs):
    try:
        return funcao(*args, **kwargs)
    except RuntimeError as exc:  # Supabase não configurado / indisponível
        raise HTTPException(status_code=503, detail=str(exc))


# --------------------------------------------------------------------------- #
# Saúde e autenticação
# --------------------------------------------------------------------------- #
@app.get("/health")
def health():
    return {
        "status": "ok",
        "gemini": bool(config.gemini_api_key()),
        "supabase": bool(config.supabase_url() and config.supabase_key()),
    }


@app.post("/auth/login", response_model=LoginOut)
def login(dados: LoginIn):
    if not security.credenciais_validas(dados.usuario, dados.senha):
        raise HTTPException(status_code=401, detail="Usuário ou senha inválidos")
    return LoginOut(token=security.criar_token(dados.usuario), usuario=dados.usuario)


@app.get("/me")
def me(usuario: str = Depends(security.usuario_autenticado)):
    return {"usuario": usuario}


# --------------------------------------------------------------------------- #
# Gemini (análise de flyer e ficha técnica)
# --------------------------------------------------------------------------- #
@app.post("/gemini/analisar-flyer")
async def analisar_flyer(arquivo: UploadFile, _: str = Depends(security.usuario_autenticado)):
    conteudo = await _ler_upload(arquivo)
    try:
        return gemini.analisar_flyer(conteudo, arquivo.filename or "flyer.pdf")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(exc))


@app.post("/gemini/ficha")
async def extrair_ficha(arquivo: UploadFile, _: str = Depends(security.usuario_autenticado)):
    conteudo = await _ler_upload(arquivo)
    try:
        return gemini.extrair_ficha(conteudo, arquivo.filename or "doc.pdf")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(exc))


# --------------------------------------------------------------------------- #
# Hierarquia: incorporadoras -> empreendimentos
# --------------------------------------------------------------------------- #
@app.get("/incorporadoras")
def listar_incorporadoras(_: str = Depends(security.usuario_autenticado)):
    return _db_ou_503(db.listar, "incorporadoras")


@app.post("/incorporadoras")
def criar_incorporadora(dados: IncorporadoraIn, _: str = Depends(security.usuario_autenticado)):
    return _db_ou_503(db.inserir, "incorporadoras", dados.model_dump())


@app.delete("/incorporadoras/{id_}")
def deletar_incorporadora(id_: str, _: str = Depends(security.usuario_autenticado)):
    # Bloqueia se ja houver empreendimentos vinculados — evita orfaos.
    vinculados = _db_ou_503(db.listar, "empreendimentos", incorporadora_id=id_)
    if vinculados:
        raise HTTPException(
            status_code=409,
            detail=f"Incorporadora tem {len(vinculados)} empreendimento(s) vinculado(s).",
        )
    _db_ou_503(db.deletar, "incorporadoras", id_)
    return {"ok": True}


@app.get("/empreendimentos")
def listar_empreendimentos(
    incorporadora_id: str | None = None, _: str = Depends(security.usuario_autenticado)
):
    filtros = {"incorporadora_id": incorporadora_id} if incorporadora_id else {}
    return _db_ou_503(db.listar, "empreendimentos", **filtros)


@app.post("/empreendimentos")
def criar_empreendimento(dados: EmpreendimentoIn, _: str = Depends(security.usuario_autenticado)):
    return _db_ou_503(db.inserir, "empreendimentos", dados.model_dump(exclude_none=True))


@app.get("/empreendimentos/{id_}")
def obter_empreendimento(id_: str, _: str = Depends(security.usuario_autenticado)):
    registro = _db_ou_503(db.obter, "empreendimentos", id_)
    if registro is None:
        raise HTTPException(status_code=404, detail="Empreendimento não encontrado")
    return registro


@app.delete("/empreendimentos/{id_}")
def deletar_empreendimento(id_: str, _: str = Depends(security.usuario_autenticado)):
    _db_ou_503(db.deletar, "empreendimentos", id_)
    return {"ok": True}


@app.post("/empreendimentos/{id_}/kpis")
async def atualizar_kpis_empreendimento(
    id_: str,
    arquivo: UploadFile,
    tipo: str = Form("mercado"),
    _: str = Depends(security.usuario_autenticado),
):
    """Processa uma planilha (mercado ou vendas) e persiste os KPIs no empreendimento.

    tipo="mercado": preco_m2_medio, ticket_medio, vgv_total, total_unidades_calc.
    tipo="vendas":  vso, ticket_medio, vgv_total, total_unidades_calc, unidades_vendidas, unidades_disponiveis.
    Em ambos os casos atualiza kpis_atualizados_em.
    """
    conteudo = await _ler_upload(arquivo)
    atualizacao: dict = {"kpis_atualizados_em": datetime.now(timezone.utc).isoformat()}
    try:
        df = mercado_api.ler_planilha(conteudo, arquivo.filename or "tabela.xlsx")
        if tipo == "vendas":
            k = vendas_api.kpis(df)["kpis"]
            atualizacao.update({
                "vso": k.get("vso"),
                "ticket_medio": k.get("ticket_medio"),
                "vgv_total": k.get("vgv_total"),
                "total_unidades_calc": k.get("total_unidades"),
                "unidades_vendidas": k.get("vendidas"),
                "unidades_disponiveis": k.get("disponiveis"),
            })
        else:
            k = mercado_api.comparativo(
                df, tipo="Nosso", incorporadora="", produto="",
                cidade="", bairro="", padrao="",
            )["kpis"]
            atualizacao.update({
                "preco_m2_medio": k.get("preco_m2_medio"),
                "ticket_medio": k.get("ticket_medio"),
                "vgv_total": k.get("vgv_total"),
                "total_unidades_calc": k.get("total_unidades"),
            })
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Remove chaves com valor None — evita sobrescrever dados ja persistidos com NULL.
    campos = {chave: valor for chave, valor in atualizacao.items() if valor is not None}
    registro = _db_ou_503(db.atualizar, "empreendimentos", id_, campos)
    if not registro:
        raise HTTPException(status_code=404, detail="Empreendimento não encontrado")
    return {"ok": True, "kpis_aplicados": campos, "empreendimento": registro}


# --------------------------------------------------------------------------- #
# Eventos / promoções (benchmark)
# --------------------------------------------------------------------------- #
@app.get("/benchmark/eventos")
def listar_eventos(_: str = Depends(security.usuario_autenticado)):
    return _db_ou_503(db.listar, "eventos_promocionais")


@app.post("/benchmark/eventos")
def criar_evento(dados: EventoIn, _: str = Depends(security.usuario_autenticado)):
    return _db_ou_503(db.inserir, "eventos_promocionais", dados.model_dump(exclude_none=True))


# --------------------------------------------------------------------------- #
# Mercado (comparativo de preço/m² a partir de uma planilha)
# --------------------------------------------------------------------------- #
@app.post("/mercado/comparativo")
async def mercado_comparativo(
    arquivo: UploadFile,
    tipo: str = Form("Concorrente"),
    incorporadora: str = Form(""),
    produto: str = Form(""),
    cidade: str = Form(""),
    bairro: str = Form(""),
    padrao: str = Form(""),
    _: str = Depends(security.usuario_autenticado),
):
    conteudo = await _ler_upload(arquivo)
    try:
        df = mercado_api.ler_planilha(conteudo, arquivo.filename or "tabela.xlsx")
        resultado = mercado_api.comparativo(
            df, tipo=tipo, incorporadora=incorporadora, produto=produto,
            cidade=cidade, bairro=bairro, padrao=padrao,
        )
        # Se o arquivo foi PDF/imagem lido por IA, devolve tambem o que ela
        # identificou (nome, incorporadora, promocoes) — frontend usa para
        # sugerir vinculo + registrar promocoes detectadas.
        ia = mercado_api.ultima_extracao_ia()
        if ia:
            resultado["ia"] = {
                "nome_empreendimento": ia.get("nome_empreendimento"),
                "incorporadora": ia.get("incorporadora"),
                "cidade": ia.get("cidade"),
                "bairro": ia.get("bairro"),
                "padrao": ia.get("padrao"),
                "promocoes": ia.get("promocoes"),
            }
        return resultado
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Falha ao processar a planilha: {exc}")


# --------------------------------------------------------------------------- #
# Reajuste por INCC-DI (BCB série 192)
# --------------------------------------------------------------------------- #
@app.get("/incc/variacoes")
def incc_variacoes(meses: int = 18, _: str = Depends(security.usuario_autenticado)):
    try:
        return incc_api.variacoes_recentes(meses)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Falha ao consultar o BCB: {exc}")


@app.post("/incc/reajustar")
async def incc_reajustar(
    arquivo: UploadFile,
    variacao_pct: float = Form(...),
    extra_pct: float = Form(0.0),
    extra_valor: float = Form(0.0),
    _: str = Depends(security.usuario_autenticado),
):
    conteudo = await _ler_upload(arquivo)
    try:
        df = mercado_api.ler_planilha(conteudo, arquivo.filename or "tabela.xlsx")
        return incc_api.reajustar(df, variacao_pct, extra_pct, extra_valor)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Falha ao reajustar: {exc}")


# --------------------------------------------------------------------------- #
# Vendas (KPIs a partir de uma tabela com situação)
# --------------------------------------------------------------------------- #
@app.post("/vendas/kpis")
async def vendas_kpis(arquivo: UploadFile, _: str = Depends(security.usuario_autenticado)):
    conteudo = await _ler_upload(arquivo)
    try:
        df = mercado_api.ler_planilha(conteudo, arquivo.filename or "tabela.xlsx")
        return vendas_api.kpis(df)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Falha ao calcular KPIs: {exc}")


# --------------------------------------------------------------------------- #
# Repositório de documentos por empreendimento (Supabase Storage)
# --------------------------------------------------------------------------- #
@app.get("/empreendimentos/{id_}/documentos")
def listar_documentos(id_: str, _: str = Depends(security.usuario_autenticado)):
    return _db_ou_503(db.listar, "documentos", empreendimento_id=id_)


@app.post("/empreendimentos/{id_}/documentos")
async def upload_documento(
    id_: str,
    arquivo: UploadFile,
    tipo: str = Form("outro"),
    _: str = Depends(security.usuario_autenticado),
):
    conteudo = await _ler_upload(arquivo)
    nome = PurePosixPath(arquivo.filename or "documento").name or "documento"
    caminho = f"{id_}/{uuid.uuid4().hex}-{nome}"
    try:
        db.upload_storage(caminho, conteudo, arquivo.content_type or "application/octet-stream")
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Falha no upload: {exc}")
    try:
        return db.inserir(
            "documentos",
            {"empreendimento_id": id_, "nome": nome, "tipo": tipo, "storage_path": caminho},
        )
    except Exception as exc:  # noqa: BLE001
        db.remover_storage(caminho)
        raise HTTPException(status_code=400, detail=f"Falha ao registrar documento: {exc}")


@app.get("/documentos/{id_}/url")
def url_documento(id_: str, _: str = Depends(security.usuario_autenticado)):
    doc = _db_ou_503(db.obter, "documentos", id_)
    if not doc:
        raise HTTPException(status_code=404, detail="Documento não encontrado")
    return {"url": db.url_assinada(doc["storage_path"])}


@app.delete("/documentos/{id_}")
def deletar_documento(id_: str, _: str = Depends(security.usuario_autenticado)):
    doc = _db_ou_503(db.obter, "documentos", id_)
    if not doc:
        raise HTTPException(status_code=404, detail="Documento não encontrado")
    try:
        db.remover_storage(doc["storage_path"])
    except Exception:  # noqa: BLE001 — apaga o registro mesmo se o arquivo já sumiu
        pass
    db.deletar("documentos", id_)
    return {"ok": True}
