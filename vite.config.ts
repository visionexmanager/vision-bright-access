import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { execFileSync } from "child_process";

/**
 * Write crawler-readable copies of the two legal pages Meta App Review checks.
 *
 * A plugin rather than a step appended to the `build` script, because the VPS
 * runs its own build command and this repository cannot see it. Hooking the
 * bundle means it runs for `vite build` and `npm run build` alike.
 *
 * The script never throws — see its header — so a failure here costs the
 * crawler copy and not the deploy.
 */
function prerenderLegalPages(): Plugin {
  return {
    name: "visionex-prerender-legal",
    apply: "build",
    closeBundle() {
      try {
        const output = execFileSync(
          process.execPath,
          [path.resolve(__dirname, "scripts/prerender-legal.mjs")],
          { cwd: __dirname, encoding: "utf8" },
        );
        if (output.trim()) console.log(output.trim());
      } catch (error) {
        console.warn(`[prerender-legal] could not run: ${(error as Error).message}`);
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), prerenderLegalPages()],
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
          // Rich-text editor runtime — loaded only by authoring surfaces. Keeping
          // it separate prevents the Library Studio route chunk from crossing
          // the production size budget and lets browsers cache the editor core.
          "tiptap-editor": [
            "@tiptap/core",
            "@tiptap/extension-character-count",
            "@tiptap/extension-image",
            "@tiptap/extension-link",
            "@tiptap/extension-mathematics",
            "@tiptap/extension-placeholder",
            "@tiptap/extension-table",
            "@tiptap/extension-table-cell",
            "@tiptap/extension-table-header",
            "@tiptap/extension-table-row",
            "@tiptap/react",
            "@tiptap/starter-kit",
          ],
        },
      },
    },
  },
}));
