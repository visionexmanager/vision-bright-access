import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCurrentOrg } from "@/features/visionkids/hooks/enterprise/useCurrentOrg";

/** Shared header for Enterprise sub-pages, with an inline org switcher so the
 *  active tenant is always visible and changeable. */
export function EnterpriseHeader({
  emoji,
  title,
  subtitle,
  backTo = "/kids/enterprise",
  backLabelKey = "kids.enterprise.heroTitle",
  showSwitcher = true,
}: {
  emoji: string;
  title: string;
  subtitle?: string;
  backTo?: string;
  backLabelKey?: string;
  showSwitcher?: boolean;
}) {
  const { t } = useLanguage();
  const { memberships, orgId, setOrgId } = useCurrentOrg();

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Link to={backTo} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" /> {t(backLabelKey)}
        </Link>
        {showSwitcher && memberships.length > 0 && (
          <select value={orgId ?? ""} onChange={(e) => setOrgId(e.target.value)} aria-label={t("kids.enterprise.switchOrg")}
            className="rounded-xl border-2 border-border bg-background px-3 py-1.5 text-sm font-semibold">
            {memberships.map((m) => (
              <option key={m.org_id} value={m.org_id}>{m.organization?.name ?? m.org_id}</option>
            ))}
          </select>
        )}
      </div>
      <h1 className="font-heading text-3xl font-extrabold sm:text-4xl">
        <span aria-hidden="true">{emoji}</span> {title}
      </h1>
      {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

/** Shown when the caller has no org selected/joined. */
export function NoOrgPrompt() {
  const { t } = useLanguage();
  return (
    <div className="mt-8 rounded-2xl border-2 border-dashed border-border p-6 text-center">
      <p className="text-muted-foreground">{t("kids.enterprise.noOrg")}</p>
      <Link to="/kids/enterprise/schools" className="mt-3 inline-block rounded-full bg-kids-primary px-5 py-2 font-bold text-white hover:opacity-90">
        {t("kids.enterprise.goToPortal")}
      </Link>
    </div>
  );
}
