import { NextRequest, NextResponse } from "next/server";

import { COOKIE_TOKEN } from "@/lib/constants";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(COOKIE_TOKEN)?.value;
  const ehPublico = pathname.startsWith("/login") || pathname.startsWith("/api/auth");

  if (!ehPublico && !token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith("/login") && token) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
