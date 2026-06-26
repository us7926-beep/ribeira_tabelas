import { NextResponse } from "next/server";

import { API_URL } from "@/lib/api";
import { getToken } from "@/lib/auth";

/** Lista distribuicao por modalidade do empreendimento (opcional de/ate em YYYY-MM). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sp = new URL(req.url).searchParams;
  const qs = new URLSearchParams();
  const de = sp.get("de");
  const ate = sp.get("ate");
  if (de) qs.set("de", de);
  if (ate) qs.set("ate", ate);
  const token = await getToken();
  const url = `${API_URL}/empreendimentos/${id}/vendas-mensais/distribuicao${qs.size ? `?${qs}` : ""}`;
  const resposta = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal: AbortSignal.timeout(25_000),
  });
  const dados = await resposta.json().catch(() => ({ detail: "Resposta inválida do backend" }));
  return NextResponse.json(dados, { status: resposta.status });
}

/** Substitui a distribuicao do mes (delete + insert no backend). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const corpo = await req.json();
  const token = await getToken();
  const resposta = await fetch(
    `${API_URL}/empreendimentos/${id}/vendas-mensais/distribuicao`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(25_000),
    },
  );
  const dados = await resposta.json().catch(() => ({ detail: "Resposta inválida do backend" }));
  return NextResponse.json(dados, { status: resposta.status });
}
