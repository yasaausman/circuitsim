import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#f8fafc",
          raised: "#ffffff",
          border: "#e2e8f0",
        },
        accent: {
          green: "#10b981",
          blue: "#0284c7",
          amber: "#f59e0b",
          red: "#ef4444",
        },
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
