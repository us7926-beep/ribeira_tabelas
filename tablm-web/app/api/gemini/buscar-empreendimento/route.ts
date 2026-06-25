import { NextResponse } from "next/server";

import { API_URL } from "@/lib/api";
import { getToken } from "@/lib/auth";

/** Repassa a busca de ficha técnica pública via Gemini (com fallback no backend). */
export async function POST(req: Request) {
  const corpo = await req.json();
  const token = await getToken();
  const resposta = await fetch(`${API_URL}/gemini/buscar-empreendimento`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(corpo),
    // Busca com grounding pode demorar; damos 60s.
    signal: AbortSignal.timeout(60_000),
  });
  const dados = await resposta.json().catch(() => ({ detail: "Resposta inválida do backend" }));
  return NextResponse.json(dados, { status: resposta.status });
}
