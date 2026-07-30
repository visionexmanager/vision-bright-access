import type { Severity, ServiceStatus } from "@/features/visionkids/types/ops.types";

export type KidsColor = "primary" | "secondary" | "accent" | "pink" | "green" | "purple";

export const OPS_COLOR_CLASSES: Record<KidsColor, string> = {
  primary: "border-kids-primary/30 bg-kids-primary/10 text-kids-primary",
  secondary: "border-kids-secondary/30 bg-kids-secondary/10 text-kids-secondary",
  accent: "border-kids-accent/30 bg-kids-accent/10 text-kids-accent",
  pink: "border-kids-pink/30 bg-kids-pink/10 text-kids-pink",
  green: "border-kids-green/30 bg-kids-green/10 text-kids-green",
  purple: "border-kids-purple/30 bg-kids-purple/10 text-kids-purple",
};

export const SEVERITY_COLOR: Record<Severity, KidsColor> = {
  critical: "pink", major: "accent", minor: "secondary", info: "primary",
};

export const STATUS_COLOR: Record<ServiceStatus, KidsColor> = {
  operational: "green", degraded: "accent", down: "pink",
};

/** The Operations Dashboard sub-pages. */
export const OPS_SECTIONS: { id: string; emoji: string; to: string; labelKey: string }[] = [
  { id: "health", emoji: "💓", to: "/kids/ops/health", labelKey: "kids.ops.nav.health" },
  { id: "ai", emoji: "🤖", to: "/kids/ops/ai", labelKey: "kids.ops.nav.ai" },
  { id: "content", emoji: "🔍", to: "/kids/ops/content", labelKey: "kids.ops.nav.content" },
  { id: "accessibility", emoji: "♿", to: "/kids/ops/accessibility", labelKey: "kids.ops.nav.accessibility" },
  { id: "performance", emoji: "⚡", to: "/kids/ops/performance", labelKey: "kids.ops.nav.performance" },
  { id: "errors", emoji: "🐞", to: "/kids/ops/errors", labelKey: "kids.ops.nav.errors" },
  { id: "security", emoji: "🛡️", to: "/kids/ops/security", labelKey: "kids.ops.nav.security" },
  { id: "releases", emoji: "🚀", to: "/kids/ops/releases", labelKey: "kids.ops.nav.releases" },
  { id: "audit", emoji: "📒", to: "/kids/ops/audit", labelKey: "kids.ops.nav.audit" },
  { id: "testing", emoji: "🧪", to: "/kids/ops/testing", labelKey: "kids.ops.nav.testing" },
  { id: "logs", emoji: "📜", to: "/kids/ops/logs", labelKey: "kids.ops.nav.logs" },
  { id: "insights", emoji: "💡", to: "/kids/ops/insights", labelKey: "kids.ops.nav.insights" },
  { id: "incidents", emoji: "🚨", to: "/kids/ops/incidents", labelKey: "kids.ops.nav.incidents" },
  { id: "maintenance", emoji: "🛠️", to: "/kids/ops/maintenance", labelKey: "kids.ops.nav.maintenance" },
];

/** AI services monitored on the AI Monitoring page. */
export const AI_SERVICES = ["story", "image", "voice", "quiz", "recommendation", "search", "companion"] as const;

/** Content-review content kinds. */
export const REVIEW_KINDS = ["story", "game", "course", "video", "image", "audio", "project", "ai_generated"] as const;

/** Accessibility audit checks surfaced on the Accessibility Center. */
export const A11Y_CHECKS = ["wcag", "keyboard", "screenReaders", "contrast", "aria", "focus", "audioDesc", "captions"] as const;

/** Core Web Vitals + performance metrics. */
export const PERF_METRICS = ["lcp", "cls", "inp", "loadTime", "apiResponse", "dbPerf", "caching", "bundleSize"] as const;

/** Test suites on the Testing Center. */
export const TEST_SUITES = ["unit", "integration", "e2e", "accessibility", "performance", "security", "regression"] as const;

/** Security panels on the Security Center. */
export const SECURITY_PANELS = ["authentication", "authorization", "rateLimiting", "blocked", "suspicious", "permissionAudit"] as const;

/** AI Insights categories. */
export const INSIGHT_KINDS = ["slowFeatures", "unusedPages", "staleContent", "recurringIssues", "perfSuggestions"] as const;
