import { NextResponse } from "next/server";

import { API_URL } from "@/lib/api";
import { getToken } from "@/lib/auth";

/** Proxy do endpoint unificado: roda IA para ficha e/ou tabela com 1 upload. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const form = await req.formData();
  const token = await getToken();
  const resposta = await fetch(`${API_URL}/empreendimentos/${id}/importar-book`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
    // Duas chamadas Gemini (ficha + tabela) podem demorar bem mais.
    signal: AbortSignal.timeout(120_000),
  });
  const dados = await resposta.json().catch(() => ({ detail: "Resposta inválida do backend" }));
  return NextResponse.json(dados, { status: resposta.status });
}
