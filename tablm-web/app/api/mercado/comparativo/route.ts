import { NextResponse } from "next/server";

import { API_URL } from "@/lib/api";
import { getToken } from "@/lib/auth";

/** Repassa a planilha (multipart) ao backend /mercado/comparativo com o JWT. */
export async function POST(req: Request) {
  const form = await req.formData();
  const token = await getToken();
  const resposta = await fetch(`${API_URL}/mercado/comparativo`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
    signal: AbortSignal.timeout(25_000),
  });
  const dados = await resposta.json().catch(() => ({ detail: "Resposta inválida do backend" }));
  return NextResponse.json(dados, { status: resposta.status });
}
