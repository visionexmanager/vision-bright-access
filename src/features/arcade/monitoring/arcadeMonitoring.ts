type MonitorKind = "runtime_error" | "failed_request" | "broken_asset" | "slow_operation";
type MonitorEvent = { kind: MonitorKind; message: string; route: string; at: string; durationMs?: number };
const KEY = "visionex-arcade-monitor-v1";

function save(event: MonitorEvent) {
  try {
    const current = JSON.parse(localStorage.getItem(KEY) ?? "[]") as MonitorEvent[];
    localStorage.setItem(KEY, JSON.stringify([...current.slice(-99), event]));
  } catch { /* monitoring must never interrupt gameplay */ }
}

export function installArcadeMonitoring() {
  const isArcade = () => location.pathname.startsWith("/games");
  window.addEventListener("error", (event) => {
    if (!isArcade()) return;
    const target = event.target as HTMLElement | null;
    save({ kind: target && (target.tagName === "IMG" || target.tagName === "AUDIO") ? "broken_asset" : "runtime_error", message: event.message || target?.getAttribute("src") || "Unknown error", route: location.pathname, at: new Date().toISOString() });
  }, true);
  window.addEventListener("unhandledrejection", (event) => {
    if (isArcade()) save({ kind: "failed_request", message: String(event.reason?.message ?? event.reason ?? "Rejected request"), route: location.pathname, at: new Date().toISOString() });
  });
  if ("PerformanceObserver" in window) {
    const observer = new PerformanceObserver((list) => list.getEntries().filter((entry) => entry.duration > 200).forEach((entry) => save({ kind:"slow_operation", message:entry.name, durationMs:Math.round(entry.duration), route:location.pathname, at:new Date().toISOString() })));
    try { observer.observe({ type:"longtask", buffered:true }); } catch { /* unsupported entry type */ }
  }
}

export function readArcadeMonitorEvents(): MonitorEvent[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]") as MonitorEvent[]; } catch { return []; }
}
