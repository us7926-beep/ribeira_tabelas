import { NextResponse } from "next/server";

import { API_URL } from "@/lib/api";
import { getToken } from "@/lib/auth";

/** Passthrough para GET /cvcrm/series-tabela-preco do FastAPI, injetando o JWT. */
export async function GET() {
  const token = await getToken();
  const resposta = await fetch(`${API_URL}/cvcrm/series-tabela-preco`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
  });
  const dados = await resposta
    .json()
    .catch(() => ({ detail: "Resposta inválida do backend" }));
  return NextResponse.json(dados, { status: resposta.status });
}
