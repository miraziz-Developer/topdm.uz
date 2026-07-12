import { createHmac, timingSafeEqual } from "crypto";

export const ADMIN_SESSION_COOKIE = "platform_admin_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 7;

function sessionSecret(): string {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.ADMIN_PANEL_SECRET ||
    process.env.ADMIN_API_KEY ||
    "change-me"
  ).trim();
}

export function verifyAdminCredentials(username: string, password: string): boolean {
  const expectedUser = (process.env.ADMIN_PANEL_USERNAME ?? "admin").trim();
  const expectedPass = (process.env.ADMIN_PANEL_PASSWORD ?? "").trim();
  if (!expectedPass) return false;
  const userBuf = Buffer.from(username.trim());
  const passBuf = Buffer.from(password);
  const expUserBuf = Buffer.from(expectedUser);
  const expPassBuf = Buffer.from(expectedPass);
  if (userBuf.length !== expUserBuf.length || passBuf.length !== expPassBuf.length) return false;
  return timingSafeEqual(userBuf, expUserBuf) && timingSafeEqual(passBuf, expPassBuf);
}

export function createSessionToken(username: string): string {
  const exp = Date.now() + MAX_AGE_SEC * 1000;
  const payload = `${username}:${exp}`;
  const sig = createHmac("sha256", sessionSecret()).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

export function verifySessionToken(token: string | undefined | null): string | null {
  if (!token) return null;
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const lastColon = decoded.lastIndexOf(":");
    if (lastColon < 0) return null;
    const payload = decoded.slice(0, lastColon);
    const sig = decoded.slice(lastColon + 1);
    const expected = createHmac("sha256", sessionSecret()).update(payload).digest("hex");
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;
    const [username, expStr] = payload.split(":");
    if (!username || !expStr) return null;
    if (Date.now() > Number(expStr)) return null;
    return username;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: MAX_AGE_SEC,
};
