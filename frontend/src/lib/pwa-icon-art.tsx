import { ImageResponse } from "next/og";

const GRADIENT = "linear-gradient(135deg, #0066ff 0%, #7b3fe4 52%, #ff4d12 100%)";

/** PWA / apple-touch icon — brend gradient + savat "B" silueti. */
export function pwaIconImageResponse(size: number, { maskable = false }: { maskable?: boolean } = {}) {
  const pad = maskable ? Math.round(size * 0.12) : 0;
  const inner = size - pad * 2;
  const radius = maskable ? Math.round(size * 0.22) : Math.round(size * 0.24);
  const stroke = Math.max(4, Math.round(inner * 0.09));
  const node = Math.round(inner * 0.11);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: pad ? "#e8ecf4" : GRADIENT,
          padding: pad,
        }}
      >
        <div
          style={{
            width: inner,
            height: inner,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: radius,
            background: GRADIENT,
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: Math.round(inner * 0.18),
              left: Math.round(inner * 0.22),
              width: Math.round(inner * 0.56),
              height: Math.round(inner * 0.22),
              border: `${stroke}px solid white`,
              borderBottom: "none",
              borderTopLeftRadius: Math.round(inner * 0.28),
              borderTopRightRadius: Math.round(inner * 0.28),
            }}
          />
          <div
            style={{
              position: "absolute",
              top: Math.round(inner * 0.36),
              left: Math.round(inner * 0.24),
              width: Math.round(inner * 0.52),
              height: Math.round(inner * 0.46),
              border: `${stroke}px solid white`,
              borderRadius: Math.round(inner * 0.08),
            }}
          />
          <div
            style={{
              width: node,
              height: node,
              borderRadius: node,
              background: "white",
              boxShadow: "0 0 0 3px rgba(255,255,255,0.35)",
            }}
          />
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}

/** iOS / Android splash — ochilganda ilova ekrani. */
export function pwaSplashImageResponse(width: number, height: number) {
  const iconSize = Math.min(140, Math.round(width * 0.22));
  const titleSize = Math.max(28, Math.round(width * 0.07));
  const subSize = Math.max(14, Math.round(width * 0.035));

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
          background: "linear-gradient(165deg, #f2f4f8 0%, #ffffff 45%, #eef2ff 100%)",
        }}
      >
        <div
          style={{
            width: iconSize,
            height: iconSize,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: Math.round(iconSize * 0.24),
            background: GRADIENT,
            boxShadow: "0 24px 60px rgba(0,102,255,0.28)",
          }}
        >
          <div
            style={{
              width: Math.round(iconSize * 0.36),
              height: Math.round(iconSize * 0.36),
              borderRadius: Math.round(iconSize * 0.18),
              background: "white",
            }}
          />
        </div>
        <div
          style={{
            marginTop: 28,
            fontSize: titleSize,
            fontWeight: 800,
            color: "#030308",
            letterSpacing: -1,
          }}
        >
          Bozorliii
        </div>
        <div
          style={{
            marginTop: 10,
            fontSize: subSize,
            fontWeight: 500,
            color: "#475569",
          }}
        >
          AI bilan bozor toping
        </div>
      </div>
    ),
    { width, height },
  );
}
