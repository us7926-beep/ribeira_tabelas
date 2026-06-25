import { NextResponse } from "next/server";

import { API_URL } from "@/lib/api";
import { getToken } from "@/lib/auth";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tabelaId = new URL(req.url).searchParams.get("tabela_id");
  const token = await getToken();
  const qs = tabelaId ? `?tabela_id=${encodeURIComponent(tabelaId)}` : "";
  const resposta = await fetch(`${API_URL}/empreendimentos/${id}/fluxo-comercial${qs}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal: AbortSignal.timeout(25_000),
  });
  const dados = await resposta.json().catch(() => ({ detail: "Resposta inválida do backend" }));
  return NextResponse.json(dados, { status: resposta.status });
}
