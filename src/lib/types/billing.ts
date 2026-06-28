// Visionex Billing & Credits System — TypeScript types

// ── Plans ─────────────────────────────────────────────────────────────────────

export type PlanId = "free_trial" | "basic" | "pro" | "enterprise";
export type SubscriptionStatus = "active" | "cancelled" | "expired" | "past_due";
export type TransactionType    = "earn" | "spend" | "refund" | "subscription_grant" | "admin_grant" | "purchase";
export type OperationType      = "tts" | "voice_cloning" | "text_to_video";
export type BillingMode        = "trial" | "credits" | "subscription";

export interface BillingPlan {
  id:                  PlanId;
  name:                string;
  description:         string | null;
  price_monthly_usd:   number;
  vx_credits_monthly:  number;
  is_unlimited:        boolean;
  features:            string[];
  limits:              Record<string, unknown>;
  is_active:           boolean;
  sort_order:          number;
}

// ── Wallet ────────────────────────────────────────────────────────────────────

export interface CreditWallet {
  user_id:              string;
  balance_vx:           number;
  lifetime_earned_vx:   number;
  lifetime_spent_vx:    number;
  updated_at:           string;
}

// ── Transactions ──────────────────────────────────────────────────────────────

export interface CreditTransaction {
  id:              string;
  user_id:         string;
  type:            TransactionType;
  amount_vx:       number;
  balance_after:   number;
  description:     string;
  operation_type:  OperationType | null;
  job_id:          string | null;
  project_id:      string | null;
  provider_slug:   string | null;
  idempotency_key: string | null;
  meta:            Record<string, unknown>;
  created_at:      string;
}

// ── Subscription ──────────────────────────────────────────────────────────────

export interface UserSubscription {
  id:                    string;
  user_id:               string;
  plan_id:               PlanId;
  status:                SubscriptionStatus;
  started_at:            string;
  ends_at:               string | null;
  cancelled_at:          string | null;
  next_renewal_at:       string | null;
  vx_credits_remaining:  number;
  vx_reset_at:           string | null;
  created_at:            string;
  updated_at:            string;
}

// ── Trial ─────────────────────────────────────────────────────────────────────

export interface TrialStatus {
  started_at:  string;
  ends_at:     string;
  is_active:   boolean;
  hours_left:  number;
}

// ── Billing status (aggregated response) ─────────────────────────────────────

export interface WalletInfo {
  balance_vx:           number;
  lifetime_earned_vx:   number;
  lifetime_spent_vx:    number;
}

export interface SubscriptionInfo {
  plan_id:               PlanId;
  plan_name:             string;
  status:                SubscriptionStatus;
  is_unlimited:          boolean;
  vx_credits_remaining:  number;
  vx_credits_monthly:    number;
  next_renewal_at:       string | null;
  features:              string[];
  limits:                Record<string, unknown>;
}

export interface UsageSummary {
  total_operations:    number;
  total_credits_spent: number;
  ops_last_24h:        number;
  ops_last_30d:        number;
}

export interface BillingStatus {
  trial:        TrialStatus | null;
  wallet:       WalletInfo;
  subscription: SubscriptionInfo | null;
  usage:        UsageSummary;
  can_generate: boolean;
}

// ── Usage log ─────────────────────────────────────────────────────────────────

export interface UsageLog {
  id:             string;
  user_id:        string;
  operation_type: OperationType;
  credits_used:   number;
  status:         "success" | "failed" | "refunded" | "blocked";
  provider_slug:  string | null;
  project_id:     string | null;
  job_id:         string | null;
  billing_mode:   BillingMode;
  plan_id:        PlanId | null;
  transaction_id: string | null;
  created_at:     string;
}

// ── Billing consume response ──────────────────────────────────────────────────

export interface BillingConsumeResult {
  ok:               boolean;
  billing_mode?:    BillingMode;
  credits_used?:    number;
  balance_after?:   number;
  transaction_id?:  string;
  trial_ends_at?:   string;
  already_processed?: boolean;
  // Error fields
  error?:           string;
  code?:            "INSUFFICIENT_CREDITS" | "NO_WALLET" | "TRIAL_EXPIRED" | "NO_ACCESS";
  balance?:         number;
  required?:        number;
  shortage?:        number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const VX_COSTS: Record<OperationType, number> = {
  tts:            100,
  voice_cloning:  500,
  text_to_video:  300,
};

export const OPERATION_LABELS: Record<OperationType, string> = {
  tts:            "Text to Speech",
  voice_cloning:  "Voice Cloning",
  text_to_video:  "Text to Video",
};

export const OPERATION_ICONS: Record<OperationType, string> = {
  tts:            "🎙️",
  voice_cloning:  "🧬",
  text_to_video:  "🎬",
};

export const TRANSACTION_LABELS: Record<TransactionType, string> = {
  earn:               "Credits Earned",
  spend:              "Credits Spent",
  refund:             "Refund",
  subscription_grant: "Subscription Credits",
  admin_grant:        "Admin Grant",
  purchase:           "Credit Purchase",
};

export const PLAN_COLORS: Record<PlanId, string> = {
  free_trial: "from-slate-500 to-slate-700",
  basic:      "from-blue-500 to-blue-700",
  pro:        "from-violet-500 to-purple-700",
  enterprise: "from-amber-500 to-orange-700",
};

export const PLAN_BADGE_COLORS: Record<PlanId, string> = {
  free_trial: "bg-slate-500/15 text-slate-400",
  basic:      "bg-blue-500/15 text-blue-400",
  pro:        "bg-violet-500/15 text-violet-400",
  enterprise: "bg-amber-500/15 text-amber-400",
};

export const TRIAL_DAYS = 5;
export const TRIAL_WARNING_HOURS = 24;
