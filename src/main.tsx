import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// ── Stale-deployment guard ──────────────────────────────────────────────────
// After a new Vite build, chunk filenames change (content-hash). Users who
// still have the old index.html cached will get 404s on dynamic imports.
// We detect that error and do a single forced reload to fetch the fresh bundle.
// SessionStorage prevents infinite reload loops if the server is genuinely down.
const RELOAD_KEY = "vx_chunk_reload";

window.addEventListener("unhandledrejection", (event) => {
  const msg: string =
    event.reason?.message ??
    (typeof event.reason === "string" ? event.reason : "");

  const isChunkError =
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("Importing a module script failed") ||
    event.reason?.name === "ChunkLoadError";

  if (!isChunkError) return;

  event.preventDefault(); // suppress console noise

  if (!sessionStorage.getItem(RELOAD_KEY)) {
    sessionStorage.setItem(RELOAD_KEY, "1");
    window.location.href = window.location.href;
  } else {
    // Second failure after reload — server may be down; clear flag so next
    // session tries again, but don't loop.
    sessionStorage.removeItem(RELOAD_KEY);
  }
});

// Clear the reload flag on a successful page load so future navigations
// are not blocked if a genuine chunk error occurs later.
window.addEventListener("load", () => {
  sessionStorage.removeItem(RELOAD_KEY);
});

createRoot(document.getElementById("root")!).render(<App />);
