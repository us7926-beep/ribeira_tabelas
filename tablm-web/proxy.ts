import { NextRequest, NextResponse } from "next/server";

import { COOKIE_TOKEN } from "@/lib/constants";

/**
 * Verifica se o JWT expirou olhando o payload (server-side, sem libs de crypto).
 * Em caso de erro de parse, trata como expirado por segurança.
 */
function tokenExpirado(token: string): boolean {
  try {
    const raw = token.split(".")[1];
    const padding = (4 - (raw.length % 4)) % 4;
    const b64 = raw.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(padding);
    const payload = JSON.parse(atob(b64));
    return typeof payload.exp === "number" && Date.now() / 1000 > payload.exp;
  } catch {
    return true;
  }
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(COOKIE_TOKEN)?.value;
  const autenticado = !!token && !tokenExpirado(token);
  const ehPublico = pathname.startsWith("/login") || pathname.startsWith("/api/auth");

  if (!ehPublico && !autenticado) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith("/login") && autenticado) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
