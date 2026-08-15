import { NextResponse } from "next/server";

import { API_URL } from "@/lib/api";
import { getToken } from "@/lib/auth";

/** Proxy para GET /geocode do backend (Nominatim + cache). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const bairro = url.searchParams.get("bairro") ?? "";
  const cidade = url.searchParams.get("cidade") ?? "";
  const token = await getToken();
  const params = new URLSearchParams({ bairro, cidade });
  const resposta = await fetch(`${API_URL}/geocode?${params.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const dados = await resposta.json().catch(() => ({ detail: "Resposta inválida" }));
  return NextResponse.json(dados, { status: resposta.status });
}
