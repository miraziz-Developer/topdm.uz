import { pwaIconImageResponse } from "@/lib/pwa-icon-art";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return pwaIconImageResponse(32);
}
