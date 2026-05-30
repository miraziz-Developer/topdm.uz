/** Resolve merchant image for map badges (DB logo or generated avatar). */
export function resolveMarkerLogoUrl(name: string, logoUrl?: string | null): string {
  const trimmed = logoUrl?.trim();
  if (trimmed) {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return trimmed;
    }
    const origin =
      process.env.NEXT_PUBLIC_BACKEND_ORIGIN?.replace(/\/$/, "") ||
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
      "";
    if (origin) {
      return `${origin}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
    }
    return trimmed;
  }

  const seed = encodeURIComponent(name.trim() || "Shop");
  return `https://ui-avatars.com/api/?name=${seed}&background=2563eb&color=ffffff&size=128&bold=true&format=png`;
}

const STORE_ICON_SVG =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  );

export function resolveMarkerFallbackGlyph(name: string): string {
  return resolveMarkerLogoUrl(name, null);
}

export { STORE_ICON_SVG };
