"""Acesso ao Supabase (Postgres) no backend, lendo env vars. Independe do Streamlit."""
from functools import lru_cache


@lru_cache(maxsize=1)
def cliente():
    from supabase import create_client

    from . import config

    if not (config.supabase_url() and config.supabase_key()):
        raise RuntimeError("Supabase não configurado (SUPABASE_URL/SUPABASE_KEY).")
    return create_client(config.supabase_url(), config.supabase_key())


def listar(tabela: str, **filtros) -> list[dict]:
    consulta = cliente().table(tabela).select("*")
    for coluna, valor in filtros.items():
        consulta = consulta.eq(coluna, valor)
    return consulta.order("criado_em", desc=True).execute().data or []


def listar_ordenado(
    tabela: str,
    *,
    ordem: str = "criado_em",
    desc: bool = True,
    intervalo: tuple[str, str, str] | None = None,
    **filtros,
) -> list[dict]:
    """Versão de listar() com coluna de ordenação customizável e filtro by range.

    intervalo: tupla (coluna, gte_iso, lte_iso). Quando preenchido, aplica
    `.gte(coluna, gte_iso).lte(coluna, lte_iso)`. Use string vazia em algum
    extremo para omitir aquele lado.
    """
    consulta = cliente().table(tabela).select("*")
    for coluna, valor in filtros.items():
        consulta = consulta.eq(coluna, valor)
    if intervalo:
        coluna, gte_iso, lte_iso = intervalo
        if gte_iso:
            consulta = consulta.gte(coluna, gte_iso)
        if lte_iso:
            consulta = consulta.lte(coluna, lte_iso)
    return consulta.order(ordem, desc=desc).execute().data or []


def upsert(tabela: str, registro: dict, on_conflict: str) -> dict:
    """Upsert com restrição de conflito (ex.: 'empreendimento_id,mes')."""
    dados = (
        cliente()
        .table(tabela)
        .upsert(registro, on_conflict=on_conflict)
        .execute()
        .data
    )
    return dados[0] if dados else {}


def obter(tabela: str, id_: str) -> dict | None:
    dados = cliente().table(tabela).select("*").eq("id", id_).limit(1).execute().data
    return dados[0] if dados else None


def inserir(tabela: str, registro: dict) -> dict:
    dados = cliente().table(tabela).insert(registro).execute().data
    return dados[0] if dados else {}


def atualizar(tabela: str, id_: str, campos: dict) -> dict:
    dados = cliente().table(tabela).update(campos).eq("id", id_).execute().data
    return dados[0] if dados else {}


def deletar(tabela: str, id_: str) -> None:
    cliente().table(tabela).delete().eq("id", id_).execute()


# --------------------------------------------------------------------------- #
# Storage (bucket "documentos")
# --------------------------------------------------------------------------- #
BUCKET = "documentos"


def upload_storage(caminho: str, conteudo: bytes, content_type: str) -> None:
    cliente().storage.from_(BUCKET).upload(
        caminho, conteudo, {"content-type": content_type, "upsert": "true"}
    )


def url_assinada(caminho: str, segundos: int = 3600) -> str:
    resposta = cliente().storage.from_(BUCKET).create_signed_url(caminho, segundos)
    url = resposta.get("signedURL") or resposta.get("signedUrl") or ""
    if not url:
        raise RuntimeError("Supabase não retornou URL assinada para o documento.")
    return url


def remover_storage(caminho: str) -> None:
    cliente().storage.from_(BUCKET).remove([caminho])
