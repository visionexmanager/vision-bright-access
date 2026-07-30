import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BarChart3, Clock, BookOpen, GraduationCap, Gamepad2, Palette, Award, Trophy, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useMyChildren } from "@/features/visionkids/hooks/academy/useAcademyParent";
import { useProfiles } from "@/features/visionkids/hooks/social/useFriends";
import { useParentDashboardStats } from "@/features/visionkids/hooks/social/useParentDashboard";
import { computeRecommendations } from "@/features/visionkids/services/social/parentDashboard";
import { ChildSwitcher } from "@/features/visionkids/components/social/ChildSwitcher";

function StatCard({ icon: Icon, value, labelKey }: { icon: typeof Clock; value: string | number; labelKey: string }) {
  const { t } = useLanguage();
  return (
    <div className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-4">
      <Icon className="h-6 w-6 shrink-0 text-kids-primary" aria-hidden="true" />
      <div>
        <p className="font-heading text-xl font-extrabold">{value}</p>
        <p className="text-xs text-muted-foreground">{t(labelKey)}</p>
      </div>
    </div>
  );
}

export default function ParentsDashboard() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const selectedChildId = params.get("child") ?? undefined;

  const { data: children = [] } = useMyChildren();
  const childIds = children.map((c) => c.child_user_id);
  const { data: profiles = [] } = useProfiles(childIds);

  useEffect(() => {
    if (!selectedChildId && childIds.length > 0) setParams({ child: childIds[0] }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childIds.length]);

  const { data: stats } = useParentDashboardStats(selectedChildId);

  useDocumentHead({ title: `${t("kids.social.parents.dashboardTitle")} — VisionKids`, description: t("kids.social.meta.description"), canonicalPath: "/kids/social/parents/dashboard" });

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-lg font-semibold">{t("kids.stories.signInRequired")}</p>
        <Link to="/login" className="mt-2 inline-block text-kids-primary hover:underline">{t("nav.login")}</Link>
      </div>
    );
  }

  if (childIds.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-lg font-semibold">{t("kids.social.parents.noChildrenLinked")}</p>
        <Link to="/kids/social/parents/family" className="mt-2 inline-block text-kids-primary hover:underline">{t("kids.social.family.title")}</Link>
      </div>
    );
  }

  const recommendations = stats ? computeRecommendations(stats) : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 font-heading text-3xl font-extrabold">
          <BarChart3 className="h-7 w-7 text-kids-primary" aria-hidden="true" /> {t("kids.social.parents.dashboardTitle")}
        </h1>
        <ChildSwitcher childUserIds={childIds} profiles={profiles} selectedChildId={selectedChildId} onSelect={(id) => setParams({ child: id })} />
      </div>

      {stats && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard icon={Clock} value={`${stats.usageMinutesToday}m`} labelKey="kids.social.parents.stat.usageToday" />
            <StatCard icon={GraduationCap} value={`${stats.learningMinutes7d}m`} labelKey="kids.social.parents.stat.learningTime" />
            <StatCard icon={Gamepad2} value={`${stats.playMinutes7d}m`} labelKey="kids.social.parents.stat.playTime" />
            <StatCard icon={BookOpen} value={stats.storiesRead} labelKey="kids.social.parents.stat.storiesRead" />
            <StatCard icon={GraduationCap} value={stats.lessonsCompleted} labelKey="kids.social.parents.stat.lessonsCompleted" />
            <StatCard icon={Gamepad2} value={stats.gamesPlayed} labelKey="kids.social.parents.stat.gamesPlayed" />
            <StatCard icon={Palette} value={stats.creativeProjects} labelKey="kids.social.parents.stat.creativeProjects" />
            <StatCard icon={Award} value={stats.achievementsEarned} labelKey="kids.social.parents.stat.achievements" />
            <StatCard icon={Trophy} value={stats.challengesCompleted} labelKey="kids.social.parents.stat.challenges" />
          </div>

          <h2 className="mt-8 flex items-center gap-2 font-heading text-lg font-bold"><Sparkles className="h-5 w-5 text-kids-accent" aria-hidden="true" /> {t("kids.social.parents.recommendations")}</h2>
          <div className="mt-3 flex flex-col gap-2">
            {recommendations.map((r) => (
              <Link key={r.key} to={r.href} className="rounded-xl border-2 border-border bg-card p-3 text-sm font-semibold hover:border-kids-primary/50">
                {t(r.titleKey)}
              </Link>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Link to={`/kids/social/parents/timeline?child=${selectedChildId}`} className="text-sm font-semibold text-kids-primary hover:underline">{t("kids.social.parents.viewTimeline")}</Link>
            <span className="text-muted-foreground">·</span>
            <Link to={`/kids/social/parents/settings?child=${selectedChildId}`} className="text-sm font-semibold text-kids-primary hover:underline">{t("kids.social.parents.viewSettings")}</Link>
          </div>
        </>
      )}
    </div>
  );
}
