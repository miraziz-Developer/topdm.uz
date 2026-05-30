export function shortId(id: string, len = 8) {
  return `#${id.replace(/-/g, "").slice(0, len).toUpperCase()}`;
}
