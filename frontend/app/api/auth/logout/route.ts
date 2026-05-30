import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/session-cookie";

export async function POST() {
  const jar = await cookies();
  jar.set(SESSION_COOKIE_NAME, "", {
    ...sessionCookieOptions(),
    maxAge: 0,
  });

  return NextResponse.json({ status: "ok" });
}
