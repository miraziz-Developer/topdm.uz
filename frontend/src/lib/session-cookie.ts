/** HttpOnly session cookie shared by Route Handlers and the API proxy. */
export const SESSION_COOKIE_NAME = "bozor_session";

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export function sessionCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export function backendApiOrigin(): string {
  const raw = (
    process.env.BACKEND_API_URL ??
    process.env.INTERNAL_API_URL ??
    "http://127.0.0.1:8000"
  )
    .trim()
    .replace(/\/$/, "");
  // Allow misconfigured origins like http://host:8000/api/v1
  return raw.replace(/\/api\/v1$/i, "");
}
