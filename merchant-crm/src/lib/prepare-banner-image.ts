/** Banner yuklash — telefon rasmlarini serverga yuborishdan oldin siqish. */

const MAX_EDGE = 1920;
const JPEG_QUALITY = 0.88;
/** Juda katta fayllarni serverga yubormaslik (xom rasm). */
const HARD_REJECT_BYTES = 40 * 1024 * 1024;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Rasmni o'qib bo'lmadi"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Rasm formati noto'g'ri"));
    img.src = src;
  });
}

/**
 * Har qanday rasm (JPG/PNG/WebP/HEIC brauzer qo'llasa) — banner uchun tayyor fayl.
 * 10 MB limit yo'q: kerak bo'lsa avtomatik siqiladi.
 */
export async function prepareBannerImageFile(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Faqat rasm (JPG, PNG)");
  }
  if (file.size > HARD_REJECT_BYTES) {
    throw new Error("Rasm juda katta — boshqa rasm tanlang yoki kameradan qayta oling.");
  }
  // Kichik rasmlar — o'zgartirmasdan
  if (file.size <= 3 * 1024 * 1024) {
    return file;
  }

  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);
  const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height, 1));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(image, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/jpeg", JPEG_QUALITY);
  });
  if (!blob) return file;

  const base = file.name.replace(/\.[^.]+$/, "") || "banner";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
}
