/**
 * Merchant joylashuvi — bozor, bino, qator/yo‘lak, qavat, do‘kon raqami.
 * Backend `merchant_location.py` bilan mos.
 */

export type MerchantLocationParsed = {
  market: string;
  building: string | null;
  blockLetter: string | null;
  row: string | null;
  floorLevel: number | null;
  shopNumber: string;
  stallNumber: string;
  addressLabel: string;
  locationComment: string | null;
};

const BLOCK_LETTERS = new Set(["A", "B", "C", "D"]);
const YOLAK_RE = /yo['’`ʼ]?lak|yo['’`ʼ]?lagi|qator/i;
const BUILDING_RE = /blok|bino|glavniy|bozor|sector|sektor|pavilon|koridor/i;
const QAVAT_RE = /(\d)\s*-?\s*qavat/i;

function clean(text: string | null | undefined): string {
  return (text ?? "").trim();
}

function extractShopNumber(section: string | null | undefined): string | null {
  const raw = clean(section);
  if (!raw) return null;
  const m = raw.match(/(\d{1,4})\s*-?\s*do['’`]?kon/i) ?? raw.match(/\b(\d{1,4})\b/);
  return m?.[1] ?? raw;
}

function extractBlockLetter(...sources: Array<string | null | undefined>): string | null {
  const raw = sources.filter(Boolean).join(" ");
  if (!raw.trim()) return null;
  const m =
    raw.match(/(?:^|[\s,])([A-D])\s*-?\s*blok/i) ??
    raw.match(/\bblok\s*([A-D])\b/i) ??
    raw.match(/\b([A-D])\s*-?\s*blok\b/i);
  if (!m) return null;
  const letter = m[1].toUpperCase();
  return BLOCK_LETTERS.has(letter) ? letter : null;
}

function extractFloorLevel(...sources: Array<string | null | undefined>): number | null {
  for (const src of sources) {
    const t = clean(src);
    if (!t || !/qavat/i.test(t)) continue;
    const m = t.match(QAVAT_RE);
    if (m) return Number.parseInt(m[1], 10);
  }
  return null;
}

function isRowLabel(text: string): boolean {
  if (!text.trim()) return false;
  if (YOLAK_RE.test(text)) return true;
  if (/^\d{1,2}\s*-?\s*(yo|yo['’`])/i.test(text)) return true;
  return false;
}

function isBuildingLabel(text: string): boolean {
  if (!text.trim()) return false;
  if (isRowLabel(text)) return false;
  if (BUILDING_RE.test(text)) return true;
  if (/^\d{1,2}\s*-?\s*blok/i.test(text)) return true;
  if (/glavniy/i.test(text)) return true;
  return false;
}

function pickRow(...sources: Array<string | null | undefined>): string | null {
  for (const src of sources) {
    const t = clean(src);
    if (t && isRowLabel(t)) return t;
  }
  return null;
}

function pickBuilding(...sources: Array<string | null | undefined>): string | null {
  for (const src of sources) {
    const t = clean(src);
    if (t && isBuildingLabel(t)) return t;
  }
  return null;
}

export type MerchantLocationInput = {
  ipadrom?: string | null;
  market_zone?: string | null;
  block_sector?: string | null;
  floor?: string | null;
  section?: string | null;
  shop_number?: string | null;
  location_comment?: string | null;
  location_label?: string | null;
};

export function parseMerchantLocation(input: MerchantLocationInput): MerchantLocationParsed {
  const marketZone = clean(input.market_zone);
  const blockSector = clean(input.block_sector);
  const floorField = clean(input.floor);
  const section = clean(input.section ?? input.shop_number);
  const locationComment = clean(input.location_comment ?? input.location_label);

  const market =
    marketZone ||
    (input.ipadrom ?? "Ippodrom").replace(/\s+bozor(i)?$/i, "").trim() ||
    "Ippodrom";

  let row = pickRow(floorField, blockSector, locationComment, section);
  let building = pickBuilding(blockSector, floorField, locationComment);

  if (building && row && building === row) {
    if (isRowLabel(blockSector)) {
      building = pickBuilding(floorField, locationComment);
    } else {
      row = pickRow(floorField, locationComment);
    }
  }

  const blockLetter = extractBlockLetter(blockSector, floorField, section, locationComment);
  const floorLevel = extractFloorLevel(floorField, locationComment, blockSector);
  const shopNum = extractShopNumber(section) ?? extractShopNumber(locationComment) ?? "—";
  const stallNumber = shopNum !== "—" ? shopNum : blockLetter ? String(8 + (blockLetter.charCodeAt(0) % 4) * 3) : "—";

  const parts: string[] = [market];
  if (building) parts.push(building);
  else if (blockLetter) parts.push(`${blockLetter}-blok`);
  if (row) parts.push(row);
  if (floorLevel) parts.push(`${floorLevel}-qavat`);
  if (shopNum !== "—") parts.push(`${shopNum}-do'kon`);

  const addressLabel = parts.length > 1 ? parts.join(" • ") : locationComment || market;

  return {
    market,
    building,
    blockLetter,
    row,
    floorLevel,
    shopNumber: section || shopNum,
    stallNumber,
    addressLabel,
    locationComment: locationComment || null,
  };
}
