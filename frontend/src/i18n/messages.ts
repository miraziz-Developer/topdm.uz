export type Locale = "uz" | "ru" | "en" | "tg" | "ky";

import { HOME_MESSAGES, type HomeMessageKey } from "@/i18n/home-messages";

export type MessageKey =
  | "app.name"
  | "nav.search"
  | "nav.cart"
  | "nav.profile"
  | "chat.title"
  | "chat.placeholder"
  | "map.vip"
  | "map.level"
  | "offline.banner"
  | "currency.label"
  | "language.label"
  | "price.from"
  | HomeMessageKey;

type CoreMessageKey = Exclude<MessageKey, HomeMessageKey>;

const uz: Record<CoreMessageKey, string> = {
  "app.name": "Topdim.UZ",
  "nav.search": "Qidiruv",
  "nav.cart": "Savat",
  "nav.profile": "Profil",
  "chat.title": "AI bilan toping",
  "chat.placeholder": "Nima qidiryapsiz...",
  "map.vip": "VIP do'kon",
  "map.level": "qavat",
  "offline.banner": "Offline rejim — xarita keshdan ishlayapti",
  "currency.label": "Valyuta",
  "language.label": "Til",
  "price.from": "dan",
};

const ru: Record<CoreMessageKey, string> = {
  "app.name": "Topdim.UZ",
  "nav.search": "Поиск",
  "nav.cart": "Корзина",
  "nav.profile": "Профиль",
  "chat.title": "Найти с AI",
  "chat.placeholder": "Что ищете...",
  "map.vip": "VIP магазин",
  "map.level": "этаж",
  "offline.banner": "Офлайн — карта из кэша",
  "currency.label": "Валюта",
  "language.label": "Язык",
  "price.from": "от",
};

const en: Record<CoreMessageKey, string> = {
  "app.name": "Topdim.UZ",
  "nav.search": "Search",
  "nav.cart": "Cart",
  "nav.profile": "Profile",
  "chat.title": "Find with AI",
  "chat.placeholder": "What are you looking for...",
  "map.vip": "VIP shop",
  "map.level": "floor",
  "offline.banner": "Offline mode — map served from cache",
  "currency.label": "Currency",
  "language.label": "Language",
  "price.from": "from",
};

const tg: Record<CoreMessageKey, string> = {
  ...uz,
  "nav.search": "Ҷустуҷӯ",
  "nav.cart": "Сабад",
  "offline.banner": "Реҷаи офлайн — харита аз кэш",
};

const ky: Record<CoreMessageKey, string> = {
  ...ru,
  "nav.search": "Издөө",
  "offline.banner": "Офлайн режим — карта кэштен",
};

function mergeLocale(base: Record<CoreMessageKey, string>, locale: Locale): Record<MessageKey, string> {
  return { ...base, ...HOME_MESSAGES[locale] };
}

export const MESSAGES: Record<Locale, Record<MessageKey, string>> = {
  uz: mergeLocale(uz, "uz"),
  ru: mergeLocale(ru, "ru"),
  en: mergeLocale(en, "en"),
  tg: mergeLocale(uz, "tg"),
  ky: mergeLocale(ru, "ky"),
};

export const LOCALE_LABELS: Record<Locale, string> = {
  uz: "O'zbek",
  ru: "Русский",
  en: "English",
  tg: "Тоҷикӣ",
  ky: "Кыргызча",
};
