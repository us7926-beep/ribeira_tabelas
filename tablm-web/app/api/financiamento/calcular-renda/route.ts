import { NextResponse } from "next/server";

import { API_URL } from "@/lib/api";
import { getToken } from "@/lib/auth";

/** Proxy POST /financiamento/calcular-renda -> backend FastAPI. */
export async function POST(req: Request) {
  const corpo = await req.json();
  const token = await getToken();
  const resposta = await fetch(`${API_URL}/financiamento/calcular-renda`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(25_000),
  });
  const dados = await resposta
    .json()
    .catch(() => ({ detail: "Resposta inválida do backend" }));
  return NextResponse.json(dados, { status: resposta.status });
}
