/** Faylni data URL (base64) ga aylantirish — stylist chat uchun. */

const MAX_BYTES = 8 * 1024 * 1024;

export async function fileToDataUrl(file: File): Promise<string> {
  if (file.size > MAX_BYTES) {
    throw new Error("Rasm 8 MB dan kichik bo‘lishi kerak");
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") resolve(result);
      else reject(new Error("Rasm o‘qib bo‘lmadi"));
    };
    reader.onerror = () => reject(new Error("Rasm o‘qib bo‘lmadi"));
    reader.readAsDataURL(file);
  });
}
