import { Link } from "react-router-dom";
import { Users, GraduationCap, BookOpen, ClipboardList, Percent, Award } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useSchoolDashboard } from "@/features/visionkids/hooks/enterprise/useEnterprise";
import { useCurrentOrg } from "@/features/visionkids/hooks/enterprise/useCurrentOrg";
import { ENTERPRISE_SECTIONS } from "@/features/visionkids/data/enterpriseConfig";
import { EnterpriseHeader, NoOrgPrompt } from "@/features/visionkids/components/enterprise/EnterpriseHeader";

export default function SchoolDashboard() {
  const { t } = useLanguage();
  const { orgId, org, isStaff } = useCurrentOrg();
  const { data: stats } = useSchoolDashboard(isStaff ? orgId ?? undefined : undefined);

  useDocumentHead({
    title: `${t("kids.enterprise.nav.dashboard")} — VisionKids`,
    description: t("kids.enterprise.dashboard.subtitle"),
    canonicalPath: "/kids/enterprise/dashboard",
  });

  const tiles = stats
    ? [
        { icon: Users, label: t("kids.enterprise.stat.students"), value: stats.students },
        { icon: GraduationCap, label: t("kids.enterprise.stat.teachers"), value: stats.teachers },
        { icon: BookOpen, label: t("kids.enterprise.stat.classes"), value: stats.classes },
        { icon: ClipboardList, label: t("kids.enterprise.stat.assignments"), value: stats.assignments },
        { icon: Percent, label: t("kids.enterprise.stat.attendance"), value: `${stats.attendance_rate}%` },
        { icon: Award, label: t("kids.enterprise.stat.avgMarks"), value: stats.avg_marks },
      ]
    : [];

  const sections = ENTERPRISE_SECTIONS.filter((s) => !s.staffOnly || isStaff);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <EnterpriseHeader emoji="🏫" title={org?.name ?? t("kids.enterprise.nav.dashboard")} subtitle={t("kids.enterprise.dashboard.subtitle")} />

      {!orgId ? (
        <NoOrgPrompt />
      ) : (
        <>
          {isStaff && stats && (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {tiles.map((tile) => (
                <div key={tile.label} className="flex flex-col items-center gap-1 rounded-2xl border-2 border-border bg-card p-4 text-center">
                  <tile.icon className="h-6 w-6 text-kids-primary" aria-hidden="true" />
                  <span className="font-heading text-xl font-extrabold">{tile.value}</span>
                  <span className="text-[10px] font-semibold text-muted-foreground">{tile.label}</span>
                </div>
              ))}
            </div>
          )}

          <nav aria-label={t("kids.enterprise.dashboard.manage")} className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {sections.map((s) => (
              <Link key={s.id} to={s.to} className="flex flex-col items-center gap-1.5 rounded-2xl border-2 border-border bg-card p-4 text-center transition-transform hover:scale-[1.03] hover:border-kids-primary/50">
                <span className="text-3xl" aria-hidden="true">{s.emoji}</span>
                <span className="text-sm font-bold">{t(s.labelKey)}</span>
              </Link>
            ))}
          </nav>
        </>
      )}
    </div>
  );
}
