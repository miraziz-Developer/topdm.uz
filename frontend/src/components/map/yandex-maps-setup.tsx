"use client";

import { ExternalLink } from "lucide-react";

export function YandexMapsSetup() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-[#F4F5F7] p-8 text-center">
      <p className="text-lg font-bold text-ink-900">Yandex Maps navigatsiyasi</p>
      <p className="max-w-md text-sm text-ink-600">
        Haqiqiy piyoda yo‘l (Yandex Navigator kabi) uchun{" "}
        <code className="rounded bg-white px-1.5 py-0.5 text-xs">NEXT_PUBLIC_YANDEX_MAPS_API_KEY</code>{" "}
        qo‘ying. Kalit olish: JavaScript API va HTTP Geocoder.
      </p>
      <a
        href="https://developer.tech.yandex.ru/"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-xl bg-[#1E98FF] px-5 py-2.5 text-sm font-bold text-white shadow-lg transition hover:opacity-90"
      >
        Yandex Developer
        <ExternalLink className="h-4 w-4" />
      </a>
      <p className="max-w-md text-xs text-ink-500">
        <code className="rounded bg-white px-1">.env</code> ga kalit qo‘ygach:{" "}
        <code className="rounded bg-white px-1">docker compose up -d --build frontend</code>
      </p>
    </div>
  );
}
