import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev, the browser talks ONLY to the Vite server; /api and /socket.io
// are proxied to the backend. Same-origin => the SameSite=Strict auth
// cookie works everywhere, and production (nginx) behaves identically.
const target = process.env.VITE_PROXY_TARGET || "http://localhost:5001";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    // File-watching on Docker-for-Windows bind mounts needs polling.
    watch: process.env.CHOKIDAR_USEPOLLING ? { usePolling: true } : undefined,
    proxy: {
      "/api": { target, changeOrigin: true },
      "/socket.io": { target, ws: true, changeOrigin: true },
    },
  },
});
