import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

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
    window.location.href = window.location.href;
  } else {
    sessionStorage.removeItem(RELOAD_KEY);
  }
});

createRoot(document.getElementById("root")!).render(<App />);
