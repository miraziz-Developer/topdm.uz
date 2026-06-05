import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** Bozorliii.uz — app icon (brauzer tab) */
export default function Icon() {
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
          borderRadius: 9,
          background: "linear-gradient(135deg, #0066ff 0%, #ff4d12 100%)",
          color: "white",
        }}
      >
        <div style={{ width: 14, height: 4, background: "white", borderRadius: 2 }} />
        <div style={{ width: 4, height: 10, background: "white", marginTop: 2, borderRadius: 1 }} />
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            background: "white",
            marginTop: 3,
          }}
        />
      </div>
    ),
    { ...size },
  );
}
