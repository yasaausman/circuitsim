import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": "/src" },
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("@react-three") || id.includes("three") || id.includes("maath") || id.includes("camera-controls")) {
            return "three-stack";
          }
          if (id.includes("react") || id.includes("scheduler")) {
            return "react-stack";
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
