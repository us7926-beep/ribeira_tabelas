import { cookies } from "next/headers";

import { COOKIE_TOKEN } from "./constants";

/** Token JWT do cookie httpOnly (server-side). */
export async function getToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(COOKIE_TOKEN)?.value ?? null;
}

/** Usuário logado, lido do payload do JWT (claim `sub`). Só pra exibição —
 * a validação de verdade acontece no backend a cada request. */
export async function getUsuario(): Promise<string | null> {
  const token = await getToken();
  if (!token) return null;
  try {
    const raw = token.split(".")[1];
    const padding = (4 - (raw.length % 4)) % 4;
    const b64 = raw.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(padding);
    const payload = JSON.parse(atob(b64));
    return typeof payload.sub === "string" && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}
