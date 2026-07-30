import { User, Users, School, Building2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useSchoolDashboard } from "@/features/visionkids/hooks/enterprise/useEnterprise";
import { useCurrentOrg } from "@/features/visionkids/hooks/enterprise/useCurrentOrg";
import { EnterpriseHeader, NoOrgPrompt } from "@/features/visionkids/components/enterprise/EnterpriseHeader";

const SCOPES = [
  { icon: User, key: "student" },
  { icon: Users, key: "class" },
  { icon: School, key: "school" },
  { icon: Building2, key: "org" },
];

export default function Reports() {
  const { t } = useLanguage();
  const { orgId, isStaff } = useCurrentOrg();
  const { data: stats } = useSchoolDashboard(isStaff ? orgId ?? undefined : undefined);

  useDocumentHead({
    title: `${t("kids.enterprise.nav.reports")} — VisionKids`,
    description: t("kids.enterprise.reports.subtitle"),
    canonicalPath: "/kids/enterprise/reports",
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <EnterpriseHeader emoji="📈" title={t("kids.enterprise.nav.reports")} subtitle={t("kids.enterprise.reports.subtitle")} />

      {!orgId ? (
        <NoOrgPrompt />
      ) : (
        <>
          {isStaff && stats && (
            <div className="mt-6 rounded-2xl border-2 border-border bg-card p-5">
              <h2 className="font-heading text-lg font-bold">{t("kids.enterprise.reports.schoolSnapshot")}</h2>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <p className="text-sm"><span className="font-heading text-xl font-extrabold">{stats.students}</span><br />{t("kids.enterprise.stat.students")}</p>
                <p className="text-sm"><span className="font-heading text-xl font-extrabold">{stats.classes}</span><br />{t("kids.enterprise.stat.classes")}</p>
                <p className="text-sm"><span className="font-heading text-xl font-extrabold">{stats.attendance_rate}%</span><br />{t("kids.enterprise.stat.attendance")}</p>
                <p className="text-sm"><span className="font-heading text-xl font-extrabold">{stats.avg_marks}</span><br />{t("kids.enterprise.stat.avgMarks")}</p>
              </div>
            </div>
          )}

          <section className="mt-8">
            <h2 className="font-heading text-lg font-bold">{t("kids.enterprise.reports.scopes")}</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {SCOPES.map(({ icon: Icon, key }) => (
                <div key={key} className="flex items-start gap-3 rounded-2xl border-2 border-border bg-card p-4">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-kids-primary" aria-hidden="true" />
                  <div>
                    <p className="font-heading text-sm font-bold">{t(`kids.enterprise.reports.scope.${key}.title`)}</p>
                    <p className="text-sm text-muted-foreground">{t(`kids.enterprise.reports.scope.${key}.desc`)}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
