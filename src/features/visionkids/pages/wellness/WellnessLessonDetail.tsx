import { useEffect, useRef, useState } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { ChevronLeft, Play, Pause, RotateCcw, CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useLesson } from "@/features/visionkids/hooks/wellness/useWellnessCatalog";
import { useLogSession } from "@/features/visionkids/hooks/wellness/useWellnessLogs";
import { useAwardAchievement } from "@/features/visionkids/hooks/stories/useStoryEngagement";
import { WellnessRewardBanner } from "@/features/visionkids/components/wellness/WellnessRewardBanner";
import type { WellnessCategory } from "@/features/visionkids/types/wellness.types";

const VALID: WellnessCategory[] = ["nutrition", "exercise", "mindfulness", "safety", "first_aid"];
const BACK_ROUTE: Record<WellnessCategory, string> = {
  nutrition: "/kids/health/nutrition",
  exercise: "/kids/health/exercise",
  mindfulness: "/kids/health/mindfulness",
  safety: "/kids/health/safety",
  first_aid: "/kids/health/first-aid",
};

export default function WellnessLessonDetail() {
  const { category, slug } = useParams<{ category: string; slug: string }>();
  const { t } = useLanguage();
  const { user } = useAuth();

  const cat = (VALID.includes(category as WellnessCategory) ? category : undefined) as WellnessCategory | undefined;
  const { data: lesson, isLoading } = useLesson(cat ?? "nutrition", cat ? slug : undefined);
  const logSession = useLogSession();
  const awardAchievement = useAwardAchievement();

  const timed = cat === "exercise" || cat === "mindfulness";
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [reward, setReward] = useState(false);
  const timerRef = useRef<number | null>(null);

  useDocumentHead({
    title: lesson ? `${lesson.title} — VisionKids` : t("kids.wellness.heroTitle"),
    description: lesson?.summary ?? t("kids.wellness.meta.description"),
    canonicalPath: `/kids/health/lesson/${category}/${slug}`,
  });

  // Safety lessons: award the "Safety Smart" badge on first view (best-effort).
  useEffect(() => {
    if (user && cat === "safety" && lesson) {
      awardAchievement.mutate("safety_smart");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, cat, lesson?.id]);

  // Countdown timer for exercise/mindfulness.
  useEffect(() => {
    if (!running) return;
    timerRef.current = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s === null) return null;
        if (s <= 1) {
          window.clearInterval(timerRef.current!);
          setRunning(false);
          finish();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  if (isLoading) return <div className="mx-auto max-w-2xl px-4 py-10"><div className="h-72 animate-pulse rounded-3xl bg-muted" /></div>;
  if (!cat || !lesson) return <Navigate to={cat ? BACK_ROUTE[cat] : "/kids/health"} replace />;

  const total = lesson.duration_seconds ?? 60;

  function start() {
    setSecondsLeft(secondsLeft ?? total);
    setRunning(true);
  }
  function reset() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    setRunning(false);
    setSecondsLeft(total);
    setDone(false);
  }
  async function finish() {
    setDone(true);
    if (user && cat && (cat === "exercise" || cat === "mindfulness")) {
      try {
        await logSession.mutateAsync({ kind: cat, refSlug: lesson.slug, minutes: Math.max(1, Math.round(total / 60)) });
        setReward(true);
        setTimeout(() => setReward(false), 3500);
      } catch { /* server-side; ignore */ }
    }
  }

  const mm = secondsLeft !== null ? Math.floor(secondsLeft / 60) : 0;
  const ss = secondsLeft !== null ? secondsLeft % 60 : 0;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Link to={BACK_ROUTE[cat]} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" /> {t(`kids.wellness.nav.${cat === "first_aid" ? "firstAid" : cat}`)}
      </Link>

      <WellnessRewardBanner show={reward} message={`${t("kids.wellness.lesson.wellDone")} ${lesson.title}!`} xp={15} coins={8} />

      <h1 className="font-heading text-3xl font-extrabold">
        <span aria-hidden="true">{lesson.emoji}</span> {lesson.title}
      </h1>
      {lesson.summary && <p className="mt-1 text-muted-foreground">{lesson.summary}</p>}

      {cat === "first_aid" && (
        <p className="mt-4 rounded-2xl border-2 border-kids-accent/40 bg-kids-accent/10 p-3 text-sm font-medium" role="note">
          ⚠️ {t("kids.wellness.firstAid.disclaimer")}
        </p>
      )}

      {lesson.body && <p className="mt-5 rounded-2xl border-2 border-border bg-card p-5 text-lg leading-relaxed">{lesson.body}</p>}

      {lesson.steps.length > 0 && (
        <ol className="mt-5 space-y-2">
          {lesson.steps.map((step, i) => (
            <li key={i} className="flex items-start gap-3 rounded-2xl border-2 border-border bg-card p-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-kids-primary/10 text-sm font-bold text-kids-primary">{i + 1}</span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      )}

      {/* Guided timer for exercise / mindfulness */}
      {timed && (
        <div className="mt-6 rounded-3xl border-2 border-kids-primary/30 bg-kids-primary/5 p-6 text-center">
          <p className="font-mono text-5xl font-extrabold tabular-nums">
            {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {!running ? (
              <button type="button" onClick={start} className="flex items-center gap-2 rounded-full bg-kids-primary px-5 py-2.5 font-bold text-white hover:opacity-90">
                <Play className="h-4 w-4" aria-hidden="true" /> {done ? t("kids.wellness.lesson.again") : t("kids.wellness.lesson.start")}
              </button>
            ) : (
              <button type="button" onClick={() => setRunning(false)} className="flex items-center gap-2 rounded-full border-2 border-border px-5 py-2.5 font-bold">
                <Pause className="h-4 w-4" aria-hidden="true" /> {t("kids.wellness.lesson.pause")}
              </button>
            )}
            <button type="button" onClick={reset} className="flex items-center gap-2 rounded-full border-2 border-border px-5 py-2.5 font-bold">
              <RotateCcw className="h-4 w-4" aria-hidden="true" /> {t("kids.wellness.lesson.reset")}
            </button>
          </div>
          {done && (
            <p className="mt-3 flex items-center justify-center gap-2 font-semibold text-kids-green">
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> {t("kids.wellness.lesson.finished")}
            </p>
          )}
          {!user && <p className="mt-2 text-sm text-muted-foreground">{t("kids.wellness.lesson.signInHint")}</p>}
        </div>
      )}
    </div>
  );
}
