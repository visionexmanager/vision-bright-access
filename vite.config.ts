import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // VoiceRoom bundles livekit-client (~170 kB gzip) — already lazy-loaded, 700 kB raw is acceptable
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React runtime — tiny and always needed
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          // Supabase — large SDK, keep isolated so it can be cached independently
          "supabase": ["@supabase/supabase-js"],
          // TanStack Query
          "query": ["@tanstack/react-query"],
          // Radix UI primitives — loaded on every page via shadcn components
          "radix-ui": [
            "@radix-ui/react-accordion",
            "@radix-ui/react-alert-dialog",
            "@radix-ui/react-avatar",
            "@radix-ui/react-checkbox",
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-label",
            "@radix-ui/react-popover",
            "@radix-ui/react-progress",
            "@radix-ui/react-radio-group",
            "@radix-ui/react-scroll-area",
            "@radix-ui/react-select",
            "@radix-ui/react-separator",
            "@radix-ui/react-slider",
            "@radix-ui/react-slot",
            "@radix-ui/react-switch",
            "@radix-ui/react-tabs",
            "@radix-ui/react-toast",
            "@radix-ui/react-tooltip",
          ],
          // Markdown renderer — only used in AIChat, kept separate
          "markdown": ["react-markdown"],
          // Recharts — only used in chart pages
          "charts": ["recharts"],
        },
      },
    },
  },
}));
