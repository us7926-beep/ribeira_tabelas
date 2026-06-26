import { NextResponse } from "next/server";

import { API_URL } from "@/lib/api";

/**
 * Vercel Cron diário (vercel.json: 0 12 * * * UTC = 9h BRT) -> chama o
 * backend para disparar email das promocoes vencendo em <=7d.
 *
 * Vercel injeta o header `Authorization: Bearer ${CRON_SECRET}` quando a env
 * `CRON_SECRET` esta configurada no projeto. Repassamos o mesmo header para
 * o backend FastAPI, que valida com a mesma env.
 */
export async function GET(req: Request) {
  const esperado = process.env.CRON_SECRET;
  if (!esperado) {
    return NextResponse.json({ erro: "CRON_SECRET nao configurado" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${esperado}`) {
    return NextResponse.json({ erro: "nao autorizado" }, { status: 401 });
  }
  try {
    const resposta = await fetch(`${API_URL}/notificacoes/disparar-promocoes-vencendo`, {
      method: "POST",
      headers: { Authorization: `Bearer ${esperado}` },
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    });
    const corpo = await resposta.json().catch(() => ({}));
    return NextResponse.json(corpo, { status: resposta.status });
  } catch (erro) {
    return NextResponse.json(
      { erro: (erro as Error).message },
      { status: 500 },
    );
  }
}
