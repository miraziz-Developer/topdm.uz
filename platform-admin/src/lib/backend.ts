export function backendApiOrigin(): string {
  const raw = (process.env.BACKEND_API_URL ?? process.env.INTERNAL_API_URL ?? "http://127.0.0.1:8000")
    .trim()
    .replace(/\/$/, "");
  return raw.replace(/\/api\/v1$/i, "");
}

export function adminApiKey(): string {
  return (process.env.ADMIN_API_KEY ?? "").trim();
}
