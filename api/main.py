"""App FastAPI do TabLM — expõe a lógica Python via REST para o frontend Next.js.

Fase 1: auth (JWT), análise/ficha via Gemini e CRUD da hierarquia
(incorporadoras → empreendimentos) + eventos. Upload de arquivos para o
Supabase Storage e migração das telas de mercado/vendas/INCC vêm nas próximas
fases.
"""
import uuid
from datetime import datetime, timezone
from pathlib import PurePosixPath

from fastapi import Body, Depends, FastAPI, Form, HTTPException, UploadFile
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
# Helpers de KPIs e Fluxo Comercial
# --------------------------------------------------------------------------- #
def _num(valor) -> float | None:
    """Converte para float; aceita None, string, número. Retorna None se invalido."""
    if valor is None or valor == "":
        return None
    try:
        return float(valor)
    except (TypeError, ValueError):
        return None


def _montar_kpis_de_unidades(unidades: list[dict]) -> dict:
    """Calcula KPIs snapshot (preco_m2_medio, ticket_medio, vgv_total,
    total_unidades_calc) a partir da lista de unidades extraida pela IA/planilha.

    Considera preco_total quando presente; usa area_m2 para preco/m2.
    """
    if not unidades:
        return {}
    precos: list[float] = []
    precos_m2: list[float] = []
    for u in unidades:
        preco = _num(u.get("preco_total") or u.get("valor"))
        area = _num(u.get("area_m2") or u.get("area"))
        if preco and preco > 0:
            precos.append(preco)
            if area and area > 0:
                precos_m2.append(preco / area)
    if not precos:
        return {"total_unidades_calc": len(unidades)}
    vgv = sum(precos)
    return {
        "total_unidades_calc": len(unidades),
        "vgv_total": round(vgv, 2),
        "ticket_medio": round(vgv / len(precos), 2),
        "preco_m2_medio": round(sum(precos_m2) / len(precos_m2), 2) if precos_m2 else None,
    }


_TIPOS_FLUXO = ["avista", "entrada", "financiamento", "mensais", "anuais", "outros"]


def _montar_comparativo_fluxo(unidades: list[dict], condicoes: dict) -> dict:
    """Monta comparativo entre tipos de pagamento.

    v1: usa o ticket medio global como base; aplica desconto a vista,
    estima parcela media a partir das condicoes, e devolve diferencas em
    R$ e % entre cada par. Distribuicao percentual e uniforme (placeholder
    ate o backend persistir contagem real por modalidade).
    """
    condicoes = condicoes or {}
    base = _montar_kpis_de_unidades(unidades)
    ticket = base.get("ticket_medio") or 0
    por_tipo: dict[str, dict] = {}

    avista = (condicoes.get("avista") or {})
    desconto = _num(avista.get("desconto_pct")) or 0
    por_tipo["A vista"] = {
        "ticket_medio": round(ticket * (1 - desconto / 100), 2),
        "pct_total": 0,
        "valor_medio_parcela": None,
        "n_parcelas": None,
    }

    fin = (condicoes.get("financiamento") or {})
    if fin or ticket:
        prazo = int(_num(fin.get("prazo_meses")) or 360)
        por_tipo["Financiamento"] = {
            "ticket_medio": round(ticket, 2),
            "pct_total": 0,
            "valor_medio_parcela": round(ticket / prazo, 2) if prazo else None,
            "n_parcelas": prazo,
        }

    entrada = (condicoes.get("entrada") or {})
    if entrada:
        parc = int(_num(entrada.get("parcelas_obra")) or 0)
        val_parc = _num(entrada.get("valor_parcela_medio"))
        por_tipo["Entrada + Mensais"] = {
            "ticket_medio": round(ticket, 2),
            "pct_total": 0,
            "valor_medio_parcela": round(val_parc, 2) if val_parc else None,
            "n_parcelas": parc or None,
        }

    for chave_lista, rotulo in [("mensais", "Mensais"), ("anuais", "Anuais"), ("outros", "Outros")]:
        itens = condicoes.get(chave_lista) or []
        if isinstance(itens, list) and itens:
            total = sum(_num(item.get("valor")) or 0 for item in itens)
            por_tipo[rotulo] = {
                "ticket_medio": round(ticket + total, 2),
                "pct_total": 0,
                "valor_medio_parcela": round(total / len(itens), 2) if itens else None,
                "n_parcelas": len(itens),
            }

    tipos = list(por_tipo.keys())
    if tipos:
        pct = round(100 / len(tipos), 1)
        for tipo in tipos:
            por_tipo[tipo]["pct_total"] = pct

    diferencas: list[dict] = []
    for i, de in enumerate(tipos):
        for para in tipos[i + 1:]:
            v_de = por_tipo[de]["ticket_medio"]
            v_para = por_tipo[para]["ticket_medio"]
            if not v_de:
                continue
            delta = v_para - v_de
            diferencas.append({
                "de": de,
                "para": para,
                "diferenca_reais": round(delta, 2),
                "diferenca_pct": round((delta / v_de) * 100, 2),
            })

    return {"tipos": tipos, "por_tipo": por_tipo, "diferencas": diferencas}


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
# Dossie do empreendimento (Ficha, Tabela de Precos, Fluxo, Vendas Mensais)
# --------------------------------------------------------------------------- #
_FICHA_CAMPOS = {
    "nome", "bairro", "cidade", "padrao", "tipologias",
    "metragens", "vagas_comunidade", "vagas_venda", "vagas_cobertas",
    "distancia_metro_km", "tipo_uso", "unidades_residenciais",
    "unidades_comerciais", "total_unidades", "estoque",
    "pavimentos", "torres", "elevadores_por_torre",
    "data_lancamento", "data_entrega", "cnpj_spe", "ri",
}


@app.patch("/empreendimentos/{id_}/ficha")
def atualizar_ficha(
    id_: str,
    body: dict = Body(...),
    _: str = Depends(security.usuario_autenticado),
):
    """Atualiza campos da ficha tecnica. Aceita subconjunto dos campos permitidos."""
    campos = {chave: valor for chave, valor in body.items() if chave in _FICHA_CAMPOS}
    if not campos:
        raise HTTPException(status_code=400, detail="Nenhum campo valido enviado")
    # Remove None para nao zerar dados ja persistidos
    campos = {chave: valor for chave, valor in campos.items() if valor not in (None, "")}
    if not campos:
        raise HTTPException(status_code=400, detail="Nenhum valor para atualizar")
    registro = _db_ou_503(db.atualizar, "empreendimentos", id_, campos)
    if not registro:
        raise HTTPException(status_code=404, detail="Empreendimento nao encontrado")
    return {"ok": True, "campos_atualizados": list(campos.keys()), "empreendimento": registro}


@app.get("/empreendimentos/{id_}/tabelas-precos")
def listar_tabelas_precos(id_: str, _: str = Depends(security.usuario_autenticado)):
    return _db_ou_503(
        db.listar_ordenado, "tabelas_precos",
        ordem="data_referencia", desc=True, empreendimento_id=id_,
    )


@app.post("/empreendimentos/{id_}/tabelas-precos")
async def criar_tabela_precos(
    id_: str,
    arquivo: UploadFile | None = None,
    versao: str = Form(""),
    data_referencia: str = Form(""),
    _: str = Depends(security.usuario_autenticado),
):
    """Cria uma nova versao da tabela de precos.

    Se enviou arquivo: PDF/imagem -> Gemini extrai unidades+condicoes+promocoes;
    CSV/XLS -> mercado_api.ler_planilha + condicoes minimas. Sem arquivo:
    cria registro vazio para preenchimento futuro.
    """
    unidades: list = []
    condicoes: dict = {}
    promocoes: list = []
    raw: dict | None = None

    if arquivo and arquivo.filename:
        conteudo = await _ler_upload(arquivo)
        nome = arquivo.filename
        ext = ("." + nome.lower().rsplit(".", 1)[-1]) if "." in nome else ""
        try:
            if ext in (".pdf", ".png", ".jpg", ".jpeg"):
                ia = gemini.extrair_tabela_precos(conteudo, nome)
                unidades = ia.get("unidades") or []
                promocoes = ia.get("promocoes") or []
                condicoes = {"_padrao_ia": ia.get("padrao", "")}
                raw = ia
            else:
                df = mercado_api.ler_planilha(conteudo, nome)
                resultado = mercado_api.comparativo(
                    df, tipo="Nosso", incorporadora="", produto="",
                    cidade="", bairro="", padrao="",
                )
                # Mapeia DataFrame para lista de dicionarios "unidades"
                unidades = df.to_dict(orient="records") if df is not None else []
                condicoes = mercado_api.montar_condicoes_simples(resultado.get("kpis"))
                raw = {"kpis": resultado.get("kpis"), "linhas": resultado.get("linhas")}
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=502, detail=f"Falha ao processar: {exc}")

    versao_final = versao or datetime.now().strftime("%b/%Y")
    data_ref = data_referencia or datetime.now().date().isoformat()
    registro = _db_ou_503(
        db.inserir,
        "tabelas_precos",
        {
            "empreendimento_id": id_,
            "versao": versao_final,
            "data_referencia": data_ref,
            "unidades": unidades,
            "condicoes": condicoes,
            "promocoes": promocoes,
            "raw_gemini": raw,
        },
    )

    # Sincroniza snapshot de KPIs no empreendimento (mantem benchmark coerente).
    kpis = _montar_kpis_de_unidades(unidades)
    if kpis:
        kpis["kpis_atualizados_em"] = datetime.now(timezone.utc).isoformat()
        kpis_validos = {chave: valor for chave, valor in kpis.items() if valor is not None}
        if kpis_validos:
            _db_ou_503(db.atualizar, "empreendimentos", id_, kpis_validos)

    return {"ok": True, "tabela": registro, "kpis_sincronizados": kpis}


@app.get("/empreendimentos/{id_}/fluxo-comercial")
def fluxo_comercial(
    id_: str,
    tabela_id: str | None = None,
    _: str = Depends(security.usuario_autenticado),
):
    """Comparativo de condicoes a partir da tabela de precos mais recente
    (ou da `tabela_id` especificada).
    """
    tabelas = _db_ou_503(
        db.listar_ordenado, "tabelas_precos",
        ordem="data_referencia", desc=True, empreendimento_id=id_,
    )
    if not tabelas:
        raise HTTPException(status_code=404, detail="Nenhuma tabela de precos cadastrada")
    if tabela_id:
        tabela = next((t for t in tabelas if t["id"] == tabela_id), None)
        if not tabela:
            raise HTTPException(status_code=404, detail="Tabela nao encontrada")
    else:
        tabela = tabelas[0]
    comparativo = _montar_comparativo_fluxo(
        tabela.get("unidades") or [], tabela.get("condicoes") or {},
    )
    return {
        "tabela_id": tabela["id"],
        "versao": tabela.get("versao"),
        "data_referencia": tabela.get("data_referencia"),
        "comparativo": comparativo,
    }


@app.get("/empreendimentos/{id_}/vendas-mensais")
def listar_vendas_mensais(
    id_: str,
    de: str | None = None,
    ate: str | None = None,
    _: str = Depends(security.usuario_autenticado),
):
    """Filtra vendas mensais; de/ate em 'YYYY-MM'."""
    from calendar import monthrange
    gte_iso = ""
    lte_iso = ""
    if de:
        gte_iso = f"{de}-01"
    if ate:
        try:
            y, m = map(int, ate.split("-"))
            ultimo = monthrange(y, m)[1]
            lte_iso = f"{ate}-{ultimo:02d}"
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="ate deve estar em 'YYYY-MM'")
    return _db_ou_503(
        db.listar_ordenado, "vendas_mensais",
        ordem="mes", desc=False,
        intervalo=("mes", gte_iso, lte_iso),
        empreendimento_id=id_,
    )


@app.post("/empreendimentos/{id_}/vendas-mensais")
def upsert_venda_mensal(
    id_: str,
    body: dict = Body(...),
    _: str = Depends(security.usuario_autenticado),
):
    """Upsert por (empreendimento_id, mes). Body: {mes:'YYYY-MM', unidades_vendidas, vgv_mes?, fonte?}."""
    mes = body.get("mes") or ""
    if not mes or len(mes) != 7 or mes[4] != "-":
        raise HTTPException(status_code=400, detail="mes deve estar em 'YYYY-MM'")
    unidades = body.get("unidades_vendidas")
    if unidades is None:
        raise HTTPException(status_code=400, detail="unidades_vendidas obrigatorio")
    registro = _db_ou_503(
        db.upsert,
        "vendas_mensais",
        {
            "empreendimento_id": id_,
            "mes": f"{mes}-01",
            "unidades_vendidas": int(unidades),
            "vgv_mes": body.get("vgv_mes"),
            "fonte": body.get("fonte") or "manual",
        },
        on_conflict="empreendimento_id,mes",
    )
    return {"ok": True, "venda": registro}


@app.post("/gemini/buscar-empreendimento")
def buscar_empreendimento(
    body: dict = Body(...),
    _: str = Depends(security.usuario_autenticado),
):
    """Busca ficha tecnica publica via Gemini + Google Search (com fallback)."""
    nome = (body.get("nome") or "").strip()
    if not nome:
        raise HTTPException(status_code=400, detail="Informe ao menos o nome")
    try:
        return gemini.buscar_dados_empreendimento(
            nome=nome,
            incorporadora=(body.get("incorporadora") or "").strip(),
            cidade=(body.get("cidade") or "").strip(),
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(exc))


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
