/** @type {import('next').NextConfig} */

const isProd = process.env.NODE_ENV === "production";

const mapTilerKey =
  process.env.NEXT_PUBLIC_MAPTILER_KEY?.trim() ||
  process.env.NEXT_PUBLIC_MAPTILER_API_KEY?.trim() ||
  "";

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

const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  eslint: {
    // Warnings as errors disabled in production build to avoid blocking deploy
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Fail build on TypeScript errors
    ignoreBuildErrors: false,
  },
  transpilePackages: ["maplibre-gl"],
  env: {
    NEXT_PUBLIC_MAPTILER_KEY: mapTilerKey,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos", pathname: "/**" },
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
      { protocol: "https", hostname: "storage.googleapis.com", pathname: "/**" },
      { protocol: "https", hostname: "*.supabase.co", pathname: "/**" },
      { protocol: "https", hostname: "bozorliii.uz", pathname: "/**" },
      { protocol: "https", hostname: "www.bozorliii.uz", pathname: "/**" },
      { protocol: "https", hostname: "api.bozorliii.uz", pathname: "/**" },
      { protocol: "https", hostname: "bozorliii.online", pathname: "/**" },
      { protocol: "https", hostname: "www.bozorliii.online", pathname: "/**" },
      { protocol: "https", hostname: "api.bozorliii.online", pathname: "/**" },
      { protocol: "https", hostname: "media.bozorliii.online", pathname: "/**" },
      { protocol: "https", hostname: "ui-avatars.com", pathname: "/**" },
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
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), geolocation=(self)",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
