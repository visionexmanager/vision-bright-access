import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Sparkles, Flame } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePoints } from "@/hooks/usePoints";

/** Shared widget frame: a titled card that all dashboard widgets render inside. */
export function WidgetShell({ emoji, titleKey, children }: { emoji: string; titleKey: string; children: ReactNode }) {
  const { t } = useLanguage();
  return (
    <section className="flex h-full flex-col rounded-2xl border-2 border-border bg-card p-4">
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-muted-foreground">
        <span aria-hidden="true">{emoji}</span> {t(titleKey)}
      </h3>
      <div className="flex-1">{children}</div>
    </section>
  );
}

export function ClockWidget() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <WidgetShell emoji="🕐" titleKey="kids.platform.widget.clock">
      <div className="grid h-full place-items-center">
        <p className="font-heading text-3xl font-extrabold tabular-nums">{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
      </div>
    </WidgetShell>
  );
}

export function WeatherWidget() {
  const { t } = useLanguage();
  const hour = new Date().getHours();
  const night = hour >= 19 || hour < 6;
  return (
    <WidgetShell emoji="⛅" titleKey="kids.platform.widget.weather">
      <div className="grid h-full place-items-center text-center">
        <div>
          <p className="text-4xl" aria-hidden="true">{night ? "🌙" : "☀️"}</p>
          <p className="mt-1 text-sm font-semibold">{t(night ? "kids.platform.widget.weatherNight" : "kids.platform.widget.weatherDay")}</p>
        </div>
      </div>
    </WidgetShell>
  );
}

export function TodaysChallengeWidget() {
  const { t } = useLanguage();
  return (
    <WidgetShell emoji="🎯" titleKey="kids.platform.widget.todaysChallenge">
      <p className="text-sm">{t("kids.platform.widget.challengeText")}</p>
      <Link to="/kids/health/challenges" className="mt-2 inline-block text-sm font-semibold text-kids-primary hover:underline">{t("kids.platform.widget.start")} →</Link>
    </WidgetShell>
  );
}

export function ContinueReadingWidget() {
  const { t } = useLanguage();
  return (
    <WidgetShell emoji="📖" titleKey="kids.platform.widget.continueReading">
      <p className="text-sm text-muted-foreground">{t("kids.platform.widget.continueText")}</p>
      <Link to="/kids/stories" className="mt-2 inline-block text-sm font-semibold text-kids-primary hover:underline">{t("kids.platform.widget.openStories")} →</Link>
    </WidgetShell>
  );
}

export function ProgressWidget() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { totalPoints } = usePoints();
  return (
    <WidgetShell emoji="📈" titleKey="kids.platform.widget.progress">
      {user ? (
        <div className="grid h-full place-items-center text-center">
          <div>
            <p className="font-heading text-3xl font-extrabold text-kids-primary">{totalPoints.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{t("kids.platform.widget.xp")}</p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("kids.platform.widget.signInHint")}</p>
      )}
    </WidgetShell>
  );
}

export function AchievementsWidget() {
  const { t } = useLanguage();
  return (
    <WidgetShell emoji="🏅" titleKey="kids.platform.widget.achievements">
      <div className="grid h-full place-items-center text-center">
        <div>
          <p className="text-4xl" aria-hidden="true">🏅</p>
          <Link to="/kids/stem/rewards" className="mt-1 inline-block text-sm font-semibold text-kids-primary hover:underline">{t("kids.platform.widget.viewBadges")} →</Link>
        </div>
      </div>
    </WidgetShell>
  );
}

export function DailyGoalWidget() {
  const { t } = useLanguage();
  const key = `kids:daily-goal:${new Date().toISOString().slice(0, 10)}`;
  const [done, setDone] = useState(() => (typeof window !== "undefined" ? window.localStorage.getItem(key) === "1" : false));
  function toggle() {
    const next = !done;
    setDone(next);
    window.localStorage.setItem(key, next ? "1" : "0");
  }
  return (
    <WidgetShell emoji="✅" titleKey="kids.platform.widget.dailyGoal">
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" checked={done} onChange={toggle} className="h-5 w-5 accent-kids-green" />
        {t("kids.platform.widget.goalText")}
      </label>
      {done && <p className="mt-2 flex items-center gap-1 text-sm font-semibold text-kids-green"><Flame className="h-4 w-4" aria-hidden="true" /> {t("kids.platform.widget.goalDone")}</p>}
    </WidgetShell>
  );
}

export function CalendarWidget() {
  const { t } = useLanguage();
  const { days, today, monthLabel } = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const first = new Date(year, month, 1).getDay();
    const count = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = Array.from({ length: first }, () => null).concat(Array.from({ length: count }, (_, i) => i + 1));
    return { days: cells, today: now.getDate(), monthLabel: now.toLocaleDateString(undefined, { month: "long", year: "numeric" }) };
  }, []);
  return (
    <WidgetShell emoji="📅" titleKey="kids.platform.widget.calendar">
      <p className="mb-1 text-xs font-semibold text-muted-foreground">{monthLabel}</p>
      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px]">
        {days.map((d, i) => (
          <span key={i} className={`aspect-square rounded ${d === today ? "bg-kids-primary font-bold text-white" : d ? "text-foreground/70" : ""}`}>{d ?? ""}</span>
        ))}
      </div>
      <span className="sr-only">{t("kids.platform.widget.calendar")}</span>
    </WidgetShell>
  );
}

export function BookmarksWidget() {
  const { t } = useLanguage();
  return (
    <WidgetShell emoji="🔖" titleKey="kids.platform.widget.bookmarks">
      <p className="text-sm text-muted-foreground">{t("kids.platform.widget.bookmarksEmpty")}</p>
      <Link to="/kids/market/wishlist" className="mt-2 inline-block text-sm font-semibold text-kids-primary hover:underline">{t("kids.platform.widget.viewWishlist")} →</Link>
    </WidgetShell>
  );
}

const SUGGESTIONS = [
  { key: "kids.platform.widget.aiSuggest1", to: "/kids/stem" },
  { key: "kids.platform.widget.aiSuggest2", to: "/kids/stories" },
  { key: "kids.platform.widget.aiSuggest3", to: "/kids/world" },
];

export function AISuggestionsWidget() {
  const { t } = useLanguage();
  const pick = SUGGESTIONS[new Date().getDate() % SUGGESTIONS.length];
  return (
    <WidgetShell emoji="💡" titleKey="kids.platform.widget.aiSuggestions">
      <p className="flex items-start gap-1.5 text-sm">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-kids-purple" aria-hidden="true" />
        {t(pick.key)}
      </p>
      <Link to={pick.to} className="mt-2 inline-block text-sm font-semibold text-kids-primary hover:underline">{t("kids.platform.widget.tryIt")} →</Link>
    </WidgetShell>
  );
}
