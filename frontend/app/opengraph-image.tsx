import { ImageResponse } from "next/og";

export const alt = "Topdim.UZ — AI bilan bozor toping";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #0066ff 0%, #14141c 42%, #ff4d12 100%)",
          color: "#fff",
          padding: 72,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              background: "linear-gradient(135deg, #0066ff, #ff4d12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 36,
              fontWeight: 800,
            }}
          >
            T
          </div>
          <div style={{ fontSize: 56, fontWeight: 800, letterSpacing: -1 }}>topdim.uz</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 900 }}>
          <div style={{ fontSize: 48, fontWeight: 700, lineHeight: 1.15 }}>Toshkent bozorlarini AI bilan toping</div>
          <div style={{ fontSize: 28, opacity: 0.9 }}>50,000+ tovar · xarita · stilist · do&apos;konlar</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
