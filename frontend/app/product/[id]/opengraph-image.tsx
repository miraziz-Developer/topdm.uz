import { ImageResponse } from "next/og";

import { getProduct } from "@/lib/api";

export const runtime = "edge";
export const alt = "Topdim.UZ tovar";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage({ params }: { params: { id: string } }) {
  try {
    const product = await getProduct(params.id);
    const price = `${product.price.toLocaleString("uz-UZ")} so'm`;
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            background: "linear-gradient(135deg, #0066ff 0%, #14141c 45%, #ff4d12 100%)",
            color: "#fff",
            padding: 64,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div style={{ fontSize: 28, opacity: 0.9 }}>Topdim.UZ</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.1, maxWidth: 900 }}>{product.name}</div>
            <div style={{ fontSize: 36, color: "#fde68a" }}>{price}</div>
            <div style={{ fontSize: 24, opacity: 0.85 }}>{product.shop.name}</div>
          </div>
        </div>
      ),
      { ...size },
    );
  } catch {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #0066ff 0%, #ff4d12 100%)",
            color: "#fff",
            fontSize: 48,
            fontWeight: 700,
          }}
        >
          Topdim.UZ
        </div>
      ),
      { ...size },
    );
  }
}
