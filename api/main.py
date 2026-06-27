"""App FastAPI do TabLM — expõe a lógica Python via REST para o frontend Next.js.

Fase 1: auth (JWT), análise/ficha via Gemini e CRUD da hierarquia
(incorporadoras → empreendimentos) + eventos. Upload de arquivos para o
Supabase Storage e migração das telas de mercado/vendas/INCC vêm nas próximas
fases.
"""
import uuid
from datetime import datetime, timezone
from pathlib import PurePosixPath

from fastapi import Body, Depends, FastAPI, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import config, db, gemini, incc_api, mercado_api, notificacoes, security, vendas_api

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


def _montar_comparativo_fluxo(
    unidades: list[dict],
    condicoes: dict,
    distribuicao_real: dict | None = None,
) -> dict:
    """Monta comparativo entre tipos de pagamento.

    Quando `distribuicao_real` vier preenchido (>= 1 modalidade com
    unidades_vendidas > 0), substitui o placeholder uniforme: cria por_tipo a
    partir dessas modalidades, pct_total = unidades_mod / total * 100 e
    ticket_medio = vgv_mod / unidades_mod quando ha vgv. Fonte = "real".

    Sem distribuicao_real, mantem comportamento legado (chaves fixas de
    `_TIPOS_FLUXO` + pct uniforme). Fonte = "estimado".
    """
    condicoes = condicoes or {}
    base = _montar_kpis_de_unidades(unidades)
    ticket = base.get("ticket_medio") or 0
    por_tipo: dict[str, dict] = {}

    # ---- Detalhes complementares por chave canonica de condicoes ---- #
    avista_cond = (condicoes.get("avista") or {})
    desconto = _num(avista_cond.get("desconto_pct")) or 0
    ticket_avista_calc = round(ticket * (1 - desconto / 100), 2)

    fin_cond = (condicoes.get("financiamento") or {})
    prazo_fin = int(_num(fin_cond.get("prazo_meses")) or 360)
    parc_fin_calc = round(ticket / prazo_fin, 2) if prazo_fin else None

    entrada_cond = (condicoes.get("entrada") or {})
    parc_entrada = int(_num(entrada_cond.get("parcelas_obra")) or 0)
    val_parc_entrada = _num(entrada_cond.get("valor_parcela_medio"))

    def _detalhes_para(nome: str) -> tuple[float | None, int | None]:
        """Devolve (valor_medio_parcela, n_parcelas) baseado em casamento por
        chave canonica de condicoes (case-insensitive, contem)."""
        baixo = (nome or "").lower()
        if "vista" in baixo:
            return None, None
        if "financ" in baixo:
            return parc_fin_calc, prazo_fin
        if "entrada" in baixo or "mensa" in baixo:
            return (
                round(val_parc_entrada, 2) if val_parc_entrada else None,
                parc_entrada or None,
            )
        return None, None

    # ---- Caminho 1: distribuicao real preenchida ---- #
    distribuicao_real = distribuicao_real or {}
    total_real = sum(
        int(d.get("unidades") or 0) for d in distribuicao_real.values()
    )

    if total_real > 0:
        for modalidade, dados in distribuicao_real.items():
            n = int(dados.get("unidades") or 0)
            if n <= 0:
                continue
            vgv = _num(dados.get("vgv")) or 0
            ticket_mod = round(vgv / n, 2) if n and vgv else None
            if ticket_mod is None:
                # Sem vgv informado: aproxima pelo ticket calculado da condicao.
                baixo = (modalidade or "").lower()
                ticket_mod = (
                    ticket_avista_calc if "vista" in baixo else round(ticket, 2)
                )
            val_parc, n_parc = _detalhes_para(modalidade)
            por_tipo[modalidade] = {
                "ticket_medio": ticket_mod,
                "pct_total": round(n / total_real * 100, 1),
                "valor_medio_parcela": val_parc,
                "n_parcelas": n_parc,
                "unidades": n,
            }
        fonte = "real"
    else:
        # ---- Caminho 2 (legado): chaves fixas + pct uniforme ---- #
        por_tipo["A vista"] = {
            "ticket_medio": ticket_avista_calc,
            "pct_total": 0,
            "valor_medio_parcela": None,
            "n_parcelas": None,
        }
        if fin_cond or ticket:
            por_tipo["Financiamento"] = {
                "ticket_medio": round(ticket, 2),
                "pct_total": 0,
                "valor_medio_parcela": parc_fin_calc,
                "n_parcelas": prazo_fin,
            }
        if entrada_cond:
            por_tipo["Entrada + Mensais"] = {
                "ticket_medio": round(ticket, 2),
                "pct_total": 0,
                "valor_medio_parcela": (
                    round(val_parc_entrada, 2) if val_parc_entrada else None
                ),
                "n_parcelas": parc_entrada or None,
            }
        for chave_lista, rotulo in [
            ("mensais", "Mensais"), ("anuais", "Anuais"), ("outros", "Outros"),
        ]:
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
        fonte = "estimado"

    # ---- Diferencas pairwise ---- #
    tipos = list(por_tipo.keys())
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

    return {
        "tipos": tipos,
        "por_tipo": por_tipo,
        "diferencas": diferencas,
        "fonte": fonte,
        "total_vendas": total_real,
    }


def _busca_distribuicao_real(emp_id: str, mes_iso: str) -> dict:
    """Carrega `vendas_por_modalidade` para um par (empreendimento, mes) e
    devolve {modalidade: {unidades, vgv}}. Vazio quando nao ha registro.
    """
    try:
        linhas = db.listar(
            "vendas_por_modalidade", empreendimento_id=emp_id, mes=mes_iso,
        )
    except Exception:  # noqa: BLE001
        return {}
    out: dict[str, dict] = {}
    for linha in linhas or []:
        nome = (linha.get("modalidade") or "").strip()
        if not nome:
            continue
        out[nome] = {
            "unidades": int(linha.get("unidades_vendidas") or 0),
            "vgv": _num(linha.get("vgv")),
        }
    return out


def _primeiro_dia_do_mes(mes_yyyymm: str | None) -> str:
    """Converte 'YYYY-MM' em 'YYYY-MM-01'. Default = mes corrente UTC."""
    if not mes_yyyymm:
        agora = datetime.now(timezone.utc)
        return f"{agora.year:04d}-{agora.month:02d}-01"
    s = mes_yyyymm.strip()
    if len(s) >= 7 and s[4] == "-":
        return f"{s[:7]}-01"
    raise HTTPException(status_code=400, detail="mes deve estar em 'YYYY-MM'")


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


class IncorporadoraPatch(BaseModel):
    nome: str | None = None


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


class EventoPatch(BaseModel):
    """Mesmos campos de EventoIn, todos opcionais — para PATCH parcial."""
    empreendimento_id: str | None = None
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


# --------------------------------------------------------------------------- #
# Hierarquia: incorporadoras -> empreendimentos
# --------------------------------------------------------------------------- #
@app.get("/incorporadoras")
def listar_incorporadoras(_: str = Depends(security.usuario_autenticado)):
    return _db_ou_503(db.listar, "incorporadoras")


@app.post("/incorporadoras")
def criar_incorporadora(dados: IncorporadoraIn, _: str = Depends(security.usuario_autenticado)):
    return _db_ou_503(db.inserir, "incorporadoras", dados.model_dump())


@app.patch("/incorporadoras/{id_}")
def atualizar_incorporadora(
    id_: str,
    dados: IncorporadoraPatch,
    _: str = Depends(security.usuario_autenticado),
):
    """Atualiza campos basicos da incorporadora (hoje só `nome`)."""
    campos = dados.model_dump(exclude_none=True)
    # Aceita string vazia como "limpar" nao — mantem o original.
    campos = {k: v for k, v in campos.items() if isinstance(v, str) and v.strip()}
    if not campos:
        raise HTTPException(status_code=400, detail="Nada para atualizar")
    atual = _db_ou_503(db.obter, "incorporadoras", id_)
    if not atual:
        raise HTTPException(status_code=404, detail="Incorporadora não encontrada")
    return _db_ou_503(db.atualizar, "incorporadoras", id_, campos)


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


# Endpoints com caminho fixo precisam vir ANTES de /empreendimentos/{id_} para o
# matcher do FastAPI nao confundir "importar-book" com um id.
@app.post("/empreendimentos/importar-book")
async def importar_book_para_carteira(
    arquivo: UploadFile,
    incorporadora_id: str = Form(""),
    incorporadora_nome: str = Form(""),
    extrair_tabela: bool = Form(False),
    versao: str = Form(""),
    data_referencia: str = Form(""),
    _: str = Depends(security.usuario_autenticado),
):
    """Cria um empreendimento (e a incorporadora, se nova) a partir de um book.

    Resolucao de incorporadora:
    - se `incorporadora_id` fornecido: usa direto.
    - senao: usa `incorporadora_nome` (parametro do form) ou o `incorporadora`
      detectado pela IA; busca por nome (lowercase) em `incorporadoras`. Se
      nao existir, cria.
    A ficha tecnica extraida e aplicada ao empreendimento. Se `extrair_tabela`,
    insere em `tabelas_precos` e sincroniza snapshot KPIs.
    """
    conteudo = await _ler_upload(arquivo)
    nome_original = arquivo.filename or "book.pdf"

    # 1) IA primeiro (sem tocar Storage/DB ate dar certo).
    try:
        ficha = gemini.extrair_ficha_dossie(conteudo, nome_original)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Falha na extracao de ficha: {exc}")

    ia_tabela: dict | None = None
    if extrair_tabela:
        try:
            ia_tabela = gemini.extrair_tabela_precos(conteudo, nome_original)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=502, detail=f"Falha na extracao de tabela: {exc}")

    # 2) Resolve incorporadora.
    inc_id = (incorporadora_id or "").strip()
    if not inc_id:
        nome_inc = (incorporadora_nome or "").strip()
        if not nome_inc and ia_tabela:
            nome_inc = (ia_tabela.get("incorporadora") or "").strip()
        if not nome_inc:
            raise HTTPException(
                status_code=400,
                detail="Selecione uma incorporadora ou informe o nome de uma nova "
                       "(a IA tambem nao detectou).",
            )
        existentes = _db_ou_503(db.listar, "incorporadoras")
        nome_lower = nome_inc.lower()
        achada = next((i for i in existentes if (i.get("nome") or "").lower() == nome_lower), None)
        if achada:
            inc_id = achada["id"]
        else:
            try:
                inc_criada = _db_ou_503(db.inserir, "incorporadoras", {"nome": nome_inc})
                inc_id = inc_criada.get("id", "")
            except Exception as exc:  # noqa: BLE001
                raise HTTPException(status_code=400, detail=f"Falha ao criar incorporadora: {exc}")

    if not inc_id:
        raise HTTPException(status_code=400, detail="Nao consegui resolver a incorporadora.")

    # 3) Cria empreendimento usando a ficha extraida (com nome obrigatorio).
    nome_emp = (ficha.get("nome") or "").strip()
    if not nome_emp and ia_tabela:
        nome_emp = (ia_tabela.get("nome_empreendimento") or "").strip()
    if not nome_emp:
        nome_emp = PurePosixPath(nome_original).stem or "Empreendimento"

    base_emp = {"incorporadora_id": inc_id, "nome": nome_emp}
    # Campos de cadastro inicial (compatibilidade com EmpreendimentoIn): bairro,
    # cidade, padrao. Demais campos da ficha entram via PATCH no proximo passo.
    for chave in ("bairro", "cidade", "padrao"):
        valor = ficha.get(chave)
        if valor:
            base_emp[chave] = valor
    try:
        empreendimento = _db_ou_503(db.inserir, "empreendimentos", base_emp)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Falha ao criar empreendimento: {exc}")
    emp_id = empreendimento.get("id")
    if not emp_id:
        raise HTTPException(status_code=500, detail="Empreendimento criado sem id")

    # 4) Aplica restante da ficha (vagas, distancia, datas, CNPJ, RI, etc).
    campos_ficha = {
        chave: valor for chave, valor in ficha.items()
        if chave in _FICHA_CAMPOS and chave not in ("nome", "bairro", "cidade", "padrao")
        and valor not in (None, "", [])
    }
    if campos_ficha:
        try:
            empreendimento = _db_ou_503(db.atualizar, "empreendimentos", emp_id, campos_ficha)
        except Exception:  # noqa: BLE001
            pass  # ficha parcial e' aceitavel; nao falha a importacao por isso

    # 5) Salva documento (uma vez).
    nome_doc = PurePosixPath(nome_original).name or "book.pdf"
    caminho = f"{emp_id}/{uuid.uuid4().hex}-{nome_doc}"
    try:
        _db_ou_503(
            db.upload_storage, caminho, conteudo,
            arquivo.content_type or "application/octet-stream",
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Falha no upload do book: {exc}")
    try:
        documento = _db_ou_503(
            db.inserir, "documentos",
            {
                "empreendimento_id": emp_id,
                "nome": nome_doc,
                "tipo": "book_empreendimento",
                "storage_path": caminho,
            },
        )
    except Exception as exc:
        try:
            db.remover_storage(caminho)
        except Exception:  # noqa: BLE001
            pass
        raise HTTPException(status_code=400, detail=f"Falha ao registrar documento: {exc}")

    # 6) Tabela de precos opcional + sincronizacao de snapshot.
    tabela: dict | None = None
    kpis_sincronizados: dict = {}
    if ia_tabela:
        unidades = ia_tabela.get("unidades") or []
        promocoes = ia_tabela.get("promocoes") or []
        condicoes = {"_padrao_ia": ia_tabela.get("padrao", "")}
        versao_final = versao or datetime.now().strftime("%b/%Y")
        data_ref = data_referencia or datetime.now().date().isoformat()
        tabela = _db_ou_503(
            db.inserir, "tabelas_precos",
            {
                "empreendimento_id": emp_id,
                "versao": versao_final,
                "data_referencia": data_ref,
                "unidades": unidades,
                "condicoes": condicoes,
                "promocoes": promocoes,
                "raw_gemini": ia_tabela,
            },
        )
        kpis = _montar_kpis_de_unidades(unidades)
        if kpis:
            kpis["kpis_atualizados_em"] = datetime.now(timezone.utc).isoformat()
            kpis_validos = {chave: valor for chave, valor in kpis.items() if valor is not None}
            if kpis_validos:
                empreendimento = _db_ou_503(db.atualizar, "empreendimentos", emp_id, kpis_validos)
                kpis_sincronizados = kpis_validos

    return {
        "ok": True,
        "empreendimento": empreendimento,
        "incorporadora_id": inc_id,
        "documento": documento,
        "ficha": ficha,
        "tabela": tabela,
        "kpis_sincronizados": kpis_sincronizados,
    }


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


@app.post("/empreendimentos/{id_}/ficha-dossie")
async def extrair_ficha_dossie(
    id_: str,
    arquivo: UploadFile,
    _: str = Depends(security.usuario_autenticado),
):
    """Le um book/memorial via Gemini e devolve campos da ficha + salva o
    arquivo no Storage com tipo='book_empreendimento'. Atomico: se a IA falhar,
    nao salva documento; se o registro do documento falhar, rollback do upload.
    """
    conteudo = await _ler_upload(arquivo)
    nome_original = arquivo.filename or "book.pdf"

    # 1) IA primeiro: se falhar, retornamos erro sem criar lixo.
    try:
        ficha = gemini.extrair_ficha_dossie(conteudo, nome_original)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(exc))

    # 2) Persiste como documento (Storage + tabela documentos).
    nome = PurePosixPath(nome_original).name or "book.pdf"
    caminho = f"{id_}/{uuid.uuid4().hex}-{nome}"
    try:
        _db_ou_503(
            db.upload_storage, caminho, conteudo,
            arquivo.content_type or "application/octet-stream",
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Falha no upload: {exc}")
    try:
        documento = _db_ou_503(
            db.inserir,
            "documentos",
            {
                "empreendimento_id": id_,
                "nome": nome,
                "tipo": "book_empreendimento",
                "storage_path": caminho,
            },
        )
    except Exception as exc:
        # Rollback do upload pra nao deixar arquivo orfao no bucket.
        try:
            db.remover_storage(caminho)
        except Exception:  # noqa: BLE001
            pass
        raise HTTPException(status_code=400, detail=f"Falha ao registrar documento: {exc}")

    return {"ok": True, "ficha": ficha, "documento": documento}


@app.post("/empreendimentos/{id_}/importar-book")
async def importar_book(
    id_: str,
    arquivo: UploadFile,
    extrair_ficha: bool = Form(True),
    extrair_tabela: bool = Form(False),
    versao: str = Form(""),
    data_referencia: str = Form(""),
    _: str = Depends(security.usuario_autenticado),
):
    """Endpoint unificado: sobe o book uma unica vez, IA extrai ficha e/ou
    tabela de precos conforme as flags, salva como documento (sempre) e cria
    nova versao em tabelas_precos quando aplicavel. Sincroniza snapshot KPIs."""
    if not (extrair_ficha or extrair_tabela):
        raise HTTPException(
            status_code=400, detail="Marque pelo menos uma extracao (ficha ou tabela)."
        )

    conteudo = await _ler_upload(arquivo)
    nome_original = arquivo.filename or "book.pdf"

    # 1) Roda IA primeiro — se ambas as extracoes pedidas falharem, nao salva nada.
    ficha: dict | None = None
    ia_tabela: dict | None = None
    if extrair_ficha:
        try:
            ficha = gemini.extrair_ficha_dossie(conteudo, nome_original)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=502, detail=f"Falha na extracao de ficha: {exc}")
    if extrair_tabela:
        try:
            ia_tabela = gemini.extrair_tabela_precos(conteudo, nome_original)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=502, detail=f"Falha na extracao de tabela: {exc}")

    # 2) Storage + registro do documento (uma vez so).
    nome = PurePosixPath(nome_original).name or "book.pdf"
    caminho = f"{id_}/{uuid.uuid4().hex}-{nome}"
    try:
        _db_ou_503(
            db.upload_storage, caminho, conteudo,
            arquivo.content_type or "application/octet-stream",
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Falha no upload: {exc}")
    try:
        documento = _db_ou_503(
            db.inserir,
            "documentos",
            {
                "empreendimento_id": id_,
                "nome": nome,
                "tipo": "book_empreendimento",
                "storage_path": caminho,
            },
        )
    except Exception as exc:
        try:
            db.remover_storage(caminho)
        except Exception:  # noqa: BLE001
            pass
        raise HTTPException(status_code=400, detail=f"Falha ao registrar documento: {exc}")

    # 3) Tabela de precos: insere nova versao se IA encontrou unidades.
    tabela: dict | None = None
    kpis_sincronizados: dict = {}
    if ia_tabela:
        unidades = ia_tabela.get("unidades") or []
        promocoes = ia_tabela.get("promocoes") or []
        condicoes = {"_padrao_ia": ia_tabela.get("padrao", "")}
        versao_final = versao or datetime.now().strftime("%b/%Y")
        data_ref = data_referencia or datetime.now().date().isoformat()
        tabela = _db_ou_503(
            db.inserir, "tabelas_precos",
            {
                "empreendimento_id": id_,
                "versao": versao_final,
                "data_referencia": data_ref,
                "unidades": unidades,
                "condicoes": condicoes,
                "promocoes": promocoes,
                "raw_gemini": ia_tabela,
            },
        )
        kpis = _montar_kpis_de_unidades(unidades)
        if kpis:
            kpis["kpis_atualizados_em"] = datetime.now(timezone.utc).isoformat()
            kpis_validos = {chave: valor for chave, valor in kpis.items() if valor is not None}
            if kpis_validos:
                _db_ou_503(db.atualizar, "empreendimentos", id_, kpis_validos)
                kpis_sincronizados = kpis_validos

    return {
        "ok": True,
        "documento": documento,
        "ficha": ficha,
        "tabela": tabela,
        "kpis_sincronizados": kpis_sincronizados,
    }


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
                # Normaliza para o schema canônico (preco_total, area_m2, ...)
                # que o frontend e o sparkline trio em AbaTabela esperam.
                # Antes usavamos df.to_dict cru, o que mantinha nomes do CSV
                # (ex.: "valor") e quebrava kpisDaVersao.
                unidades = mercado_api.normalizar_unidades(df)
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
    mes: str | None = None,
    _: str = Depends(security.usuario_autenticado),
):
    """Comparativo de condicoes a partir da tabela de precos mais recente
    (ou da `tabela_id` especificada). Carrega distribuicao real de
    vendas_por_modalidade para o `mes` (default = mes corrente UTC) — quando
    houver, calcula pct_total e ticket_medio reais por modalidade.
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

    mes_iso = _primeiro_dia_do_mes(mes)
    distribuicao = _busca_distribuicao_real(id_, mes_iso)
    comparativo = _montar_comparativo_fluxo(
        tabela.get("unidades") or [], tabela.get("condicoes") or {},
        distribuicao_real=distribuicao,
    )
    return {
        "tabela_id": tabela["id"],
        "versao": tabela.get("versao"),
        "data_referencia": tabela.get("data_referencia"),
        "mes": mes_iso[:7],
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


# --------------------------------------------------------------------------- #
# Distribuicao por modalidade de pagamento (alimenta /fluxo-comercial "Real")
# --------------------------------------------------------------------------- #
_LABEL_MODALIDADE = {
    "avista": "À vista",
    "entrada": "Entrada + Mensais",
    "financiamento": "Financiamento",
    "mensais": "Mensais",
    "anuais": "Anuais",
    "outros": "Outros",
}


@app.get("/empreendimentos/{id_}/vendas-mensais/distribuicao")
def listar_distribuicao(
    id_: str,
    de: str | None = None,
    ate: str | None = None,
    _: str = Depends(security.usuario_autenticado),
):
    """Lista vendas_por_modalidade, opcionalmente filtrado por intervalo
    de meses 'YYYY-MM'. Ordenado por mes DESC, modalidade ASC.
    """
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
        db.listar_ordenado, "vendas_por_modalidade",
        ordem="mes", desc=True, empreendimento_id=id_,
        intervalo_coluna="mes", intervalo_de=gte_iso, intervalo_ate=lte_iso,
    )


@app.post("/empreendimentos/{id_}/vendas-mensais/distribuicao")
def gravar_distribuicao(
    id_: str,
    body: dict = Body(...),
    _: str = Depends(security.usuario_autenticado),
):
    """Substitui a distribuicao do mes (delete + insert). Body:
    {mes:'YYYY-MM', linhas:[{modalidade, unidades_vendidas, vgv}, ...]}.
    Linhas com unidades_vendidas <= 0 sao ignoradas (limpa modalidades zeradas).
    """
    mes = (body.get("mes") or "").strip()
    if not mes or len(mes) != 7 or mes[4] != "-":
        raise HTTPException(status_code=400, detail="mes deve estar em 'YYYY-MM'")
    mes_iso = f"{mes}-01"
    linhas = body.get("linhas") or []
    if not isinstance(linhas, list):
        raise HTTPException(status_code=400, detail="linhas deve ser uma lista")

    # 1) Apaga o que ja existir desse par (emp, mes)
    try:
        existentes = db.listar("vendas_por_modalidade", empreendimento_id=id_, mes=mes_iso)
        for reg in existentes or []:
            db.deletar("vendas_por_modalidade", reg["id"])
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Falha ao limpar distribuicao anterior: {exc}")

    # 2) Insere novas linhas (so as com unidades > 0)
    salvos: list[dict] = []
    for linha in linhas:
        modalidade = (linha.get("modalidade") or "").strip()
        n = int(linha.get("unidades_vendidas") or 0)
        if not modalidade or n <= 0:
            continue
        vgv_raw = linha.get("vgv")
        registro = _db_ou_503(
            db.inserir, "vendas_por_modalidade",
            {
                "empreendimento_id": id_,
                "mes": mes_iso,
                "modalidade": modalidade,
                "unidades_vendidas": n,
                "vgv": _num(vgv_raw),
            },
        )
        salvos.append(registro)

    return {"ok": True, "mes": mes, "linhas": salvos}


@app.get("/empreendimentos/{id_}/vendas-mensais/modalidades-sugeridas")
def modalidades_sugeridas(
    id_: str,
    _: str = Depends(security.usuario_autenticado),
):
    """Devolve sugestoes a partir da ultima tabela de precos (chaves canonicas
    de condicoes) + modalidades ja cadastradas no historico do empreendimento.
    Cada item: {chave, label, fonte: 'condicoes' | 'historico'}.
    """
    out: list[dict] = []
    seen: set[str] = set()

    tabelas = _db_ou_503(
        db.listar_ordenado, "tabelas_precos",
        ordem="data_referencia", desc=True, empreendimento_id=id_,
    ) or []
    if tabelas:
        condicoes = tabelas[0].get("condicoes") or {}
        for chave in condicoes.keys():
            if chave.startswith("_"):
                continue
            label = _LABEL_MODALIDADE.get(chave, str(chave).capitalize())
            if label.lower() in seen:
                continue
            seen.add(label.lower())
            out.append({"chave": label, "label": label, "fonte": "condicoes"})

    historico = _db_ou_503(
        db.listar, "vendas_por_modalidade", empreendimento_id=id_,
    ) or []
    for reg in historico:
        nome = (reg.get("modalidade") or "").strip()
        if not nome or nome.lower() in seen:
            continue
        seen.add(nome.lower())
        out.append({"chave": nome, "label": nome, "fonte": "historico"})

    return out


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
def listar_eventos(
    ativos: bool = False,
    _: str = Depends(security.usuario_autenticado),
):
    """Lista eventos promocionais. Quando ativos=True, retorna apenas os que
    ainda nao expiraram (data_fim >= hoje UTC) E ja comecaram (data_inicio
    <= hoje OU data_inicio nulo)."""
    todos = _db_ou_503(db.listar, "eventos_promocionais") or []
    if not ativos:
        return todos
    hoje = datetime.now(timezone.utc).date().isoformat()
    return [
        ev for ev in todos
        if (ev.get("data_fim") or "9999-12-31") >= hoje
        and (ev.get("data_inicio") or "0000-01-01") <= hoje
    ]


@app.post("/benchmark/eventos")
def criar_evento(dados: EventoIn, _: str = Depends(security.usuario_autenticado)):
    return _db_ou_503(db.inserir, "eventos_promocionais", dados.model_dump(exclude_none=True))


@app.patch("/benchmark/eventos/{id_}")
def atualizar_evento(
    id_: str,
    dados: EventoPatch,
    _: str = Depends(security.usuario_autenticado),
):
    campos = dados.model_dump(exclude_none=True)
    if not campos:
        raise HTTPException(status_code=400, detail="Nada para atualizar")
    atual = _db_ou_503(db.obter, "eventos_promocionais", id_)
    if not atual:
        raise HTTPException(status_code=404, detail="Evento não encontrado")
    return _db_ou_503(db.atualizar, "eventos_promocionais", id_, campos)


@app.delete("/benchmark/eventos/{id_}")
def deletar_evento(id_: str, _: str = Depends(security.usuario_autenticado)):
    atual = _db_ou_503(db.obter, "eventos_promocionais", id_)
    if not atual:
        raise HTTPException(status_code=404, detail="Evento não encontrado")
    _db_ou_503(db.deletar, "eventos_promocionais", id_)
    return {"ok": True}


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


# --------------------------------------------------------------------------- #
# Notificações por email (cron diário do Vercel)
# --------------------------------------------------------------------------- #
def _cron_autorizado(authorization: str | None = Header(default=None)) -> None:
    """Valida `Authorization: Bearer ${CRON_SECRET}` enviado pelo cron do Vercel.
    Sem CRON_SECRET configurado, recusa tudo (não dispara em dev por acidente)."""
    esperado = config.cron_secret()
    if not esperado:
        raise HTTPException(status_code=503, detail="CRON_SECRET não configurado")
    if authorization != f"Bearer {esperado}":
        raise HTTPException(status_code=401, detail="Cron não autorizado")


@app.post("/notificacoes/disparar-promocoes-vencendo")
def disparar_promocoes_vencendo(_: None = Depends(_cron_autorizado)):
    """Envia 1 email listando as promoções com data_fim entre hoje e hoje+7d
    para `NOTIFICACOES_EMAIL_DESTINO`, deduplicando o que já foi enviado hoje.
    Idempotente no mesmo dia — pode ser chamado várias vezes sem duplicar."""
    try:
        return notificacoes.disparar_promocoes_vencendo()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Falha no envio: {exc}")
