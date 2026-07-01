import { NextResponse } from "next/server";

export const runtime = "nodejs";

function parseSize(raw: string): number {
  const n = parseInt(raw.replace(/\D/g, ""), 10);
  if (!Number.isFinite(n)) return 192;
  return Math.min(512, Math.max(48, n));
}

/** Legacy PWA icon URL — static brand PNG ga yo'naltirish. */
export async function GET(
  request: Request,
  context: { params: Promise<{ size: string }> },
) {
  const { size: sizeParam } = await context.params;
  const size = parseSize(sizeParam);
  const pick = size >= 256 ? 512 : size >= 128 ? 192 : 180;
  const url = new URL(`/brand/bozorliii-icon-${pick}.png`, request.url);
  return NextResponse.redirect(url, 308);
}
