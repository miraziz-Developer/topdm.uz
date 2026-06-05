import { dispatchYandexShopPinClick } from "@/lib/map/yandex-shop-pin-click";
import { buildYandexMapsRouteUrl, markerWgs84, shopPageHref } from "@/lib/map/yandex-external";
import { locationDetailsFromMarker } from "@/lib/map/shop-location-display";
import type { MapShopMarker } from "@/lib/shop-location";

type YmapsTemplateFactory = {
  createClass: (
    template: string,
    overrides?: Record<string, unknown>,
  ) => YmapsLayoutClass;
};

export type { YmapsTemplateFactory };

type YmapsLayoutClass = {
  superclass: {
    build: () => void;
    clear: () => void;
  };
};

const SHOP_PIN_LAYOUT_VERSION = 3;
let shopPinLayout: YmapsLayoutClass | null = null;
let shopPinLayoutVersion = 0;

const PIN_TEMPLATE = [
  '<div class="bozorliii-yandex-pin $[properties.focusedClass]" data-shop-id="$[properties.shopId]">',
  '<div class="bozorliii-yandex-pin__disc">',
  '<span class="bozorliii-yandex-pin__stall">$[properties.stall]</span>',
  "</div>",
  '<div class="bozorliii-yandex-pin__name">$[properties.shopName]</div>',
  "</div>",
].join("");

/** Katta Bozorliii do‘kon pin — DOM click + pointer (Yandex iconShape bilan). */
export function getYandexShopPinLayout(ymapsApi: {
  templateLayoutFactory: YmapsTemplateFactory;
}): unknown {
  if (shopPinLayout && shopPinLayoutVersion === SHOP_PIN_LAYOUT_VERSION) {
    return shopPinLayout;
  }
  shopPinLayoutVersion = SHOP_PIN_LAYOUT_VERSION;

  const LayoutClass = ymapsApi.templateLayoutFactory.createClass(PIN_TEMPLATE, {
    build(this: {
      getElement: () => HTMLElement | null;
      getData: () => { properties: { get: (key: string) => string } };
      _onPinClick?: (e: Event) => void;
    }) {
      LayoutClass.superclass.build.call(this);
      const el = this.getElement();
      if (!el) return;

      el.style.cursor = "pointer";
      el.style.pointerEvents = "auto";
      el.setAttribute("role", "button");
      el.setAttribute("tabindex", "0");

      const shopId = String(this.getData().properties.get("shopId") ?? "");
      const onPinClick = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        dispatchYandexShopPinClick(shopId);
      };
      this._onPinClick = onPinClick;
      el.addEventListener("click", onPinClick, { capture: true });
      el.addEventListener("touchend", onPinClick, { capture: true, passive: false });
    },
    clear(this: { getElement: () => HTMLElement | null; _onPinClick?: (e: Event) => void }) {
      const el = this.getElement();
      if (el && this._onPinClick) {
        el.removeEventListener("click", this._onPinClick, { capture: true });
        el.removeEventListener("touchend", this._onPinClick, { capture: true });
      }
      LayoutClass.superclass.clear.call(this);
    },
  });

  shopPinLayout = LayoutClass;
  return shopPinLayout;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function locationGridHtml(loc: ReturnType<typeof locationDetailsFromMarker>): string {
  const cell = (label: string, value: string, accent = false) =>
    `<div style="border:1px solid ${accent ? "#93c5fd" : "#e2e8f0"};border-radius:8px;padding:6px 4px;text-align:center;background:${accent ? "#eff6ff" : "#fff"}">` +
    `<div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#64748b">${escapeHtml(label)}</div>` +
    `<div style="margin-top:2px;font-size:12px;font-weight:800;line-height:1.2;color:${accent ? "#0066ff" : "#0f172a"}">${escapeHtml(value)}</div></div>`;

  const chips: { label: string; value: string; accent?: boolean }[] = [];
  if (loc.building) chips.push({ label: "Bino", value: loc.building });
  else if (loc.block) chips.push({ label: "Blok", value: `${loc.block}-blok` });
  if (loc.row) chips.push({ label: "Qator", value: loc.row });
  if (loc.floor) chips.push({ label: "Qavat", value: loc.floor });
  chips.push({ label: "Do'kon №", value: loc.stallNumber, accent: true });

  const comment = loc.comment
    ? `<p style="margin:8px 0 0;padding:8px 10px;border-radius:8px;border:1px solid #fcd34d;background:#fffbeb;font-size:12px;font-weight:600;color:#78350f;line-height:1.35">💬 ${escapeHtml(loc.comment)}</p>`
    : "";

  return (
    `<div style="margin-top:8px;padding:10px;border-radius:10px;border:2px solid #fbbf24;background:linear-gradient(135deg,#fffbeb,#fff7ed)">` +
    `<p style="margin:0;font-size:10px;font-weight:800;text-transform:uppercase;color:#b45309">📍 ${escapeHtml(loc.market)}</p>` +
    `<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px">` +
    chips.map((c) => cell(c.label, c.value, c.accent)).join("") +
    `</div>${comment}</div>`
  );
}

export function buildYandexShopBalloon(marker: MapShopMarker): {
  header: string;
  body: string;
  footer: string;
} {
  const name = escapeHtml(marker.name);
  const loc = locationDetailsFromMarker(marker);
  const rating =
    marker.rating != null && marker.rating > 0
      ? `<p style="margin:6px 0 0;font-size:12px;color:#d97706;font-weight:700">★ ${marker.rating.toFixed(1)}</p>`
      : "";

  const shopHref = shopPageHref(marker);
  const wgs = markerWgs84(marker);
  const yandexRoute = buildYandexMapsRouteUrl(wgs);

  return {
    header: name,
    body: [locationGridHtml(loc), rating].join(""),
    footer: [
      `<a href="${shopHref}" style="display:block;margin-top:10px;padding:10px 14px;border-radius:10px;background:#1E98FF;color:#fff;font-size:13px;font-weight:700;text-align:center;text-decoration:none">`,
      "Do‘konga kirish",
      "</a>",
      `<a href="${yandexRoute}" target="_blank" rel="noopener noreferrer" style="display:block;margin-top:8px;padding:10px 14px;border-radius:10px;background:#22c55e;color:#fff;font-size:13px;font-weight:700;text-align:center;text-decoration:none">`,
      "Yandexda marshrut",
      "</a>",
    ].join(""),
  };
}

export function yandexShopPlacemarkProperties(marker: MapShopMarker, focused: boolean) {
  const stall = marker.shopNumber?.match(/\d{1,4}/)?.[0] ?? marker.pin.stall;
  return {
    shopId: marker.id,
    shopName: marker.name.slice(0, 22),
    stall,
    focusedClass: focused ? "bozorliii-yandex-pin--focused" : "",
    hintContent: `${marker.name} • ${locationDetailsFromMarker(marker).summary}`,
  };
}

/** Yandex iconShape — butun pin (raqam + nom) ustida pointer va click. */
export const YANDEX_SHOP_ICON_SHAPE = {
  type: "Rectangle" as const,
  coordinates: [
    [-36, -80],
    [36, 12],
  ] as [[number, number], [number, number]],
};

export function yandexShopPlacemarkOptions(
  ymapsApi: { templateLayoutFactory: YmapsTemplateFactory },
  focused: boolean,
) {
  return {
    iconLayout: getYandexShopPinLayout(ymapsApi),
    iconShape: YANDEX_SHOP_ICON_SHAPE,
    iconOffset: [-36, -80],
    hasBalloon: false,
    hasHint: true,
    openBalloonOnClick: false,
    openHintOnHover: true,
    hideIconOnBalloonOpen: false,
    cursor: "pointer",
    zIndex: focused ? 2500 : 1000,
    zIndexHover: focused ? 2600 : 1100,
    zIndexActive: focused ? 2700 : 1200,
  };
}
