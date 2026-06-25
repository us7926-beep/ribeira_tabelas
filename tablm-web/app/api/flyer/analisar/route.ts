import { NextResponse } from "next/server";

import { API_URL } from "@/lib/api";
import { getToken } from "@/lib/auth";

/** Recebe o flyer (multipart) e repassa ao backend /gemini/analisar-flyer com o JWT. */
export async function POST(req: Request) {
  const form = await req.formData();
  const token = await getToken();
  const resposta = await fetch(`${API_URL}/gemini/analisar-flyer`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const dados = await resposta.json().catch(() => ({ detail: "Resposta inválida do backend" }));
  return NextResponse.json(dados, { status: resposta.status });
}
