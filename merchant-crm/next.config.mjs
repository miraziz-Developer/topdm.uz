/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";

const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_YANDEX_MAPS_API_KEY: process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY ?? "",
    NEXT_PUBLIC_MAP_PROVIDER: process.env.NEXT_PUBLIC_MAP_PROVIDER ?? "yandex-maps-api",
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos", pathname: "/**" },
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
      { protocol: "https", hostname: "*.supabase.co", pathname: "/**" },
      { protocol: "https", hostname: "bozorliii.uz", pathname: "/**" },
      { protocol: "https", hostname: "api.bozorliii.uz", pathname: "/**" },
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
        ],
      },
    ];
  },
};

export default nextConfig;
