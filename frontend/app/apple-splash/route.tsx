import { pwaSplashImageResponse } from "@/lib/pwa-icon-art";

export const runtime = "edge";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const width = Math.min(1290, Math.max(390, parseInt(url.searchParams.get("w") || "1284", 10) || 1284));
  const height = Math.min(2796, Math.max(844, parseInt(url.searchParams.get("h") || "2778", 10) || 2778));
  return pwaSplashImageResponse(width, height);
}
