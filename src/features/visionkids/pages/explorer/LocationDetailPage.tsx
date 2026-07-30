import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";
import { fadeIn, slideUp, staggerContainer } from "@/features/visionkids/utils/animations";
import { useExplorerWorld, useLocationBySlug } from "@/features/visionkids/hooks/explorer/useExplorerWorlds";
import { useStampWorld } from "@/features/visionkids/hooks/explorer/useExplorerPassport";
import { useQuizByLocation } from "@/features/visionkids/hooks/stories/useStoryQuiz";
import { CONTENT_WORLD_CONFIG } from "@/features/visionkids/data/explorerWorlds";
import { WorldFactGrid } from "@/features/visionkids/components/explorer/WorldFactGrid";
import { FunFactsList } from "@/features/visionkids/components/explorer/FunFactsList";
import { StampBanner } from "@/features/visionkids/components/explorer/StampBanner";

/** Generic detail page shared by all 9 "browse and learn" worlds. */
export default function LocationDetailPage() {
  const { worldSlug, locationSlug } = useParams<{ worldSlug: string; locationSlug: string }>();
  const { t } = useLanguage();
  const { user } = useAuth();
  const reduced = useKidsReducedMotion();

  const { data: world } = useExplorerWorld(worldSlug);
  const { data: location, isLoading } = useLocationBySlug(worldSlug, locationSlug);
  const { data: quiz } = useQuizByLocation(location?.id);
  const stampWorld = useStampWorld();

  const config = worldSlug ? CONTENT_WORLD_CONFIG[worldSlug] : undefined;

  useDocumentHead({
    title: location ? `${location.name} — VisionKids Explorer` : t("kids.explorer.meta.title"),
    description: location?.summary ?? t("kids.explorer.meta.description"),
    canonicalPath: `/kids/explorer/world/${worldSlug}/${locationSlug}`,
  });

  useEffect(() => {
    if (user && worldSlug) stampWorld.mutate(worldSlug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, worldSlug]);

  if (isLoading) {
    return <div className="mx-auto max-w-3xl px-4 py-16" aria-busy="true"><div className="h-64 animate-pulse rounded-2xl bg-muted" /></div>;
  }

  if (!location || !world) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-lg font-semibold">{t("kids.explorer.locationNotFound")}</p>
        <Link to={`/kids/explorer/world/${worldSlug}`} className="mt-4 inline-block text-kids-primary hover:underline">{t("kids.section.backHome")}</Link>
      </div>
    );
  }

  return (
    <motion.div initial="hidden" animate="visible" variants={staggerContainer(reduced)} className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <Link to={`/kids/explorer/world/${worldSlug}`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {world.title}
      </Link>

      <StampBanner show={!!stampWorld.data} />

      <motion.div variants={slideUp(reduced)} className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-start">
        <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-kids-primary/20 to-kids-purple/20 text-5xl">
          {location.image_url ? (
            <img src={location.image_url} alt="" className="h-28 w-28 rounded-full object-cover" />
          ) : (
            <span aria-hidden="true">{location.emoji}</span>
          )}
        </div>
        <div>
          <h1 className="font-heading text-2xl font-extrabold sm:text-3xl">{location.name}</h1>
          {location.summary && <p className="mt-1 text-muted-foreground">{location.summary}</p>}
        </div>
      </motion.div>

      {location.audio_url && (
        <motion.div variants={fadeIn(reduced)} className="mt-4">
          <audio controls src={location.audio_url} className="w-full">
            <track kind="captions" />
          </audio>
        </motion.div>
      )}

      {location.video_url && (
        <motion.div variants={fadeIn(reduced)} className="mt-4 aspect-video overflow-hidden rounded-2xl">
          <video controls src={location.video_url} className="h-full w-full">
            <track kind="captions" />
          </video>
        </motion.div>
      )}

      {config && (
        <motion.div variants={fadeIn(reduced)} className="mt-6">
          <WorldFactGrid content={location.content} fields={config.factFields} />
        </motion.div>
      )}

      <motion.div variants={fadeIn(reduced)} className="mt-6">
        <FunFactsList facts={location.fun_facts} />
      </motion.div>

      {quiz && (
        <motion.div variants={fadeIn(reduced)} className="mt-6 flex items-center justify-between rounded-2xl border-2 border-kids-accent/40 bg-kids-accent/10 p-4">
          <div>
            <p className="font-heading font-bold">{quiz.title}</p>
            <p className="text-sm text-muted-foreground">{t("kids.quiz.readyPrompt")}</p>
          </div>
          <Button asChild className="bg-kids-accent text-white hover:bg-kids-accent/90">
            <Link to={`/kids/explorer/world/${worldSlug}/${locationSlug}/quiz`}>
              <Volume2 className="me-1.5 h-4 w-4" aria-hidden="true" /> {t("kids.quiz.start")}
            </Link>
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
}
