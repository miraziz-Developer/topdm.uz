/** Mahsulot / buyurtma / qidiruvdan xaritaga — GPS + marshrut avtomatik. */

export const AUTO_NAVIGATE_MAP_SOURCES = new Set(["product", "order", "search"]);

export function shouldAutoNavigateFromMapSource(source?: string | null): boolean {
  return Boolean(source && AUTO_NAVIGATE_MAP_SOURCES.has(source));
}
