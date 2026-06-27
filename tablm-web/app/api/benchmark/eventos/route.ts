import { NextResponse } from "next/server";

import { API_URL } from "@/lib/api";
import { getToken } from "@/lib/auth";

/** Lista eventos promocionais. Preserva query string (ex.: `?ativos=true`). */
export async function GET(req: Request) {
  const token = await getToken();
  const url = new URL(req.url);
  const upstream = url.search
    ? `${API_URL}/benchmark/eventos${url.search}`
    : `${API_URL}/benchmark/eventos`;
  const resposta = await fetch(upstream, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    signal: AbortSignal.timeout(25_000),
  });
  const dados = await resposta.json().catch(() => ({ detail: "Resposta inválida do backend" }));
  return NextResponse.json(dados, { status: resposta.status });
}

/** Cria um evento promocional no backend. */
export async function POST(req: Request) {
  const corpo = await req.json();
  const token = await getToken();
  const resposta = await fetch(`${API_URL}/benchmark/eventos`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(25_000),
  });
  const dados = await resposta.json().catch(() => ({ detail: "Resposta inválida do backend" }));
  return NextResponse.json(dados, { status: resposta.status });
}
