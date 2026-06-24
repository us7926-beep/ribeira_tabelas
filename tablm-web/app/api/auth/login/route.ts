import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { api } from "@/lib/api";
import { COOKIE_TOKEN, TOKEN_MAX_AGE } from "@/lib/constants";

export async function POST(req: Request) {
  const corpo = await req.json();
  try {
    const dados = await api<{ token: string; usuario: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(corpo),
    });
    const jar = await cookies();
    jar.set(COOKIE_TOKEN, dados.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: TOKEN_MAX_AGE,
    });
    return NextResponse.json({ usuario: dados.usuario });
  } catch (erro) {
    return NextResponse.json({ detail: (erro as Error).message }, { status: 401 });
  }
}
