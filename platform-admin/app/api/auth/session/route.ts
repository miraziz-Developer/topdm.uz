import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { verifySessionToken, ADMIN_SESSION_COOKIE } from "@/lib/admin-session";

export async function GET() {
  const jar = await cookies();
  const token = jar.get(ADMIN_SESSION_COOKIE)?.value;
  const username = verifySessionToken(token);
  if (!username) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true, username });
}
