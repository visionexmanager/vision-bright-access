import { Component, ReactNode } from "react";

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
    console.error("[PageErrorBoundary]", error, info.componentStack);
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
            minHeight: "60vh",
            padding: "2rem",
            fontFamily: "system-ui, sans-serif",
            textAlign: "center",
            gap: "1rem",
          }}
        >
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700 }}>
            This page encountered an error
          </h2>
          <p style={{ color: "#666", maxWidth: 400, fontSize: "0.9rem" }}>
            {this.state.error.message}
          </p>
          <div style={{ display: "flex", gap: "1rem" }}>
            <button
              onClick={() => window.location.href = "/"}
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
              onClick={() => this.setState({ error: null })}
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
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
