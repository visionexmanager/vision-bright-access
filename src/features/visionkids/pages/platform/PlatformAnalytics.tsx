import { Activity, Gauge, GraduationCap, Heart, Repeat, Trophy } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { usePoints } from "@/hooks/usePoints";
import { usePlatformStats } from "@/features/visionkids/hooks/platform/usePlatform";
import { PlatformHeader } from "@/features/visionkids/components/platform/PlatformHeader";

const CATEGORIES = [
  { icon: Activity, key: "usage" },
  { icon: Gauge, key: "performance" },
  { icon: GraduationCap, key: "learning" },
  { icon: Heart, key: "engagement" },
  { icon: Repeat, key: "retention" },
  { icon: Trophy, key: "achievements" },
];

export default function PlatformAnalytics() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { totalPoints } = usePoints();
  const { data: stats } = usePlatformStats();

  useDocumentHead({
    title: `${t("kids.platform.nav.analytics")} — VisionKids`,
    description: t("kids.platform.analytics.subtitle"),
    canonicalPath: "/kids/platform/analytics",
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <PlatformHeader emoji="📊" title={t("kids.platform.nav.analytics")} subtitle={t("kids.platform.analytics.subtitle")} />

      {user && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border-2 border-border bg-card p-4 text-center">
            <p className="font-heading text-2xl font-extrabold text-kids-primary">{totalPoints.toLocaleString()}</p>
            <p className="text-xs font-semibold text-muted-foreground">{t("kids.platform.analytics.totalXp")}</p>
          </div>
          <div className="rounded-2xl border-2 border-border bg-card p-4 text-center">
            <p className="font-heading text-2xl font-extrabold">{stats?.installed ?? 0}</p>
            <p className="text-xs font-semibold text-muted-foreground">{t("kids.platform.installedPlugins")}</p>
          </div>
          <div className="rounded-2xl border-2 border-border bg-card p-4 text-center">
            <p className="font-heading text-2xl font-extrabold">{stats?.widgets ?? 0}</p>
            <p className="text-xs font-semibold text-muted-foreground">{t("kids.platform.myWidgets")}</p>
          </div>
          <div className="rounded-2xl border-2 border-border bg-card p-4 text-center">
            <p className="font-heading text-2xl font-extrabold text-kids-pink">{stats?.unread ?? 0}</p>
            <p className="text-xs font-semibold text-muted-foreground">{t("kids.platform.unread")}</p>
          </div>
        </div>
      )}

      <section className="mt-8">
        <h2 className="font-heading text-lg font-bold">{t("kids.platform.analytics.whatWeTrack")}</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map(({ icon: Icon, key }) => (
            <div key={key} className="flex items-start gap-3 rounded-2xl border-2 border-border bg-card p-4">
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-kids-primary" aria-hidden="true" />
              <div>
                <p className="font-heading text-sm font-bold">{t(`kids.platform.analytics.cat.${key}.title`)}</p>
                <p className="text-sm text-muted-foreground">{t(`kids.platform.analytics.cat.${key}.desc`)}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">🔒 {t("kids.platform.analytics.privacyNote")}</p>
      </section>
    </div>
  );
}
