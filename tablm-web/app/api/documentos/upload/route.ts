import { NextResponse } from "next/server";

import { API_URL } from "@/lib/api";
import { getToken } from "@/lib/auth";

/** Recebe o upload (FormData com empreendimento_id, tipo, arquivo) e repassa ao backend. */
export async function POST(req: Request) {
  const form = await req.formData();
  const empId = String(form.get("empreendimento_id") ?? "");
  if (!empId) {
    return NextResponse.json({ detail: "empreendimento_id ausente" }, { status: 400 });
  }
  const out = new FormData();
  const arquivo = form.get("arquivo");
  if (arquivo) out.append("arquivo", arquivo);
  out.append("tipo", String(form.get("tipo") ?? "outro"));

  const token = await getToken();
  const resposta = await fetch(`${API_URL}/empreendimentos/${empId}/documentos`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: out,
  });
  const dados = await resposta.json().catch(() => ({ detail: "Resposta inválida do backend" }));
  return NextResponse.json(dados, { status: resposta.status });
}
