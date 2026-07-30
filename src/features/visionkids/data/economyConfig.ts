import type { KidsColor } from "@/features/visionkids/types/stem.types";
import type { RedeemableCategory, DonationCause, GiftKind } from "@/features/visionkids/types/economy.types";

export const ECON_COLOR_CLASSES: Record<KidsColor, string> = {
  primary: "border-kids-primary/30 bg-kids-primary/10 text-kids-primary",
  secondary: "border-kids-secondary/30 bg-kids-secondary/10 text-kids-secondary",
  accent: "border-kids-accent/30 bg-kids-accent/10 text-kids-accent",
  pink: "border-kids-pink/30 bg-kids-pink/10 text-kids-pink",
  green: "border-kids-green/30 bg-kids-green/10 text-kids-green",
  purple: "border-kids-purple/30 bg-kids-purple/10 text-kids-purple",
};

export const REDEEM_CATEGORIES: (RedeemableCategory | "all")[] = [
  "all", "theme", "avatar", "decoration", "pet", "skin", "mission",
];

export const DONATION_CAUSES: { cause: DonationCause; emoji: string }[] = [
  { cause: "free_content", emoji: "📚" },
  { cause: "support_schools", emoji: "🏫" },
  { cause: "children_in_need", emoji: "💛" },
];

export const DONATION_AMOUNTS = [100, 250, 500, 1000];

export const GIFT_KINDS: { kind: GiftKind; emoji: string }[] = [
  { kind: "subscription", emoji: "⭐" },
  { kind: "coins", emoji: "🪙" },
  { kind: "book", emoji: "📕" },
  { kind: "course", emoji: "🎓" },
  { kind: "certificate", emoji: "📜" },
  { kind: "bundle", emoji: "🎁" },
];

/** How coins are earned (Rewards Center — informational, links to features). */
export const EARN_WAYS: { key: string; emoji: string; to: string }[] = [
  { key: "learning", emoji: "🎓", to: "/kids/academy" },
  { key: "reading", emoji: "📖", to: "/kids/stories" },
  { key: "quizzes", emoji: "🧠", to: "/kids/stem" },
  { key: "events", emoji: "🎪", to: "/kids/events" },
  { key: "contests", emoji: "🏆", to: "/kids/stem/innovation" },
  { key: "dailyMissions", emoji: "🎯", to: "/kids/health/challenges" },
];

/** The Economy Center sub-pages (home grid). */
export const ECONOMY_SECTIONS: { id: string; emoji: string; to: string; labelKey: string }[] = [
  { id: "plans", emoji: "⭐", to: "/kids/economy/plans", labelKey: "kids.economy.nav.plans" },
  { id: "wallet", emoji: "🪙", to: "/kids/economy/wallet", labelKey: "kids.economy.nav.wallet" },
  { id: "rewards", emoji: "🎁", to: "/kids/economy/rewards", labelKey: "kids.economy.nav.rewards" },
  { id: "redeem", emoji: "🎟️", to: "/kids/economy/redeem", labelKey: "kids.economy.nav.redeem" },
  { id: "gifts", emoji: "💝", to: "/kids/economy/gifts", labelKey: "kids.economy.nav.gifts" },
  { id: "subscriptions", emoji: "🔄", to: "/kids/economy/subscriptions", labelKey: "kids.economy.nav.subscriptions" },
  { id: "invoices", emoji: "🧾", to: "/kids/economy/invoices", labelKey: "kids.economy.nav.invoices" },
  { id: "donate", emoji: "💛", to: "/kids/economy/donate", labelKey: "kids.economy.nav.donate" },
  { id: "partners", emoji: "🤝", to: "/kids/economy/partners", labelKey: "kids.economy.nav.partners" },
  { id: "family", emoji: "👨‍👩‍👧", to: "/kids/economy/family-plans", labelKey: "kids.economy.nav.familyPlans" },
  { id: "school", emoji: "🏫", to: "/kids/economy/school-plans", labelKey: "kids.economy.nav.schoolPlans" },
  { id: "ngo", emoji: "🌍", to: "/kids/economy/ngo-plans", labelKey: "kids.economy.nav.ngoPlans" },
  { id: "creator", emoji: "💰", to: "/kids/economy/creator-revenue", labelKey: "kids.economy.nav.creatorRevenue" },
  { id: "reports", emoji: "📊", to: "/kids/economy/reports", labelKey: "kids.economy.nav.reports" },
];
