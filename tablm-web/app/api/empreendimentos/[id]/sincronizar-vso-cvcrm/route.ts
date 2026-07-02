import { NextResponse } from "next/server";

import { API_URL } from "@/lib/api";
import { getToken } from "@/lib/auth";

/** Proxy para POST /empreendimentos/{id}/sincronizar-vso-cvcrm do FastAPI. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const token = await getToken();
  const resposta = await fetch(
    `${API_URL}/empreendimentos/${encodeURIComponent(id)}/sincronizar-vso-cvcrm`,
    {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    },
  );
  const dados = await resposta
    .json()
    .catch(() => ({ detail: "Resposta inválida do backend" }));
  return NextResponse.json(dados, { status: resposta.status });
}
