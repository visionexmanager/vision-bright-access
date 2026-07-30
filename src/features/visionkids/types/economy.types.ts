export type PlanTier = "free" | "plus" | "premium" | "family" | "school" | "enterprise" | "ngo";
export type PlanAudience = "individual" | "family" | "school" | "ngo" | "enterprise";

export interface SubscriptionPlan {
  slug: string;
  name: string;
  tier: PlanTier;
  audience: PlanAudience;
  emoji: string;
  price_usd: number;
  period: "month" | "year" | "once";
  features: string[];
  color: "primary" | "secondary" | "accent" | "pink" | "green" | "purple";
  order_index: number;
  status: "published" | "draft";
  created_at: string;
}

export type SubscriptionStatus = "active" | "pending_parent" | "cancelled" | "expired";

export interface Subscription {
  id: string;
  user_id: string | null;
  org_id: string | null;
  plan_slug: string;
  status: SubscriptionStatus;
  provider: string;
  approved_by: string | null;
  started_at: string;
  renews_at: string | null;
  cancelled_at: string | null;
  created_at: string;
}

export interface Invoice {
  id: string;
  subscription_id: string | null;
  user_id: string | null;
  amount_usd: number;
  status: "issued" | "paid" | "void";
  issued_at: string;
}

export type RedeemableCategory = "theme" | "avatar" | "decoration" | "pet" | "skin" | "mission";

export interface Redeemable {
  slug: string;
  name: string;
  category: RedeemableCategory;
  emoji: string;
  cost_coins: number;
  color: "primary" | "secondary" | "accent" | "pink" | "green" | "purple";
  order_index: number;
  status: "published" | "draft";
  created_at: string;
}

export type GiftKind = "subscription" | "coins" | "book" | "course" | "certificate" | "bundle";

export interface Gift {
  id: string;
  from_id: string;
  to_id: string;
  kind: GiftKind;
  ref_slug: string | null;
  amount: number;
  message: string | null;
  status: "pending" | "claimed" | "cancelled";
  created_at: string;
  claimed_at: string | null;
}

export type DonationCause = "free_content" | "support_schools" | "children_in_need";

export interface Donation {
  id: string;
  donor_id: string;
  cause: DonationCause;
  amount_coins: number;
  created_at: string;
}

export type PartnerKind = "school" | "university" | "library" | "organization" | "publisher";

export interface Partner {
  slug: string;
  name: string;
  kind: PartnerKind;
  emoji: string;
  description: string | null;
  url: string | null;
  order_index: number;
  status: "published" | "draft";
  created_at: string;
}

export interface EconomySummary {
  coins: number;
  active_subscriptions: number;
  redemptions: number;
  pending_gifts: number;
  badges: number;
}

export interface FinancialReports {
  active_subscriptions: number;
  pending_subscriptions: number;
  cancelled_subscriptions: number;
  revenue_usd: number;
  donations_coins: number;
  creator_payouts_coins: number;
}

export interface SubscribeResult {
  id: string;
  status: SubscriptionStatus;
}
