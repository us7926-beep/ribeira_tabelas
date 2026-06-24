import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { COOKIE_TOKEN } from "@/lib/constants";

export async function POST() {
  const jar = await cookies();
  jar.delete(COOKIE_TOKEN);
  return NextResponse.json({ ok: true });
}
