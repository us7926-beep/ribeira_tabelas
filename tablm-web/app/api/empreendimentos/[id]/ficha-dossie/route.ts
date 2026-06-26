import { NextResponse } from "next/server";

import { API_URL } from "@/lib/api";
import { getToken } from "@/lib/auth";

/** Recebe o book/memorial via multipart e repassa ao backend (Gemini + Storage). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const form = await req.formData();
  const token = await getToken();
  const resposta = await fetch(`${API_URL}/empreendimentos/${id}/ficha-dossie`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
    // Gemini com PDF grande pode demorar; damos 60s.
    signal: AbortSignal.timeout(60_000),
  });
  const dados = await resposta.json().catch(() => ({ detail: "Resposta inválida do backend" }));
  return NextResponse.json(dados, { status: resposta.status });
}
