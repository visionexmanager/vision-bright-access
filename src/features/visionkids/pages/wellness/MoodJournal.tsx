import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useMoodLogs, useLogMood } from "@/features/visionkids/hooks/wellness/useWellnessLogs";
import { MOOD_OPTIONS } from "@/features/visionkids/data/wellnessConfig";
import { WellnessHeader } from "@/features/visionkids/components/wellness/WellnessHeader";
import { WellnessRewardBanner } from "@/features/visionkids/components/wellness/WellnessRewardBanner";
import type { Mood } from "@/features/visionkids/types/wellness.types";

export default function MoodJournal() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: logs = [] } = useMoodLogs();
  const logMood = useLogMood();

  const [selected, setSelected] = useState<Mood | null>(null);
  const [note, setNote] = useState("");
  const [reward, setReward] = useState(false);

  useDocumentHead({
    title: `${t("kids.wellness.nav.mood")} — VisionKids`,
    description: t("kids.wellness.mood.subtitle"),
    canonicalPath: "/kids/health/mood",
  });

  const moodEmoji = (m: string) => MOOD_OPTIONS.find((o) => o.slug === m)?.emoji ?? "🙂";

  async function save() {
    if (!user || !selected) return;
    const color = MOOD_OPTIONS.find((o) => o.slug === selected)?.color;
    try {
      const first = await logMood.mutateAsync({ mood: selected, color, note: note.trim() || undefined });
      if (first) {
        setReward(true);
        setTimeout(() => setReward(false), 3000);
      }
      setNote("");
    } catch { /* ignore */ }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <WellnessHeader emoji="🙂" title={t("kids.wellness.nav.mood")} subtitle={t("kids.wellness.mood.subtitle")} showSubNav activeId="mood" />

      <WellnessRewardBanner show={reward} message={t("kids.wellness.mood.savedMsg")} xp={10} coins={5} />

      <p className="mt-4 rounded-2xl border-2 border-dashed border-border bg-card p-3 text-sm text-muted-foreground" role="note">
        🔒 {t("kids.wellness.mood.privacy")}
      </p>

      <div className="mt-6 rounded-2xl border-2 border-border bg-card p-5">
        <p className="font-heading text-lg font-bold">{t("kids.wellness.mood.question")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {MOOD_OPTIONS.map((m) => (
            <button
              key={m.slug}
              type="button"
              onClick={() => setSelected(m.slug)}
              aria-pressed={selected === m.slug}
              className={`flex flex-col items-center gap-1 rounded-2xl border-2 px-4 py-3 transition-transform hover:scale-105 ${selected === m.slug ? "border-kids-primary bg-kids-primary/10" : "border-border"}`}
            >
              <span className="text-3xl" aria-hidden="true">{m.emoji}</span>
              <span className="text-xs font-semibold">{t(`kids.wellness.mood.${m.slug}`)}</span>
            </button>
          ))}
        </div>

        <label className="mt-4 block text-sm font-semibold">
          {t("kids.wellness.mood.noteLabel")}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={280}
            rows={2}
            placeholder={t("kids.wellness.mood.notePlaceholder")}
            className="mt-1 w-full rounded-xl border-2 border-border bg-background px-3 py-2"
          />
        </label>

        <button type="button" onClick={save} disabled={!user || !selected || logMood.isPending} className="mt-2 rounded-full bg-kids-primary px-5 py-2.5 font-bold text-white hover:opacity-90 disabled:opacity-50">
          {t("kids.wellness.mood.save")}
        </button>
        {!user && <p className="mt-2 text-sm text-muted-foreground">{t("kids.wellness.signInHint")}</p>}
      </div>

      {logs.length > 0 && (
        <section className="mt-8">
          <h2 className="font-heading text-lg font-bold">{t("kids.wellness.mood.history")}</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {logs.map((l) => (
              <li key={l.log_date} className="flex flex-col items-center rounded-xl border-2 border-border bg-card px-3 py-2" title={new Date(l.log_date).toLocaleDateString()}>
                <span className="text-2xl" aria-hidden="true">{moodEmoji(l.mood)}</span>
                <span className="text-[10px] text-muted-foreground">{new Date(l.log_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
