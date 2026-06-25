import { NextResponse } from "next/server";

import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";

/** Devolve a URL assinada (temporária) para baixar/visualizar um documento. */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ detail: "id ausente" }, { status: 400 });
  try {
    const dados = await api<{ url: string }>(`/documentos/${id}/url`, { token: await getToken() });
    return NextResponse.json(dados);
  } catch (e) {
    return NextResponse.json({ detail: (e as Error).message }, { status: 400 });
  }
}
