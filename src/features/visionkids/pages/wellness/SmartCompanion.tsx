import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Pencil } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useCompanion, useUpsertCompanion, useWellnessStats } from "@/features/visionkids/hooks/wellness/useWellnessEngagement";
import { WellnessHeader } from "@/features/visionkids/components/wellness/WellnessHeader";

const AVATARS = ["🤖", "🐣", "🦊", "🐨", "🦄", "🐲", "🐧", "🌟"];

interface Suggestion { emoji: string; textKey: string; to: string; }

/** Rule-based, privacy-honest suggestions computed from the child's own
 *  catalog progress — the companion only "remembers" what the child tells it
 *  (name/avatar/hobbies/goals). It is not an AI that stores health data. */
function buildSuggestions(stats: { mood_today: boolean; sleep_today: boolean; habits_today: number } | undefined): Suggestion[] {
  const out: Suggestion[] = [];
  if (stats && !stats.mood_today) out.push({ emoji: "🙂", textKey: "kids.wellness.companion.suggestMood", to: "/kids/health/mood" });
  if (stats && stats.habits_today < 3) out.push({ emoji: "✅", textKey: "kids.wellness.companion.suggestHabit", to: "/kids/health/habits" });
  out.push({ emoji: "💧", textKey: "kids.wellness.companion.suggestWater", to: "/kids/health/challenges" });
  out.push({ emoji: "🧘", textKey: "kids.wellness.companion.suggestBreak", to: "/kids/health/mindfulness" });
  out.push({ emoji: "📖", textKey: "kids.wellness.companion.suggestStory", to: "/kids/stories" });
  out.push({ emoji: "🎮", textKey: "kids.wellness.companion.suggestGame", to: "/kids/games" });
  out.push({ emoji: "🎓", textKey: "kids.wellness.companion.suggestLesson", to: "/kids/talent" });
  if (stats && !stats.sleep_today) out.push({ emoji: "😴", textKey: "kids.wellness.companion.suggestSleep", to: "/kids/health/sleep" });
  return out;
}

export default function SmartCompanion() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: companion, isLoading } = useCompanion();
  const { data: stats } = useWellnessStats();
  const save = useUpsertCompanion();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("🤖");
  const [hobbies, setHobbies] = useState("");
  const [goals, setGoals] = useState("");

  useDocumentHead({
    title: `${t("kids.wellness.nav.companion")} — VisionKids`,
    description: t("kids.wellness.companion.subtitle"),
    canonicalPath: "/kids/health/companion",
  });

  const suggestions = useMemo(() => buildSuggestions(stats), [stats]);

  function startEdit() {
    setName(companion?.name ?? "Buddy");
    setAvatar(companion?.avatar ?? "🤖");
    setHobbies((companion?.hobbies ?? []).join(", "));
    setGoals((companion?.goals ?? []).join(", "));
    setEditing(true);
  }

  async function submit() {
    if (!user) return;
    const toArr = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 8);
    await save.mutateAsync({ name: name.trim() || "Buddy", avatar, hobbies: toArr(hobbies), goals: toArr(goals) });
    setEditing(false);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <WellnessHeader emoji="🤖" title={t("kids.wellness.nav.companion")} subtitle={t("kids.wellness.companion.subtitle")} showSubNav activeId="companion" />

      <p className="mt-4 rounded-2xl border-2 border-dashed border-border bg-card p-3 text-sm text-muted-foreground" role="note">
        🔒 {t("kids.wellness.companion.privacy")}
      </p>

      {isLoading ? (
        <div className="mt-6 h-40 animate-pulse rounded-3xl bg-muted" aria-busy="true" />
      ) : editing || (!companion && user) ? (
        <div className="mt-6 rounded-2xl border-2 border-border bg-card p-5">
          <p className="font-heading text-lg font-bold">{t("kids.wellness.companion.setupTitle")}</p>
          <label className="mt-3 block text-sm font-semibold">
            {t("kids.wellness.companion.nameLabel")}
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="Buddy" className="mt-1 w-full rounded-xl border-2 border-border bg-background px-3 py-2" />
          </label>
          <p className="mt-3 text-sm font-semibold">{t("kids.wellness.companion.avatarLabel")}</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {AVATARS.map((a) => (
              <button key={a} type="button" onClick={() => setAvatar(a)} className={`rounded-xl border-2 px-3 py-2 text-2xl ${avatar === a ? "border-kids-primary bg-kids-primary/10" : "border-border"}`}>{a}</button>
            ))}
          </div>
          <label className="mt-3 block text-sm font-semibold">
            {t("kids.wellness.companion.hobbiesLabel")}
            <input value={hobbies} onChange={(e) => setHobbies(e.target.value)} placeholder={t("kids.wellness.companion.commaHint")} className="mt-1 w-full rounded-xl border-2 border-border bg-background px-3 py-2" />
          </label>
          <label className="mt-3 block text-sm font-semibold">
            {t("kids.wellness.companion.goalsLabel")}
            <input value={goals} onChange={(e) => setGoals(e.target.value)} placeholder={t("kids.wellness.companion.commaHint")} className="mt-1 w-full rounded-xl border-2 border-border bg-background px-3 py-2" />
          </label>
          <button type="button" onClick={submit} disabled={save.isPending} className="mt-4 rounded-full bg-kids-primary px-5 py-2.5 font-bold text-white hover:opacity-90 disabled:opacity-50">
            {t("kids.wellness.companion.save")}
          </button>
        </div>
      ) : (
        <>
          <div className="mt-6 flex items-center gap-4 rounded-3xl border-2 border-kids-primary/30 bg-kids-primary/5 p-5">
            <span className="text-6xl" aria-hidden="true">{companion?.avatar ?? "🤖"}</span>
            <div className="flex-1">
              <p className="font-heading text-2xl font-extrabold">{companion?.name ?? "Buddy"}</p>
              <p className="text-sm text-muted-foreground">{t("kids.wellness.companion.greeting")}</p>
            </div>
            {user && (
              <button type="button" onClick={startEdit} aria-label={t("kids.wellness.companion.edit")} className="text-muted-foreground hover:text-kids-primary">
                <Pencil className="h-5 w-5" aria-hidden="true" />
              </button>
            )}
          </div>

          {!user && (
            <p className="mt-3 text-sm text-muted-foreground" role="status">{t("kids.wellness.companion.signInHint")}</p>
          )}

          <section className="mt-6">
            <h2 className="font-heading text-lg font-bold">💡 {t("kids.wellness.companion.suggestionsTitle")}</h2>
            <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {suggestions.map((s) => (
                <li key={s.textKey}>
                  <Link to={s.to} className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-3 hover:border-kids-primary/50">
                    <span className="text-2xl" aria-hidden="true">{s.emoji}</span>
                    <span className="font-semibold">{t(s.textKey)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
