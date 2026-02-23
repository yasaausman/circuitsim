import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#0d0d14",
          raised: "#13131e",
          border: "#1e1e2e",
        },
        accent: {
          green: "#00ff9d",
          blue: "#4f8ef7",
          amber: "#f7b731",
          red: "#ff4757",
        },
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
