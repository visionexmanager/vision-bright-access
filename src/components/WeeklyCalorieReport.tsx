import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { TrendingUp, TrendingDown, Minus, Flame, CalendarDays } from "lucide-react";

interface DayData {
  day: string;
  calories: number;
  meals: number;
}

interface WeeklyCalorieReportProps {
  calorieGoal: number;
}

export default function WeeklyCalorieReport({ calorieGoal }: WeeklyCalorieReportProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [weekData, setWeekData] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWeekData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 6);
    startOfWeek.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from("meal_logs")
      .select("calories, logged_at")
      .eq("user_id", user.id)
      .gte("logged_at", startOfWeek.toISOString())
      .order("logged_at", { ascending: true });

    const dayNames = [
      t("nutrition.sun"), t("nutrition.mon"), t("nutrition.tue"),
      t("nutrition.wed"), t("nutrition.thu"), t("nutrition.fri"), t("nutrition.sat"),
    ];

    const days: DayData[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const nextD = new Date(d);
      nextD.setDate(d.getDate() + 1);

      const dayLogs = (data || []).filter((m) => {
        const logDate = new Date(m.logged_at);
        return logDate >= d && logDate < nextD;
      });

      days.push({
        day: dayNames[d.getDay()],
        calories: dayLogs.reduce((s, m) => s + m.calories, 0),
        meals: dayLogs.length,
      });
    }

    setWeekData(days);
    setLoading(false);
  }, [user, t]);

  useEffect(() => {
    fetchWeekData();
  }, [fetchWeekData]);

  const totalWeek = weekData.reduce((s, d) => s + d.calories, 0);
  const avgDaily = weekData.length ? Math.round(totalWeek / 7) : 0;
  const totalMeals = weekData.reduce((s, d) => s + d.meals, 0);
  const maxDay = weekData.reduce((max, d) => (d.calories > max.calories ? d : max), { day: "", calories: 0, meals: 0 });
  const daysOnTarget = weekData.filter((d) => d.calories > 0 && d.calories <= calorieGoal * 1.1).length;

  const trend = weekData.length >= 2
    ? weekData[weekData.length - 1].calories - weekData[0].calories
    : 0;

  return (
    <Card className="rounded-[30px] shadow-xl overflow-hidden">
      <div className="h-2 bg-gradient-to-r from-orange-500 to-amber-500" />
      <CardContent className="p-8 space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-orange-100 dark:bg-orange-900/30 rounded-2xl flex items-center justify-center">
            <CalendarDays className="h-7 w-7 text-orange-600" />
          </div>
          <div>
            <h3 className="text-xl font-black text-foreground">{t("nutrition.weeklyReport")}</h3>
            <p className="text-muted-foreground text-sm">{t("nutrition.weeklyReportDesc")}</p>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-2xl text-center">
            <Flame className="h-5 w-5 text-orange-500 mx-auto mb-1" />
            <p className="text-xs font-bold text-muted-foreground uppercase">{t("nutrition.totalWeekCal")}</p>
            <p className="text-xl font-black text-orange-600">{totalWeek.toLocaleString()}</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-2xl text-center">
            <Minus className="h-5 w-5 text-blue-500 mx-auto mb-1" />
            <p className="text-xs font-bold text-muted-foreground uppercase">{t("nutrition.dailyAvg")}</p>
            <p className="text-xl font-black text-blue-600">{avgDaily}</p>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-2xl text-center">
            {trend <= 0
              ? <TrendingDown className="h-5 w-5 text-emerald-500 mx-auto mb-1" />
              : <TrendingUp className="h-5 w-5 text-red-500 mx-auto mb-1" />}
            <p className="text-xs font-bold text-muted-foreground uppercase">{t("nutrition.trend")}</p>
            <p className={`text-xl font-black ${trend <= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {trend > 0 ? "+" : ""}{trend}
            </p>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-2xl text-center">
            <CalendarDays className="h-5 w-5 text-purple-500 mx-auto mb-1" />
            <p className="text-xs font-bold text-muted-foreground uppercase">{t("nutrition.onTarget")}</p>
            <p className="text-xl font-black text-purple-600">{daysOnTarget}/7</p>
          </div>
        </div>

        {/* Bar chart */}
        <div className="h-64">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">{t("nutrition.loading")}</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="day" tick={{ fontSize: 12, fontWeight: 700 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: "16px",
                    border: "none",
                    boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
                    fontWeight: 700,
                  }}
                  formatter={(value: number) => [`${value} kcal`, t("nutrition.caloriesLabel")]}
                  labelFormatter={(label) => label}
                />
                <Bar dataKey="calories" radius={[8, 8, 0, 0]} maxBarSize={40}>
                  {weekData.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={
                        entry.calories === 0
                          ? "hsl(var(--muted))"
                          : entry.calories <= calorieGoal
                            ? "hsl(160, 84%, 39%)"
                            : "hsl(0, 84%, 60%)"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Goal line info */}
        <div className="flex items-center justify-between text-sm px-2">
          <span className="text-muted-foreground font-bold">
            {t("nutrition.goalLine")}: <span className="text-emerald-600 font-black">{calorieGoal} {t("nutrition.kcal")}</span>
          </span>
          <span className="text-muted-foreground font-bold">
            {t("nutrition.totalMeals")}: <span className="text-foreground font-black">{totalMeals}</span>
          </span>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs justify-center">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: "hsl(160, 84%, 39%)" }} />
            <span className="text-muted-foreground font-bold">{t("nutrition.withinGoal")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: "hsl(0, 84%, 60%)" }} />
            <span className="text-muted-foreground font-bold">{t("nutrition.overGoal")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-muted" />
            <span className="text-muted-foreground font-bold">{t("nutrition.noData")}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
