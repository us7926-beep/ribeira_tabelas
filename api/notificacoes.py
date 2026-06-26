"""Notificações por email — disparadas pelo cron do Vercel uma vez por dia.

Fluxo:
1. Lista eventos cujo `data_fim` está entre HOJE e HOJE+7d (inclusive).
2. Remove os já notificados no mesmo `data_envio` (tabela
   `notificacoes_enviadas`).
3. Se sobrou ao menos 1, monta email HTML e envia via Resend.
4. Registra cada evento enviado em `notificacoes_enviadas` para evitar
   spam diário sobre a mesma promoção.

Sem segredos no código — leem-se de `config.resend_api_key()` etc.
"""
from datetime import date, timedelta
from html import escape

from . import config, db


def _formatar_data_br(iso: str | None) -> str:
    if not iso:
        return "—"
    try:
        return date.fromisoformat(iso[:10]).strftime("%d/%m/%Y")
    except ValueError:
        return iso


def _dias_ate(data_fim: str | None, hoje: date) -> int | None:
    if not data_fim:
        return None
    try:
        return (date.fromisoformat(data_fim[:10]) - hoje).days
    except ValueError:
        return None


def _cor_urgencia(dias: int | None) -> tuple[str, str]:
    """Devolve (cor_fundo_chip, cor_texto_chip) para a urgência."""
    if dias is None:
        return "#EDF0F6", "#6B7689"
    if dias <= 3:
        return "#FDF2F2", "#B91C1C"
    if dias <= 7:
        return "#FBF3DD", "#8A6A1E"
    return "#E9FBF0", "#157A3D"


def _eventos_vencendo(hoje: date, janela_dias: int = 7) -> list[dict]:
    fim = (hoje + timedelta(days=janela_dias)).isoformat()
    return db.listar_ordenado(
        "eventos_promocionais",
        ordem="data_fim",
        desc=False,
        intervalo=("data_fim", hoje.isoformat(), fim),
    )


def _ja_notificados(eventos_ids: list[str], hoje: date) -> set[str]:
    if not eventos_ids:
        return set()
    consulta = (
        db.cliente()
        .table("notificacoes_enviadas")
        .select("evento_id")
        .eq("data_envio", hoje.isoformat())
        .in_("evento_id", eventos_ids)
    )
    dados = consulta.execute().data or []
    return {linha["evento_id"] for linha in dados}


def _registrar_envios(eventos_ids: list[str], hoje: date, destino: str) -> None:
    if not eventos_ids:
        return
    registros = [
        {"evento_id": eid, "data_envio": hoje.isoformat(), "destino": destino}
        for eid in eventos_ids
    ]
    db.cliente().table("notificacoes_enviadas").insert(registros).execute()


def _emp_e_inc_por_id(eventos: list[dict]) -> tuple[dict[str, dict], dict[str, dict]]:
    ids_emp = list({ev["empreendimento_id"] for ev in eventos if ev.get("empreendimento_id")})
    if not ids_emp:
        return {}, {}
    emps = (
        db.cliente()
        .table("empreendimentos")
        .select("id, nome, incorporadora_id")
        .in_("id", ids_emp)
        .execute()
        .data
        or []
    )
    mapa_emp = {e["id"]: e for e in emps}
    ids_inc = list({e["incorporadora_id"] for e in emps if e.get("incorporadora_id")})
    incs = []
    if ids_inc:
        incs = (
            db.cliente()
            .table("incorporadoras")
            .select("id, nome")
            .in_("id", ids_inc)
            .execute()
            .data
            or []
        )
    mapa_inc = {i["id"]: i for i in incs}
    return mapa_emp, mapa_inc


def montar_html(eventos: list[dict], hoje: date, base_url: str | None = None) -> str:
    """Template HTML inline (compatível com clientes de email pobres em CSS)."""
    mapa_emp, mapa_inc = _emp_e_inc_por_id(eventos)
    base_url = (base_url or "https://ribeira-tabelas-tablm.vercel.app").rstrip("/")
    linhas: list[str] = []
    for ev in eventos:
        emp = mapa_emp.get(ev.get("empreendimento_id") or "", {})
        inc = mapa_inc.get(emp.get("incorporadora_id") or "", {})
        dias = _dias_ate(ev.get("data_fim"), hoje)
        if dias is None:
            rotulo = "Sem prazo"
        elif dias == 0:
            rotulo = "Expira HOJE"
        elif dias == 1:
            rotulo = "Expira amanhã"
        else:
            rotulo = f"Expira em {dias} dia(s)"
        bg, fg = _cor_urgencia(dias)
        descricao = escape(ev.get("descricao") or ev.get("condicoes_comerciais") or "Promoção sem descrição")
        link = f"{base_url}/empreendimentos/{emp['id']}" if emp.get("id") else f"{base_url}/promocoes"
        linha = f"""
        <tr>
          <td style="padding:14px 16px;border-bottom:1px solid #E5E9F2;">
            <a href="{escape(link)}" style="color:#14203A;text-decoration:none;font-weight:700;font-size:15px;">
              {escape(emp.get('nome') or 'Empreendimento')}
            </a>
            {f'<span style="color:#6B7689;font-size:12.5px;"> · {escape(inc.get("nome") or "")}</span>' if inc.get('nome') else ''}
            <div style="color:#2C3850;font-size:13.5px;margin-top:6px;line-height:1.5;">{descricao}</div>
            <div style="color:#97A2B5;font-size:12px;margin-top:6px;font-variant-numeric:tabular-nums;">
              {_formatar_data_br(ev.get('data_inicio'))} → {_formatar_data_br(ev.get('data_fim'))}
            </div>
          </td>
          <td style="padding:14px 16px;border-bottom:1px solid #E5E9F2;text-align:right;vertical-align:top;white-space:nowrap;">
            <span style="display:inline-block;background:{bg};color:{fg};padding:4px 10px;border-radius:20px;font-size:12px;font-weight:700;">
              {escape(rotulo)}
            </span>
          </td>
        </tr>"""
        linhas.append(linha)

    return f"""<!doctype html>
<html lang="pt-BR"><body style="margin:0;padding:0;background:#F4F6FB;font-family:'Hanken Grotesk','Segoe UI',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E5E9F2;">
      <tr>
        <td style="padding:24px 28px;background:linear-gradient(180deg,#1F40BC 0%,#16308F 100%);color:#fff;">
          <div style="font-size:11px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;color:rgba(255,255,255,0.75);">TabLM · Promoções</div>
          <div style="font-size:22px;font-weight:800;margin-top:6px;">{len(eventos)} promoção(ões) vencendo nos próximos 7 dias</div>
          <div style="font-size:13px;color:rgba(255,255,255,0.85);margin-top:4px;">{hoje.strftime('%d/%m/%Y')}</div>
        </td>
      </tr>
      <tr><td>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          {''.join(linhas)}
        </table>
      </td></tr>
      <tr><td style="padding:18px 28px;text-align:center;background:#F6F8FC;">
        <a href="{escape(base_url)}/promocoes" style="color:#2347C5;font-weight:700;font-size:13px;text-decoration:none;">
          Abrir TabLM →
        </a>
      </td></tr>
    </table>
    <div style="color:#97A2B5;font-size:11px;margin-top:16px;">Ribeira Empreendimentos · TabLM</div>
  </td></tr>
</table>
</body></html>"""


def disparar_promocoes_vencendo(hoje: date | None = None) -> dict:
    """Pipeline principal — chamado pelo endpoint /notificacoes/disparar.

    Retorna `{enviado: bool, total_no_horizonte: int, novos: int,
    destino: str, motivo?: str}` com diagnóstico para o cron logar.
    """
    hoje = hoje or date.today()
    destino = config.notificacoes_destino()
    if not destino:
        return {"enviado": False, "motivo": "NOTIFICACOES_EMAIL_DESTINO vazio"}
    api_key = config.resend_api_key()
    if not api_key:
        return {"enviado": False, "motivo": "RESEND_API_KEY vazio"}

    eventos = _eventos_vencendo(hoje)
    total = len(eventos)
    if not eventos:
        return {"enviado": False, "total_no_horizonte": 0, "novos": 0, "destino": destino,
                "motivo": "nenhuma promoção vencendo"}

    ids = [ev["id"] for ev in eventos if ev.get("id")]
    ja = _ja_notificados(ids, hoje)
    pendentes = [ev for ev in eventos if ev.get("id") and ev["id"] not in ja]
    if not pendentes:
        return {"enviado": False, "total_no_horizonte": total, "novos": 0, "destino": destino,
                "motivo": "todas já notificadas hoje"}

    import resend  # import local — só importa se a env está completa

    resend.api_key = api_key
    html = montar_html(pendentes, hoje)
    assunto = f"TabLM · {len(pendentes)} promoção(ões) vencendo nos próximos 7 dias"
    resend.Emails.send(
        {
            "from": config.notificacoes_remetente(),
            "to": [destino],
            "subject": assunto,
            "html": html,
        }
    )
    _registrar_envios([ev["id"] for ev in pendentes], hoje, destino)
    return {"enviado": True, "total_no_horizonte": total, "novos": len(pendentes),
            "destino": destino}
