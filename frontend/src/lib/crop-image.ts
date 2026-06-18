/** Client-side bbox crop for Taobao-style refine (full region, not 220px thumb). */

export type NormalizedBbox = { x: number; y: number; w: number; h: number };

export async function cropImageFromBbox(
  imageSrc: string,
  bbox: NormalizedBbox,
  maxEdge = 640,
): Promise<string> {
  const image = await loadImage(imageSrc);
  const pad = 0.03;
  const x = clamp01(bbox.x - pad);
  const y = clamp01(bbox.y - pad);
  const w = Math.min(1 - x, bbox.w + pad * 2);
  const h = Math.min(1 - y, bbox.h + pad * 2);

  const sx = Math.floor(x * image.naturalWidth);
  const sy = Math.floor(y * image.naturalHeight);
  const sw = Math.max(24, Math.floor(w * image.naturalWidth));
  const sh = Math.max(24, Math.floor(h * image.naturalHeight));

  const scale = Math.min(1, maxEdge / Math.max(sw, sh));
  const cw = Math.max(1, Math.round(sw * scale));
  const ch = Math.max(1, Math.round(sh * scale));

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) return imageSrc;
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, cw, ch);
  return canvas.toDataURL("image/jpeg", 0.88);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith("blob:") && !src.startsWith("data:")) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Rasmni yuklab bo'lmadi"));
    img.src = src;
  });
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
