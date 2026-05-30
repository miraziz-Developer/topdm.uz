import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/session-cookie";

type LoginBody = {
  token?: string;
};

export async function POST(request: Request) {
  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json({ detail: "Invalid JSON body" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token || token.length < 20) {
    return NextResponse.json({ detail: "Valid token is required" }, { status: 400 });
  }

  const jar = await cookies();
  jar.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());

  return NextResponse.json({ status: "ok" });
}
