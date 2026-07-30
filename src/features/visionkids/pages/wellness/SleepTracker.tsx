import { useState } from "react";
import { Link } from "react-router-dom";
import { Moon } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useSleepLogs, useLogSleep } from "@/features/visionkids/hooks/wellness/useWellnessLogs";
import { WellnessHeader } from "@/features/visionkids/components/wellness/WellnessHeader";
import { WellnessRewardBanner } from "@/features/visionkids/components/wellness/WellnessRewardBanner";
import type { SleepQuality } from "@/features/visionkids/types/wellness.types";

const QUALITIES: { slug: SleepQuality; emoji: string }[] = [
  { slug: "great", emoji: "😴" },
  { slug: "ok", emoji: "🙂" },
  { slug: "poor", emoji: "😪" },
];

function diffMinutes(bed: string, wake: string): number {
  const [bh, bm] = bed.split(":").map(Number);
  const [wh, wm] = wake.split(":").map(Number);
  if ([bh, bm, wh, wm].some(Number.isNaN)) return 0;
  let mins = wh * 60 + wm - (bh * 60 + bm);
  if (mins <= 0) mins += 24 * 60; // crossed midnight
  return mins;
}

export default function SleepTracker() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: logs = [] } = useSleepLogs();
  const logSleep = useLogSleep();

  const [bedtime, setBedtime] = useState("20:30");
  const [wake, setWake] = useState("07:00");
  const [quality, setQuality] = useState<SleepQuality>("great");
  const [reward, setReward] = useState(false);

  useDocumentHead({
    title: `${t("kids.wellness.nav.sleep")} — VisionKids`,
    description: t("kids.wellness.sleep.subtitle"),
    canonicalPath: "/kids/health/sleep",
  });

  const duration = diffMinutes(bedtime, wake);
  const hrs = Math.floor(duration / 60);
  const mins = duration % 60;

  async function save() {
    if (!user) return;
    try {
      const first = await logSleep.mutateAsync({ bedtime, wakeTime: wake, durationMinutes: duration, quality });
      if (first) {
        setReward(true);
        setTimeout(() => setReward(false), 3000);
      }
    } catch { /* ignore */ }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <WellnessHeader emoji="😴" title={t("kids.wellness.nav.sleep")} subtitle={t("kids.wellness.sleep.subtitle")} showSubNav activeId="sleep" />

      <WellnessRewardBanner show={reward} message={t("kids.wellness.sleep.savedMsg")} xp={10} coins={5} />

      <div className="mt-6 rounded-2xl border-2 border-border bg-card p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            🌙 {t("kids.wellness.sleep.bedtime")}
            <input type="time" value={bedtime} onChange={(e) => setBedtime(e.target.value)} className="rounded-xl border-2 border-border bg-background px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            ☀️ {t("kids.wellness.sleep.wake")}
            <input type="time" value={wake} onChange={(e) => setWake(e.target.value)} className="rounded-xl border-2 border-border bg-background px-3 py-2" />
          </label>
        </div>

        <p className="mt-4 flex items-center gap-2 text-lg font-bold">
          <Moon className="h-5 w-5 text-kids-purple" aria-hidden="true" />
          {hrs}{t("kids.wellness.sleep.h")} {mins}{t("kids.wellness.sleep.m")}
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {QUALITIES.map((q) => (
            <button
              key={q.slug}
              type="button"
              onClick={() => setQuality(q.slug)}
              className={`rounded-full border-2 px-3 py-1 text-sm font-semibold ${quality === q.slug ? "border-kids-primary bg-kids-primary/10 text-kids-primary" : "border-border"}`}
            >
              {q.emoji} {t(`kids.wellness.sleep.quality.${q.slug}`)}
            </button>
          ))}
        </div>

        <button type="button" onClick={save} disabled={!user || logSleep.isPending} className="mt-4 rounded-full bg-kids-primary px-5 py-2.5 font-bold text-white hover:opacity-90 disabled:opacity-50">
          {t("kids.wellness.sleep.save")}
        </button>
        {!user && <p className="mt-2 text-sm text-muted-foreground">{t("kids.wellness.signInHint")}</p>}
      </div>

      {/* Wind-down helpers */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link to="/kids/stories" className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-4 hover:border-kids-primary/50">
          <span className="text-2xl" aria-hidden="true">📖</span>
          <span className="font-heading font-bold">{t("kids.wellness.sleep.bedtimeStories")}</span>
        </Link>
        <Link to="/kids/health/mindfulness" className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-4 hover:border-kids-primary/50">
          <span className="text-2xl" aria-hidden="true">🌙</span>
          <span className="font-heading font-bold">{t("kids.wellness.sleep.calmDown")}</span>
        </Link>
      </div>

      {logs.length > 0 && (
        <section className="mt-8">
          <h2 className="font-heading text-lg font-bold">{t("kids.wellness.sleep.recent")}</h2>
          <ul className="mt-3 space-y-2">
            {logs.map((l) => (
              <li key={l.log_date} className="flex items-center justify-between rounded-xl border-2 border-border bg-card px-4 py-2 text-sm">
                <span className="font-semibold">{new Date(l.log_date).toLocaleDateString()}</span>
                <span className="text-muted-foreground">
                  {l.duration_minutes != null ? `${Math.floor(l.duration_minutes / 60)}${t("kids.wellness.sleep.h")} ${l.duration_minutes % 60}${t("kids.wellness.sleep.m")}` : "—"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
