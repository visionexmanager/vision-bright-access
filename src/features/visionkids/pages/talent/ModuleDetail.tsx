import { useState } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { ChevronLeft, Sparkles, Coins, CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useTalentTrack, useTrackModule, useTrackModules } from "@/features/visionkids/hooks/talent/useTalentCatalog";
import { useMyModuleProgress, useCompleteModule } from "@/features/visionkids/hooks/talent/useTrackProgress";
import { useAddPortfolioItem } from "@/features/visionkids/hooks/talent/usePortfolio";
import { RewardBanner } from "@/features/visionkids/components/talent/RewardBanner";

export default function ModuleDetail() {
  const { trackSlug, moduleSlug } = useParams<{ trackSlug: string; moduleSlug: string }>();
  const { t } = useLanguage();
  const { user } = useAuth();

  const { data: track } = useTalentTrack(trackSlug);
  const { data: module, isLoading } = useTrackModule(trackSlug, moduleSlug);
  const { data: modules = [] } = useTrackModules(trackSlug);
  const { data: progress = [] } = useMyModuleProgress(trackSlug);
  const complete = useCompleteModule();
  const addToPortfolio = useAddPortfolioItem();

  const [reward, setReward] = useState<{ xp: number; coins: number } | null>(null);
  const [saved, setSaved] = useState(false);

  useDocumentHead({
    title: module ? `${module.title} — VisionKids` : t("kids.talent.heroTitle"),
    description: module?.description ?? t("kids.talent.meta.description"),
    canonicalPath: `/kids/talent/track/${trackSlug}/${moduleSlug}`,
  });

  if (isLoading) return <div className="mx-auto max-w-2xl px-4 py-10"><div className="h-72 animate-pulse rounded-3xl bg-muted" /></div>;
  if (!module || !trackSlug) return <Navigate to={`/kids/talent/track/${trackSlug ?? ""}`} replace />;

  const done = progress.some((p) => p.module_id === module.id);
  const body = typeof module.content?.body === "string" ? module.content.body : "";
  const idx = modules.findIndex((m) => m.id === module.id);
  const next = idx >= 0 && idx + 1 < modules.length ? modules[idx + 1] : null;

  async function markDone() {
    if (done || !user) return;
    try {
      const res = await complete.mutateAsync(module.id);
      if (res.newly_completed_module) {
        setReward({ xp: module.reward_xp, coins: module.reward_coins });
        setTimeout(() => setReward(null), 3500);
      }
    } catch { /* server enforces; nothing to do */ }
  }

  async function saveToPortfolio() {
    if (!user) return;
    try {
      await addToPortfolio.mutateAsync({
        kind: module.kind === "project" ? "project" : "other",
        title: module.title,
        description: track?.title ? `${track.title} — ${module.title}` : module.title,
        emoji: module.emoji,
        source: "track",
        track_slug: trackSlug,
        content: { module_slug: module.slug },
      });
      setSaved(true);
    } catch { /* ignore */ }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Link to={`/kids/talent/track/${trackSlug}`} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" /> {track?.title ?? t("kids.talent.heroTitle")}
      </Link>

      <RewardBanner show={!!reward} message={`${t("kids.talent.module.completed")} ${module.title}!`} xp={reward?.xp} coins={reward?.coins} />

      <h1 className="font-heading text-3xl font-extrabold">
        <span aria-hidden="true">{module.emoji}</span> {module.title}
      </h1>
      <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-kids-primary">{t(`kids.talent.moduleKind.${module.kind}`)}</p>

      {body && (
        <div className="mt-5 rounded-2xl border-2 border-border bg-card p-5 text-lg leading-relaxed">
          {body}
        </div>
      )}

      {module.kind === "activity" && (
        <div className="mt-4 rounded-2xl border-2 border-dashed border-kids-accent/40 bg-kids-accent/5 p-5 text-center">
          <p className="text-3xl" aria-hidden="true">🎮</p>
          <p className="mt-1 font-heading font-bold">{t("kids.talent.module.tryIt")}</p>
          <p className="text-sm text-muted-foreground">{t("kids.talent.module.activityHint")}</p>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {done ? (
          <span className="flex items-center gap-2 rounded-full border-2 border-kids-green/40 bg-kids-green/10 px-4 py-2 font-bold text-kids-green">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> {t("kids.talent.module.doneLabel")}
          </span>
        ) : (
          <button
            type="button"
            onClick={markDone}
            disabled={!user || complete.isPending}
            className="flex items-center gap-2 rounded-full bg-kids-primary px-5 py-2.5 font-bold text-white hover:opacity-90 disabled:opacity-50"
          >
            {t("kids.talent.module.markComplete")}
            <span className="flex items-center gap-1 text-sm opacity-90">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />{module.reward_xp}
              <Coins className="ms-1 h-3.5 w-3.5" aria-hidden="true" />{module.reward_coins}
            </span>
          </button>
        )}

        {module.kind === "project" && user && (
          <button
            type="button"
            onClick={saveToPortfolio}
            disabled={saved || addToPortfolio.isPending}
            className="rounded-full border-2 border-border px-4 py-2 font-semibold hover:border-kids-primary/50 disabled:opacity-60"
          >
            {saved ? `✅ ${t("kids.talent.module.savedToPortfolio")}` : `📁 ${t("kids.talent.module.saveToPortfolio")}`}
          </button>
        )}
      </div>

      {!user && (
        <p className="mt-3 text-sm text-muted-foreground" role="status">{t("kids.talent.module.signInHint")}</p>
      )}

      {next && (
        <Link
          to={`/kids/talent/track/${trackSlug}/${next.slug}`}
          className="mt-8 flex items-center justify-between rounded-2xl border-2 border-border bg-card p-4 hover:border-kids-primary/50"
        >
          <span className="text-sm text-muted-foreground">{t("kids.talent.module.next")}</span>
          <span className="font-heading font-bold"><span aria-hidden="true">{next.emoji}</span> {next.title} →</span>
        </Link>
      )}
    </div>
  );
}
