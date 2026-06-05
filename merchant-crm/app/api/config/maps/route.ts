import { NextResponse } from "next/server";

/** Server-side Yandex Maps key (build-time NEXT_PUBLIC_* yoki runtime .env). */
function resolveServerMapsApiKey(): string {
  return (
    process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY?.trim() ||
    process.env.YANDEX_MAPS_API_KEY?.trim() ||
    ""
  );
}

export async function GET() {
  const apiKey = resolveServerMapsApiKey();
  const valid = apiKey.length >= 8 && !apiKey.startsWith("your-");
  return NextResponse.json(
    { apiKey: valid ? apiKey : "", enabled: valid },
    { headers: { "Cache-Control": "no-store" } },
  );
}
