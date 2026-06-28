import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Netflix-inspired dark palette
        vx: {
          bg:      "#0a0a0a",
          surface: "#141414",
          card:    "#1c1c1c",
          border:  "#2a2a2a",
          accent:  "#e50914",
          "accent-hover": "#c40812",
          gold:    "#f59e0b",
          live:    "#22c55e",
          text:    "#ffffff",
          muted:   "#a3a3a3",
          subtle:  "#525252",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      animation: {
        "fade-in":    "fadeIn 0.3s ease-in-out",
        "slide-up":   "slideUp 0.4s ease-out",
        "pulse-live": "pulseLive 2s ease-in-out infinite",
        shimmer:      "shimmer 1.5s infinite",
      },
      keyframes: {
        fadeIn:    { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideUp:   { "0%": { opacity: "0", transform: "translateY(20px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        pulseLive: { "0%, 100%": { opacity: "1" }, "50%": { opacity: "0.4" } },
        shimmer:   { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
      },
      backgroundImage: {
        "gradient-radial":  "radial-gradient(var(--tw-gradient-stops))",
        "gradient-card":    "linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.95) 100%)",
        shimmer:            "linear-gradient(90deg, #1c1c1c 25%, #2a2a2a 50%, #1c1c1c 75%)",
      },
      backgroundSize: {
        shimmer: "200% 100%",
      },
    },
  },
  plugins: [],
};

export default config;
