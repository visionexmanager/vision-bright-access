import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, BarChart3, Users, TrendingUp, Flame, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getAcademyLevelInfo } from "@/lib/academy/leveling";
import { useLanguage } from "@/contexts/LanguageContext";

type ProfileRow = { xp_total: number; level: string; country: string; last_active: string; created_at: string };
type XPEventRow = { reason: string; amount: number; created_at: string };

const REASON_LABEL_KEY: Record<string, string> = {
  academy_message_sent: "admin.academyAnalytics.reason.messageSent",
  academy_aptitude_completed: "admin.academyAnalytics.reason.aptitudeCompleted",
  academy_streak: "admin.academyAnalytics.reason.streak",
  academy_scan_used: "admin.academyAnalytics.reason.scanUsed",
  academy_study_room: "admin.academyAnalytics.reason.studyRoom",
  academy_daily_login: "admin.academyAnalytics.reason.dailyLogin",
  academy_lesson_completed: "admin.academyAnalytics.reason.lessonCompleted",
  academy_module_completed: "admin.academyAnalytics.reason.moduleCompleted",
  academy_course_completed: "admin.academyAnalytics.reason.courseCompleted",
  academy_quiz_passed: "admin.academyAnalytics.reason.quizPassed",
  academy_perfect_quiz: "admin.academyAnalytics.reason.perfectQuiz",
  academy_final_exam_passed: "admin.academyAnalytics.reason.finalExamPassed",
  academy_certificate_earned: "admin.academyAnalytics.reason.certificateEarned",
  academy_project_completed: "admin.academyAnalytics.reason.projectCompleted",
  academy_weekly_goal: "admin.academyAnalytics.reason.weeklyGoal",
  academy_monthly_goal: "admin.academyAnalytics.reason.monthlyGoal",
  academy_streak_milestone: "admin.academyAnalytics.reason.streakMilestone",
  academy_community_contribution: "admin.academyAnalytics.reason.communityContribution",
  academy_instructor_recognition: "admin.academyAnalytics.reason.instructorRecognition",
};

function StatCard({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
      </CardHeader>
      <CardContent><p className="text-3xl font-bold">{value}</p></CardContent>
    </Card>
  );
}

export default function AdminAcademyAnalytics() {
  const { t } = useLanguage();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [xpEvents, setXpEvents] = useState<XPEventRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const [p, x] = await Promise.all([
        (supabase.from("academy_profiles") as any).select("xp_total, level, country, last_active, created_at").limit(5000),
        (supabase.from("academy_xp_events") as any).select("reason, amount, created_at").order("created_at", { ascending: false }).limit(5000),
      ]);
      if (p.data) setProfiles(p.data as ProfileRow[]);
      if (x.data) setXpEvents(x.data as XPEventRow[]);
      setIsLoading(false);
    };
    load();
  }, []);

  const totalStudents = profiles.length;
  const avgXp = totalStudents > 0 ? Math.round(profiles.reduce((s, p) => s + p.xp_total, 0) / totalStudents) : 0;
  const sevenDaysAgo = Date.now() - 7 * 86400000;
  const activeThisWeek = profiles.filter((p) => new Date(p.last_active).getTime() >= sevenDaysAgo).length;
  const newThisWeek = profiles.filter((p) => new Date(p.created_at).getTime() >= sevenDaysAgo).length;

  const levelDistribution = useMemo(() => {
    const buckets: Record<number, number> = {};
    for (const p of profiles) {
      const lvl = getAcademyLevelInfo(p.xp_total).level;
      const bucket = Math.floor((lvl - 1) / 5) * 5 + 1; // group into 1-5, 6-10, ...
      buckets[bucket] = (buckets[bucket] ?? 0) + 1;
    }
    return Object.entries(buckets).map(([start, count]) => ({ label: `${start}-${Number(start) + 4}`, count })).sort((a, b) => Number(a.label.split("-")[0]) - Number(b.label.split("-")[0]));
  }, [profiles]);

  const reasonBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of xpEvents) map[e.reason] = (map[e.reason] ?? 0) + 1;
    return Object.entries(map).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);
  }, [xpEvents]);

  const maxReasonCount = Math.max(1, ...reasonBreakdown.map((r) => r.count));
  const maxLevelCount = Math.max(1, ...levelDistribution.map((l) => l.count));

  return (
    <Layout>
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex items-center gap-3">
          <Button asChild variant="ghost" size="icon"><Link to="/admin/academy" aria-label={t("admin.academyAnalytics.back")}><ArrowLeft className="h-5 w-5" aria-hidden="true" /></Link></Button>
          <BarChart3 className="h-6 w-6 text-cyan-500" aria-hidden="true" />
          <div>
            <h1 className="text-3xl font-bold">{t("admin.academyAnalytics.title")}</h1>
            <p className="text-muted-foreground text-sm">{t("admin.academyAnalytics.subtitle")}</p>
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t("admin.academyAnalytics.loading")}</p>
        ) : (
          <div className="space-y-8">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard icon={Users} label={t("admin.academyAnalytics.stat.totalStudents")} value={totalStudents.toLocaleString()} />
              <StatCard icon={TrendingUp} label={t("admin.academyAnalytics.stat.avgXp")} value={avgXp.toLocaleString()} />
              <StatCard icon={Flame} label={t("admin.academyAnalytics.stat.activeThisWeek")} value={activeThisWeek.toLocaleString()} />
              <StatCard icon={Users} label={t("admin.academyAnalytics.stat.newThisWeek")} value={newThisWeek.toLocaleString()} />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="bg-card p-6 rounded-2xl border border-border space-y-3">
                <h2 className="text-sm font-bold text-foreground">{t("admin.academyAnalytics.levelDistribution.title")}</h2>
                {levelDistribution.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("admin.academyAnalytics.noData")}</p>
                ) : (
                  <ul className="space-y-2">
                    {levelDistribution.map((l) => (
                      <li key={l.label} className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground"><span>{t("admin.academyAnalytics.levelDistribution.levelPrefix")} {l.label}</span><span>{l.count}</span></div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary" style={{ width: `${(l.count / maxLevelCount) * 100}%` }} /></div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="bg-card p-6 rounded-2xl border border-border space-y-3">
                <h2 className="text-sm font-bold text-foreground">{t("admin.academyAnalytics.trends.title")}</h2>
                {reasonBreakdown.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("admin.academyAnalytics.noData")}</p>
                ) : (
                  <ul className="space-y-2">
                    {reasonBreakdown.slice(0, 10).map((r) => (
                      <li key={r.reason} className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground"><span>{t(REASON_LABEL_KEY[r.reason] ?? r.reason)}</span><span>{r.count}</span></div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary" style={{ width: `${(r.count / maxReasonCount) * 100}%` }} /></div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="flex items-start gap-2 p-4 rounded-xl bg-muted/50 border border-border text-sm text-muted-foreground">
              <Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <p>{t("admin.academyAnalytics.footnote")}</p>
            </div>
          </div>
        )}
      </section>
    </Layout>
  );
}
