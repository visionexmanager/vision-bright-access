/**
 * AuthGuard — Protects routes that require authentication.
 *
 * Behavior:
 *   - Loading → shows spinner
 *   - Not authenticated → redirects to /login?returnTo={currentPath}
 *   - Authenticated → renders children
 *
 * Usage:
 *   <Route path="/academy" element={<AuthGuard><Academy /></AuthGuard>} />
 */

import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading } = useAuth();
  const location          = useLocation();

  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        role="status"
        aria-label="Loading..."
      >
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    // Preserve the intended destination so login can redirect back
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }

  return <>{children}</>;
}
