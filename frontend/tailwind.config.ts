import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "Outfit", "sans-serif"],
        mono: ["var(--font-mono)", "DM Mono", "monospace"],
      },
      colors: {
        canvas: "#f5f3ef",
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
      boxShadow: {
        card: "var(--shadow-card)",
        hover: "var(--shadow-hover)",
        elevated: "var(--shadow-elevated)",
        gold: "var(--shadow-gold)",
        modal: "var(--shadow-modal)",
        pin: "var(--shadow-pin)",
      },
      backgroundImage: {
        "gradient-gold": "linear-gradient(135deg, #ff4d12 0%, #ff8a4d 100%)",
        "gradient-electric": "linear-gradient(135deg, #0066ff 0%, #4da3ff 100%)",
        "gradient-card": "linear-gradient(180deg, rgba(3,3,8,0.03) 0%, transparent 100%)",
        "hero-glow":
          "radial-gradient(ellipse 85% 55% at 50% -8%, rgba(0,102,255,0.18) 0%, transparent 58%)",
        "mesh-accent":
          "radial-gradient(ellipse 60% 50% at 80% 20%, rgba(255,77,18,0.08) 0%, transparent 50%)",
      },
      animation: {
        shimmer: "shimmer 1.8s linear infinite",
        float: "float 3s ease-in-out infinite",
        "pulse-gold": "pulse-gold 2s ease-in-out infinite",
        "pulse-electric": "pulse-electric 2s ease-in-out infinite",
        "slide-up": "slide-up 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
        "fade-in": "fade-in 0.3s ease-out",
        "scale-in": "scale-in 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" },
        },
        "pulse-gold": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(255,77,18,0.4)" },
          "50%": { boxShadow: "0 0 0 10px rgba(255,77,18,0)" },
        },
        "pulse-electric": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(0,102,255,0.35)" },
          "50%": { boxShadow: "0 0 0 10px rgba(0,102,255,0)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
      },
    },
  },
} satisfies Config;
