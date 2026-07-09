import { NextRequest, NextResponse } from "next/server";

import {
  ADMIN_SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
  verifyAdminCredentials,
} from "@/lib/admin-session";

export async function POST(request: NextRequest) {
  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON" }, { status: 400 });
  }

  const username = (body.username ?? "").trim();
  const password = body.password ?? "";
  if (!verifyAdminCredentials(username, password)) {
    return NextResponse.json({ detail: "Login yoki parol noto'g'ri" }, { status: 401 });
  }

  const token = createSessionToken(username);
  const res = NextResponse.json({ status: "ok", username });
  res.cookies.set(ADMIN_SESSION_COOKIE, token, sessionCookieOptions);
  return res;
}
