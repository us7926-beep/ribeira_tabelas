import { NextResponse } from "next/server";

import { API_URL } from "@/lib/api";
import { getToken } from "@/lib/auth";

/** Cria empreendimento (e incorporadora se nova) a partir de um book. */
export async function POST(req: Request) {
  const form = await req.formData();
  const token = await getToken();
  const resposta = await fetch(`${API_URL}/empreendimentos/importar-book`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
    // Pode rodar 2 chamadas Gemini; damos margem.
    signal: AbortSignal.timeout(120_000),
  });
  const dados = await resposta.json().catch(() => ({ detail: "Resposta inválida do backend" }));
  return NextResponse.json(dados, { status: resposta.status });
}
