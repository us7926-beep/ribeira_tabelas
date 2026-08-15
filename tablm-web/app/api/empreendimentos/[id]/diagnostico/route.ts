import { NextResponse } from "next/server";

import { API_URL } from "@/lib/api";
import { getToken } from "@/lib/auth";

async function proxy(id: string, method: "GET" | "POST") {
  const token = await getToken();
  const resposta = await fetch(
    `${API_URL}/empreendimentos/${encodeURIComponent(id)}/diagnostico`,
    {
      method,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store",
      // Gemini pode passar de 25s em contexto grande; 60s.
      signal: AbortSignal.timeout(60_000),
    },
  );
  const dados = await resposta
    .json()
    .catch(() => ({ detail: "Resposta inválida do backend" }));
  return NextResponse.json(dados, { status: resposta.status });
}

/** Proxy para GET /empreendimentos/{id}/diagnostico do FastAPI. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxy(id, "GET");
}

/** Proxy para POST /empreendimentos/{id}/diagnostico do FastAPI. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxy(id, "POST");
}
