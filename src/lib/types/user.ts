/**
 * User / Profile — TypeScript Types
 * Shared user types used across the platform.
 */

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email?: string;
  user_metadata?: {
    display_name?: string;
    full_name?: string;
    avatar_url?: string;
  };
}

// ── Profile ───────────────────────────────────────────────────────────────────

export interface ProfileRow {
  user_id: string;
  display_name: string | null;
  trial_expires_at: string | null;
  trial_billing_warned_at: string | null;
  trial_billing_processed_at: string | null;
}

// ── Points ────────────────────────────────────────────────────────────────────

export interface UserPointsRow {
  id: string;
  user_id: string;
  points: number;
  reason: string;
  created_at: string;
}

export interface PointsState {
  totalPoints: number;
  history: UserPointsRow[];
  loadingTotal: boolean;
  loadingHistory: boolean;
}

// ── Trial ─────────────────────────────────────────────────────────────────────

export interface TrialState {
  isActive: boolean;
  daysRemaining: number;
  expiresAt: string | null;
}
