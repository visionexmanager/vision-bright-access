import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, Lock } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useIsAdmin } from "@/features/visionkids/hooks/ops/useOps";

export function OpsHeader({
  emoji,
  title,
  subtitle,
  backTo = "/kids/ops",
  backLabelKey = "kids.ops.heroTitle",
}: {
  emoji: string;
  title: string;
  subtitle?: string;
  backTo?: string;
  backLabelKey?: string;
}) {
  const { t } = useLanguage();
  return (
    <div>
      <Link to={backTo} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" /> {t(backLabelKey)}
      </Link>
      <h1 className="font-heading text-3xl font-extrabold sm:text-4xl">
        <span aria-hidden="true">{emoji}</span> {title}
      </h1>
      {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

/** Gates ops pages to admins. Shows a friendly lock screen to everyone else. */
export function AdminGate({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const { data: isAdmin, isLoading } = useIsAdmin();

  if (isLoading) return <div className="mt-8 h-40 animate-pulse rounded-3xl bg-muted" aria-busy="true" />;
  if (!isAdmin) {
    return (
      <div className="mt-8 rounded-2xl border-2 border-dashed border-border p-8 text-center">
        <Lock className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden="true" />
        <p className="mt-2 font-heading text-lg font-bold">{t("kids.ops.adminOnly")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("kids.ops.adminOnlyHint")}</p>
      </div>
    );
  }
  return <>{children}</>;
}

/** A note that a metric needs a real monitoring integration (honest labelling). */
export function IntegrationNote({ textKey }: { textKey: string }) {
  const { t } = useLanguage();
  return <p className="mt-4 rounded-xl border-2 border-dashed border-border bg-card p-3 text-xs text-muted-foreground">🔌 {t(textKey)}</p>;
}
