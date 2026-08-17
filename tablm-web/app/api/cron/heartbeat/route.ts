import { NextResponse } from "next/server";

import { API_URL } from "@/lib/api";

/**
 * Vercel Cron diário (vercel.json: 0 3 * * * UTC = 0h BRT) -> bate
 * /health/heartbeat do backend, que faz SELECT count no Supabase.
 *
 * Objetivo: evitar que o Supabase free tier pause por inatividade
 * (pausa em ~7 dias sem atividade no DB → backend cai em 500 até restore).
 *
 * Endpoint público (sem CRON_SECRET) — só faz SELECT count, sem risco.
 * Timeout generoso pra cobrir cold start do Render (~30s).
 */
export async function GET() {
  try {
    const resposta = await fetch(`${API_URL}/health/heartbeat`, {
      cache: "no-store",
      signal: AbortSignal.timeout(45_000),
    });
    const corpo = await resposta.json().catch(() => ({}));
    return NextResponse.json(corpo, { status: resposta.status });
  } catch (erro) {
    return NextResponse.json(
      { erro: (erro as Error).message, ok: false },
      { status: 500 },
    );
  }
}
