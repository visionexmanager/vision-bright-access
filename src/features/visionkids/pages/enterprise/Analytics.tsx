import { Percent, FileCheck2, ClipboardCheck, Award, BookOpen, GraduationCap } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useOrgAnalytics } from "@/features/visionkids/hooks/enterprise/useEnterprise";
import { useCurrentOrg } from "@/features/visionkids/hooks/enterprise/useCurrentOrg";
import { EnterpriseHeader, NoOrgPrompt } from "@/features/visionkids/components/enterprise/EnterpriseHeader";

export default function Analytics() {
  const { t } = useLanguage();
  const { orgId, isStaff } = useCurrentOrg();
  const { data } = useOrgAnalytics(isStaff ? orgId ?? undefined : undefined);

  useDocumentHead({
    title: `${t("kids.enterprise.nav.analytics")} — VisionKids`,
    description: t("kids.enterprise.analytics.subtitle"),
    canonicalPath: "/kids/enterprise/analytics",
  });

  const tiles = data
    ? [
        { icon: Percent, label: t("kids.enterprise.analytics.attendance30"), value: `${data.attendance_rate_30d}%` },
        { icon: FileCheck2, label: t("kids.enterprise.analytics.submissions"), value: data.submissions },
        { icon: ClipboardCheck, label: t("kids.enterprise.analytics.graded"), value: data.graded },
        { icon: GraduationCap, label: t("kids.enterprise.analytics.avgMarks"), value: data.avg_marks },
        { icon: Award, label: t("kids.enterprise.analytics.certificates"), value: data.certificates },
        { icon: BookOpen, label: t("kids.enterprise.analytics.resources"), value: data.resources },
      ]
    : [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <EnterpriseHeader emoji="📊" title={t("kids.enterprise.nav.analytics")} subtitle={t("kids.enterprise.analytics.subtitle")} />

      {!orgId ? (
        <NoOrgPrompt />
      ) : !isStaff ? (
        <p className="mt-8 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.enterprise.staffOnly")}</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {tiles.map((tile) => (
            <div key={tile.label} className="flex flex-col items-center gap-1 rounded-2xl border-2 border-border bg-card p-5 text-center">
              <tile.icon className="h-7 w-7 text-kids-primary" aria-hidden="true" />
              <span className="font-heading text-2xl font-extrabold">{tile.value}</span>
              <span className="text-xs font-semibold text-muted-foreground">{tile.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
