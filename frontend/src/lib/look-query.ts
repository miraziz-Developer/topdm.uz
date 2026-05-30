/** Detect text look / outfit composition queries for the stylist API. */
export function isLookSearchQuery(q: string): boolean {
  const l = q.toLowerCase().trim();
  if (!l) return false;
  if (/\blook\b|obraz|kombin|komplekt|kiyinish|stil taklif|qber|bering|yig'ib/.test(l)) return true;
  if (/universitet|univer|talaba|ishga|ofis|to'y|toy|nikoh|dam olish|sport/.test(l)) return true;
  if (/\d[\d\s]{2,}\s*(?:so['']?m|sum|ming)/i.test(l) && /kiyim|kurtka|shim|poyabzal|ko'ylak|stil/.test(l)) {
    return true;
  }
  return false;
}
