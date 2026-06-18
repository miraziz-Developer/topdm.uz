import type { Config } from "tailwindcss";

/** Bozorliii.uz — mijoz sayti bilan bir xil tokenlar */
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-outfit)", "Outfit", "system-ui", "sans-serif"],
        mono: ["var(--font-dm-mono)", "DM Mono", "ui-monospace", "monospace"],
      },
      colors: {
        canvas: "#f2f4f8",
        base: "#ffffff",
        surface: "#ffffff",
        elevated: "#e8ecf4",
        overlay: "#ffffff",
        ink: {
          900: "#030308",
          700: "#14141c",
          500: "#4a4f5c",
        },
        electric: {
          400: "#3388ff",
          500: "#0066ff",
          600: "#0044c4",
        },
        neon: {
          400: "#ff6b3d",
          500: "#ff4d12",
        },
        text: {
          100: "#030308",
          200: "#14141c",
          300: "#4a4f5c",
          400: "#7a8194",
        },
        green: "#059669",
        red: "#dc2626",
        gold: {
          400: "#ff6b3d",
          500: "#ff4d12",
          600: "#e03d08",
        },
        border: {
          subtle: "rgba(3,3,8,0.07)",
          default: "rgba(3,3,8,0.12)",
          strong: "rgba(3,3,8,0.18)",
        },
      },
      backgroundImage: {
        "gradient-gold": "linear-gradient(135deg, #ff4d12 0%, #ff8a4d 100%)",
        "gradient-electric": "linear-gradient(135deg, #0066ff 0%, #4da3ff 100%)",
        "hero-glow":
          "radial-gradient(ellipse 85% 55% at 50% -8%, rgba(0,102,255,0.16) 0%, transparent 58%)",
        "mesh-accent":
          "radial-gradient(ellipse 55% 45% at 90% 10%, rgba(255,77,18,0.09) 0%, transparent 50%)",
      },
      boxShadow: {
        card: "0 4px 6px -1px rgba(3,3,8,0.05), 0 12px 32px -8px rgba(3,3,8,0.1)",
        hover: "0 8px 16px -4px rgba(0,102,255,0.15), 0 24px 48px -12px rgba(0,102,255,0.18)",
        gold: "0 8px 28px -4px rgba(255,77,18,0.32)",
        elevated: "0 20px 50px -12px rgba(3,3,8,0.15)",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.25rem",
      },
      animation: {
        shimmer: "shimmer 1.8s linear infinite",
        "fade-in": "fade-in 0.35s ease-out",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
} satisfies Config;
