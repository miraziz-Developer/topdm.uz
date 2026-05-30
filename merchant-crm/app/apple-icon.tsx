import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 40,
          background: "linear-gradient(135deg, #0066ff 0%, #ff4d12 100%)",
        }}
      >
        <div style={{ width: 56, height: 14, background: "white", borderRadius: 4 }} />
        <div style={{ width: 14, height: 40, background: "white", marginTop: 8, borderRadius: 3 }} />
        <div style={{ width: 28, height: 28, borderRadius: 14, background: "white", marginTop: 10 }} />
        <div style={{ marginTop: 12, fontSize: 18, fontWeight: 800, color: "white", letterSpacing: 2 }}>CRM</div>
      </div>
    ),
    { ...size },
  );
}
