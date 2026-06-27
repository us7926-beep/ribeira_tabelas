import { NextResponse } from "next/server";

import { API_URL } from "@/lib/api";
import { getToken } from "@/lib/auth";

/** Proxy PATCH/DELETE /benchmark/eventos/{id} -> backend. */

async function chamar(method: "PATCH" | "DELETE", id: string, corpo?: unknown) {
  const token = await getToken();
  const resposta = await fetch(`${API_URL}/benchmark/eventos/${id}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
    signal: AbortSignal.timeout(25_000),
  });
  const dados = await resposta.json().catch(() => ({ detail: "Resposta inválida do backend" }));
  return NextResponse.json(dados, { status: resposta.status });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const corpo = await req.json();
  return chamar("PATCH", id, corpo);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return chamar("DELETE", id);
}
