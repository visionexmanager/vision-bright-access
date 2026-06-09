import { Component, ReactNode } from "react";

// Checks error and its cause chain for chunk-load failures across all browsers.
function isChunkLoadError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { message?: string; name?: string; stack?: string; cause?: unknown };
  const text = `${e.message ?? ""} ${e.stack ?? ""}`;
  if (
    text.includes("Failed to fetch dynamically imported module") ||
    text.includes("Importing a module script failed") ||
    text.includes("Unable to preload CSS") ||
    e.name === "ChunkLoadError"
  ) return true;
  // Walk the cause chain (Firefox wraps errors)
  if (e.cause) return isChunkLoadError(e.cause);
  return false;
}

interface Props { children: ReactNode; resetKey?: string }
interface State { error: Error | null }

// ─── Global app-level error boundary ─────────────────────────────────────────
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prev: Props) {
    // Reset when the consumer changes resetKey (e.g. on navigation)
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            padding: "2rem",
            fontFamily: "system-ui, sans-serif",
            textAlign: "center",
            gap: "1rem",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Something went wrong</h1>
          <p style={{ color: "#666", maxWidth: 480 }}>
            The application encountered an unexpected error. Please refresh the page.
          </p>
          <pre
            aria-hidden="true"
            style={{
              background: "#f4f4f4",
              padding: "1rem",
              borderRadius: 8,
              fontSize: "0.75rem",
              maxWidth: 600,
              overflowX: "auto",
              textAlign: "left",
              color: "#c00",
            }}
          >
            {this.state.error.message}
          </pre>
          <div style={{ display: "flex", gap: "1rem" }}>
            <button
              onClick={() => window.location.href = "/"}
              style={{
                padding: "0.6rem 1.5rem",
                background: "#2563eb",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: "1rem",
              }}
            >
              Return to Home
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: "0.6rem 1.5rem",
                background: "#e5e7eb",
                color: "#111",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: "1rem",
              }}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Per-page error boundary (lighter, resets on navigation) ──────────────────
interface PageProps { children: ReactNode; routeKey: string }
interface PageState { error: Error | null; lastRouteKey: string }

export class PageErrorBoundary extends Component<PageProps, PageState> {
  state: PageState = { error: null, lastRouteKey: "" };

  static getDerivedStateFromError(error: Error): Partial<PageState> {
    return { error };
  }

  static getDerivedStateFromProps(
    props: PageProps,
    state: PageState
  ): Partial<PageState> | null {
    // Auto-reset when navigating to a new route
    if (props.routeKey !== state.lastRouteKey) {
      return { error: null, lastRouteKey: props.routeKey };
    }
    return null;
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    if (isChunkLoadError(error)) {
      // Stale deployment: old chunk URL no longer exists after a new build.
      // Use location.href for a true hard reload that bypasses the cache.
      const RELOAD_KEY = "vx_chunk_reload";
      if (!sessionStorage.getItem(RELOAD_KEY)) {
        sessionStorage.setItem(RELOAD_KEY, "1");
        window.location.href = window.location.href;
        return;
      }
      // Second failure after reload — clear the flag so future sessions can retry.
      sessionStorage.removeItem(RELOAD_KEY);
    }

    console.error("[PageErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      const chunkError = isChunkLoadError(this.state.error);

      return (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "60vh",
            padding: "2rem",
            fontFamily: "system-ui, sans-serif",
            textAlign: "center",
            gap: "1rem",
          }}
        >
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700 }}>
            {chunkError ? "Updating…" : "This page encountered an error"}
          </h2>
          <p style={{ color: "#666", maxWidth: 400, fontSize: "0.9rem" }}>
            {chunkError
              ? "A new version of the app was deployed. Reloading…"
              : this.state.error.message}
          </p>
          <div style={{ display: "flex", gap: "1rem" }}>
            <button
              onClick={() => { sessionStorage.removeItem("vx_chunk_reload"); window.location.href = "/"; }}
              style={{
                padding: "0.5rem 1.25rem",
                background: "#2563eb",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: "0.9rem",
              }}
            >
              Home
            </button>
            <button
              onClick={() => { sessionStorage.removeItem("vx_chunk_reload"); window.location.reload(); }}
              style={{
                padding: "0.5rem 1.25rem",
                background: "#e5e7eb",
                color: "#111",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: "0.9rem",
              }}
            >
              {chunkError ? "Reload now" : "Try again"}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
