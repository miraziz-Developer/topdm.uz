/** Telegram / login redirect — faqat ichki CRM yo'llar. */

export function safeCrmNextPath(raw: string | null | undefined): string {
  const path = (raw ?? "").trim();
  if (!path.startsWith("/") || path.startsWith("//")) return "/dashboard";
  if (path.startsWith("/login") || path.startsWith("/telegram")) return "/dashboard";
  return path;
}
