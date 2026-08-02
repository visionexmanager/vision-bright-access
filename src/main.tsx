import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from "./features/visionkids/everywhere/registerServiceWorker";
import { installArcadeMonitoring } from "./features/arcade/monitoring/arcadeMonitoring";

const RELOAD_KEY = "vx_chunk_reload";
window.addEventListener("unhandledrejection", (event) => {
  const msg =
    event.reason?.message ??
    (typeof event.reason === "string" ? event.reason : "");
  const isChunkError =
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("Importing a module script failed") ||
    msg.includes("error loading dynamically imported module");
  if (!isChunkError) return;
  event.preventDefault();
  if (!sessionStorage.getItem(RELOAD_KEY)) {
    sessionStorage.setItem(RELOAD_KEY, "1");
    window.location.reload();
  } else {
    sessionStorage.removeItem(RELOAD_KEY);
  }
});

createRoot(document.getElementById("root")!).render(<App />);
installArcadeMonitoring();

// VisionKids Everywhere (Phase 18): register the PWA service worker in production.
registerServiceWorker();
