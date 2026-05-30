/**
 * Uzbekistan phone input utilities.
 * Display mask: +998 (XX) XXX-XX-XX
 * API wire format: +998XXXXXXXXX (E.164)
 */

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function uzSubscriberDigits(raw: string): string {
  let d = digitsOnly(raw);
  if (d.startsWith("998")) d = d.slice(3);
  else if (d.startsWith("8") && d.length > 9) d = d.slice(1);
  return d.slice(0, 9);
}

/** Active typing mask for checkout: +998 (XX) XXX-XX-XX */
export function formatUzbekPhoneParenDisplay(raw: string): string {
  const sub = uzSubscriberDigits(raw);
  if (!sub) return "+998 ";
  const g1 = sub.slice(0, 2);
  const g2 = sub.slice(2, 5);
  const g3 = sub.slice(5, 7);
  const g4 = sub.slice(7, 9);
  let out = "+998";
  if (g1) {
    out += ` (${g1}`;
    if (g1.length === 2) out += ")";
  }
  if (g2) out += (g1.length === 2 ? " " : "") + g2;
  if (g3) out += `-${g3}`;
  if (g4) out += `-${g4}`;
  return out;
}

/** Legacy spaced display: +998 XX XXX XX XX */
export function formatUzbekPhoneDisplay(raw: string): string {
  const sub = uzSubscriberDigits(raw);
  if (!sub) return "+998 ";
  const g1 = sub.slice(0, 2);
  const g2 = sub.slice(2, 5);
  const g3 = sub.slice(5, 7);
  const g4 = sub.slice(7, 9);
  let out = "+998";
  if (g1) out += ` ${g1}`;
  if (g2) out += ` ${g2}`;
  if (g3) out += ` ${g3}`;
  if (g4) out += ` ${g4}`;
  return out;
}

export function normalizeUzbekPhoneE164(display: string): string {
  const sub = uzSubscriberDigits(display);
  if (sub.length !== 9) return "";
  return `+998${sub}`;
}

export const UZ_PHONE_E164_REGEX = /^\+998\d{9}$/;

export function formatPhoneHotline(e164: string): string {
  const sub = uzSubscriberDigits(e164);
  if (sub.length !== 9) return e164;
  return formatUzbekPhoneParenDisplay(sub);
}

/** Cursor-friendly handler for controlled tel inputs. */
export function applyPhoneMaskInput(raw: string): string {
  return formatUzbekPhoneParenDisplay(raw);
}
