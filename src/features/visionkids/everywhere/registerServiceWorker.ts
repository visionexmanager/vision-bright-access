/**
 * Service-worker registration + update flow. Called once from main.tsx, guarded
 * to production so local dev is never affected. When a new SW is waiting, we
 * dispatch `visionkids:sw-update` so the UI can offer a friendly "refresh to
 * update" prompt (the app decides how to surface it).
 */
export function registerServiceWorker(): void {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  // Only in production builds — a SW in dev would cache Vite's HMR pipeline.
  if (!import.meta.env.PROD) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              window.dispatchEvent(new CustomEvent("visionkids:sw-update", { detail: { registration: reg } }));
            }
          });
        });
      })
      .catch(() => { /* SW registration is best-effort */ });
  });
}

/** Tell the waiting SW to activate now, then reload to pick it up. */
export function applyServiceWorkerUpdate(registration: ServiceWorkerRegistration): void {
  registration.waiting?.postMessage("SKIP_WAITING");
  registration.waiting?.addEventListener("statechange", (e) => {
    if ((e.target as ServiceWorker).state === "activated") window.location.reload();
  });
}
