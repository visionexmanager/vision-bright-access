import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, CalendarDays, Target, Save } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AcademySectionHeader } from "@/components/academy/ui/AcademySectionHeader";
import { getStudyGoal, setStudyGoal, getStudyGoalProgress, getStudyDayActivity } from "@/lib/academy/studyPlannerLocalStore";

const DAYS_IN_HEATMAP = 84; // 12 weeks

function StudyHeatmap({ userId }: { userId: string }) {
  const activityByDate = useMemo(() => {
    const map = new Map(getStudyDayActivity(userId).map((a) => [a.date, a.lessonsCompleted]));
    return map;
  }, [userId]);

  const days = useMemo(() => {
    const today = new Date();
    const list: { date: string; count: number }[] = [];
    for (let i = DAYS_IN_HEATMAP - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      list.push({ date: key, count: activityByDate.get(key) ?? 0 });
    }
    return list;
  }, [activityByDate]);

  const intensityClass = (count: number) => {
    if (count === 0) return "bg-muted";
    if (count === 1) return "bg-primary/30";
    if (count <= 3) return "bg-primary/60";
    return "bg-primary";
  };

  return (
    <div>
      <div className="grid grid-flow-col grid-rows-7 gap-1 w-fit" role="img" aria-label={`خريطة نشاطك التعليمي لآخر ${DAYS_IN_HEATMAP} يوماً`}>
        {days.map((d) => (
          <span
            key={d.date}
            title={`${d.date}: ${d.count} درس مكتمل`}
            className={`w-3 h-3 rounded-sm ${intensityClass(d.count)}`}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-2">آخر {DAYS_IN_HEATMAP} يوماً — كل مربّع يمثّل يوماً، وكثافة اللون تعكس عدد الدروس المكتملة.</p>
    </div>
  );
}

export default function AcademyStudyPlanner() {
  const { user } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);

  const goal = useMemo(() => (user ? getStudyGoal(user.id) : null), [user, refreshKey]);
  const progress = useMemo(() => (user ? getStudyGoalProgress(user.id) : null), [user, refreshKey]);

  const [weeklyLessons, setWeeklyLessons] = useState<number | null>(null);
  const [dailyMinutes, setDailyMinutes] = useState<number | null>(null);

  if (!user) {
    return (
      <Layout>
        <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
          <p className="text-muted-foreground">يجب تسجيل الدخول لإدارة خطة دراستك.</p>
          <Button asChild className="rounded-xl"><Link to="/login?returnTo=/academy/planner">تسجيل الدخول</Link></Button>
        </div>
      </Layout>
    );
  }

  const handleSaveGoal = () => {
    setStudyGoal(user.id, weeklyLessons ?? goal?.weekly_lessons_target ?? 5, dailyMinutes ?? goal?.daily_minutes_target ?? 30);
    setWeeklyLessons(null);
    setDailyMinutes(null);
    setRefreshKey((k) => k + 1);
  };

  const weeklyPercent = goal ? Math.min(100, Math.round(((progress?.lessonsCompletedThisWeek ?? 0) / goal.weekly_lessons_target) * 100)) : 0;
  const dailyPercent = goal ? Math.min(100, Math.round(((progress?.minutesStudiedToday ?? 0) / goal.daily_minutes_target) * 100)) : 0;

  return (
    <Layout>
      <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-8 font-sans text-start">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-4 gap-1 rounded-xl">
            <Link to="/academy">
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              العودة إلى الأكاديمية
            </Link>
          </Button>
          <AcademySectionHeader
            icon={CalendarDays}
            title="خطة الدراسة"
            description="أهدافك الأسبوعية واليومية، وتقويم نشاطك التعليمي"
            headingId="planner-heading"
          />
        </div>

        {goal && progress && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-card p-6 rounded-2xl border border-border space-y-3">
              <p className="text-sm font-bold text-foreground">الهدف الأسبوعي</p>
              <Progress value={weeklyPercent} className="h-2.5" />
              <p className="text-xs text-muted-foreground">{progress.lessonsCompletedThisWeek} / {goal.weekly_lessons_target} درس هذا الأسبوع</p>
            </div>
            <div className="bg-card p-6 rounded-2xl border border-border space-y-3">
              <p className="text-sm font-bold text-foreground">الهدف اليومي</p>
              <Progress value={dailyPercent} className="h-2.5" />
              <p className="text-xs text-muted-foreground">{progress.minutesStudiedToday} / {goal.daily_minutes_target} دقيقة اليوم</p>
            </div>
          </div>
        )}

        <section aria-labelledby="goal-form-heading" className="bg-card p-6 rounded-2xl border border-border space-y-4">
          <h2 id="goal-form-heading" className="text-sm font-bold text-foreground flex items-center gap-1.5">
            <Target className="w-4 h-4 text-primary" aria-hidden="true" />
            تعديل الأهداف
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="weekly-lessons-target">عدد الدروس المستهدف أسبوعياً</Label>
              <Input
                id="weekly-lessons-target"
                type="number"
                min={1}
                value={weeklyLessons ?? goal?.weekly_lessons_target ?? 5}
                onChange={(e) => setWeeklyLessons(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="daily-minutes-target">عدد الدقائق المستهدف يومياً</Label>
              <Input
                id="daily-minutes-target"
                type="number"
                min={5}
                value={dailyMinutes ?? goal?.daily_minutes_target ?? 30}
                onChange={(e) => setDailyMinutes(Number(e.target.value))}
              />
            </div>
          </div>
          <Button onClick={handleSaveGoal} className="gap-2 rounded-xl">
            <Save className="w-4 h-4" aria-hidden="true" />
            حفظ الأهداف
          </Button>
        </section>

        <section aria-labelledby="calendar-heading" className="bg-card p-6 rounded-2xl border border-border space-y-4 overflow-x-auto">
          <h2 id="calendar-heading" className="text-sm font-bold text-foreground">تقويم الدراسة</h2>
          <StudyHeatmap userId={user.id} />
        </section>
      </div>
    </Layout>
  );
}
