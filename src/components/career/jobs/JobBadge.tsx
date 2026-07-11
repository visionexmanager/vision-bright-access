import { Globe, Building2, MapPin, BadgeCheck, Accessibility, Zap, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export type JobBadgeVariant = "remote" | "hybrid" | "onsite" | "visa" | "accessible" | "urgent" | "aiJob";

const BADGE_CONFIG: Record<JobBadgeVariant, { icon: LucideIcon; labelKey: string; className: string }> = {
  remote: { icon: Globe, labelKey: "careersPage.badge.remote", className: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  hybrid: { icon: Building2, labelKey: "careersPage.badge.hybrid", className: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  onsite: { icon: MapPin, labelKey: "careersPage.badge.onsite", className: "bg-slate-500/10 text-slate-600 dark:text-slate-300" },
  visa: { icon: BadgeCheck, labelKey: "careersPage.badge.visa", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  accessible: { icon: Accessibility, labelKey: "careersPage.badge.accessible", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  urgent: { icon: Zap, labelKey: "careersPage.badge.urgent", className: "bg-red-500/10 text-red-600 dark:text-red-400" },
  aiJob: { icon: Sparkles, labelKey: "careersPage.badge.aiJob", className: "bg-primary/10 text-primary" },
};

interface JobBadgeProps {
  variant: JobBadgeVariant;
}

export function JobBadge({ variant }: JobBadgeProps) {
  const { t } = useLanguage();
  const { icon: Icon, labelKey, className } = BADGE_CONFIG[variant];

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {t(labelKey)}
    </span>
  );
}
