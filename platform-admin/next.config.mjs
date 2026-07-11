const isProd = process.env.NODE_ENV === "production";

function mediaCdnPatterns() {
  const raw = (process.env.NEXT_PUBLIC_MEDIA_CDN_URL || "").trim();
  if (!raw) return [];
  try {
    const host = new URL(raw).hostname;
    if (!host) return [];
    return [{ protocol: "https", hostname: host, pathname: "/**" }];
  } catch {
    return [];
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "bozorliii.online", pathname: "/**" },
      { protocol: "https", hostname: "www.bozorliii.online", pathname: "/**" },
      { protocol: "https", hostname: "api.bozorliii.online", pathname: "/**" },
      { protocol: "https", hostname: "bozorliii.uz", pathname: "/**" },
      { protocol: "https", hostname: "www.bozorliii.uz", pathname: "/**" },
      { protocol: "https", hostname: "api.bozorliii.uz", pathname: "/**" },
      { protocol: "https", hostname: "media.bozorliii.online", pathname: "/**" },
      { protocol: "https", hostname: "*.r2.dev", pathname: "/**" },
      ...mediaCdnPatterns(),
      ...(isProd
        ? []
        : [
            { protocol: "http", hostname: "localhost", pathname: "/**" },
            { protocol: "http", hostname: "127.0.0.1", pathname: "/**" },
          ]),
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
