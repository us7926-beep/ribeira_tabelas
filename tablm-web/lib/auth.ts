import { cookies } from "next/headers";

import { COOKIE_TOKEN } from "./constants";

/** Token JWT do cookie httpOnly (server-side). */
export async function getToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(COOKIE_TOKEN)?.value ?? null;
}
