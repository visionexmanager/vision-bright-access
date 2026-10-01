import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The API serves the built files from the same origin, so the session cookie
// stays first-party and no CORS or token-in-JavaScript is needed.
export default defineConfig({
  plugins: [react()],
  // Inline (empty) PostCSS config so Vite does not walk up and load the public site's Tailwind config.
  css: { postcss: { plugins: [] } },
  build: { outDir: "dist", sourcemap: false },
  server: { proxy: { "/api": "http://127.0.0.1:8443" } },
});
