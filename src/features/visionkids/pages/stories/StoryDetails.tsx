import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  BookOpen, Headphones, Heart, Download, GitBranch, Clock, User, Mic2, Eye, Star, Accessibility as AccessibilityIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";
import { fadeIn, slideUp, staggerContainer } from "@/features/visionkids/utils/animations";
import { useStoryBySlug, useIncrementStoryViewsOnce } from "@/features/visionkids/hooks/stories/useStoryCatalog";
import {
  useIsFavorite, useToggleFavorite, useMyRating, useRateStory, useLogDownload,
} from "@/features/visionkids/hooks/stories/useStoryEngagement";
import { useLogRecentlyViewed } from "@/features/visionkids/hooks/stories/useStoryDiscovery";
import { useQuizByStory } from "@/features/visionkids/hooks/stories/useStoryQuiz";
import { RatingStars } from "@/features/visionkids/components/stories/RatingStars";

export default function StoryDetails() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useLanguage();
  const { user } = useAuth();
  const reduced = useKidsReducedMotion();

  const { data: story, isLoading } = useStoryBySlug(slug);
  useIncrementStoryViewsOnce(story?.id);
  const { data: isFav } = useIsFavorite(user ? story?.id : undefined);
  const toggleFav = useToggleFavorite(story?.id ?? "");
  const { data: myRating } = useMyRating(story?.id);
  const rateStory = useRateStory(story?.id ?? "");
  const logDownload = useLogDownload();
  const { data: quiz } = useQuizByStory(story?.id);
  const logRecentlyViewed = useLogRecentlyViewed();

  const [hoverRating, setHoverRating] = useState<number | null>(null);

  useDocumentHead({
    title: story ? `${story.title} — VisionKids` : t("kids.stories.meta.title"),
    description: story?.description ?? t("kids.stories.meta.description"),
    canonicalPath: `/kids/stories/story/${slug}`,
  });

  useEffect(() => {
    if (story && user) logRecentlyViewed.mutate(story.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id, user?.id]);

  if (isLoading) {
    return <div className="mx-auto max-w-4xl px-4 py-16" aria-busy="true"><div className="h-64 animate-pulse rounded-2xl bg-muted" /></div>;
  }

  if (!story) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <p className="text-lg font-semibold">{t("kids.stories.notFound")}</p>
        <Button asChild variant="outline" className="mt-4"><Link to="/kids/stories">{t("kids.section.backHome")}</Link></Button>
      </div>
    );
  }

  const handleDownload = (format: "pdf" | "epub" | "audio") => {
    if (user) logDownload.mutate({ storyId: story.id, format });
    const url = format === "pdf" ? story.pdf_url : format === "epub" ? story.epub_url : story.audio_url;
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <motion.div initial="hidden" animate="visible" variants={staggerContainer(reduced)} className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <motion.div variants={slideUp(reduced)} className="flex flex-col gap-6 sm:flex-row">
        <div className="flex aspect-[4/3] w-full shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-kids-primary/30 to-kids-purple/30 sm:w-56">
          {story.cover_image_url ? (
            <img src={story.cover_image_url} alt="" className="h-full w-full rounded-2xl object-cover" />
          ) : (
            <BookOpen className="h-16 w-16 text-foreground/40" aria-hidden="true" />
          )}
        </div>

        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">{story.age_group}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold capitalize">{story.difficulty}</span>
            {story.is_interactive && (
              <span className="flex items-center gap-1 rounded-full bg-kids-purple/10 px-2 py-0.5 text-xs font-semibold text-kids-purple">
                <GitBranch className="h-3 w-3" aria-hidden="true" /> {t("kids.stories.interactive")}
              </span>
            )}
          </div>

          <h1 className="mt-2 font-heading text-2xl font-extrabold sm:text-3xl">{story.title}</h1>
          {story.subtitle && <p className="mt-1 text-muted-foreground">{story.subtitle}</p>}

          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {story.author && <span className="flex items-center gap-1"><User className="h-4 w-4" aria-hidden="true" /> {story.author.name}</span>}
            {story.narrator && <span className="flex items-center gap-1"><Mic2 className="h-4 w-4" aria-hidden="true" /> {story.narrator.name}</span>}
            {story.reading_time_minutes && <span className="flex items-center gap-1"><Clock className="h-4 w-4" aria-hidden="true" /> {story.reading_time_minutes}m</span>}
            <span className="flex items-center gap-1"><Eye className="h-4 w-4" aria-hidden="true" /> {story.views_count}</span>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <RatingStars value={story.rating_avg} count={story.rating_count} />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild className="gap-1.5 bg-kids-primary text-white hover:bg-kids-primary/90">
              <Link to={`/kids/stories/read/${story.slug}`}><BookOpen className="h-4 w-4" aria-hidden="true" /> {story.is_interactive ? t("kids.stories.startAdventure") : t("kids.stories.readNow")}</Link>
            </Button>
            {story.audio_url && (
              <Button asChild variant="outline" className="gap-1.5">
                <Link to={`/kids/stories/listen/${story.slug}`}><Headphones className="h-4 w-4" aria-hidden="true" /> {t("kids.stories.listen")}</Link>
              </Button>
            )}
            {user && (
              <Button variant="outline" size="icon" onClick={() => toggleFav.mutate(!isFav)} aria-pressed={!!isFav} aria-label={isFav ? t("kids.stories.removeFavorite") : t("kids.stories.addFavorite")}>
                <Heart className={isFav ? "h-4 w-4 fill-kids-pink text-kids-pink" : "h-4 w-4"} aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
      </motion.div>

      {story.description && (
        <motion.p variants={fadeIn(reduced)} className="mt-6 leading-relaxed text-foreground">{story.description}</motion.p>
      )}

      {story.gallery.length > 0 && (
        <motion.div variants={fadeIn(reduced)} className="mt-6">
          <h2 className="mb-2 font-heading text-lg font-bold">{t("kids.stories.gallery")}</h2>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {story.gallery.map((src, i) => (
              <img key={i} src={src} alt="" className="h-28 w-28 shrink-0 rounded-xl object-cover" loading="lazy" />
            ))}
          </div>
        </motion.div>
      )}

      {story.accessibility_features.length > 0 && (
        <motion.div variants={fadeIn(reduced)} className="mt-6 rounded-xl bg-kids-green/10 p-4">
          <h2 className="mb-2 flex items-center gap-2 font-heading text-sm font-bold text-kids-green">
            <AccessibilityIcon className="h-4 w-4" aria-hidden="true" /> {t("kids.stories.accessibilityFeatures")}
          </h2>
          <ul className="flex flex-wrap gap-2 text-xs text-foreground">
            {story.accessibility_features.map((f) => (
              <li key={f} className="rounded-full bg-background px-2 py-1">{f.replace(/_/g, " ")}</li>
            ))}
          </ul>
        </motion.div>
      )}

      <motion.div variants={fadeIn(reduced)} className="mt-6 flex flex-wrap gap-2">
        {story.pdf_url && <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleDownload("pdf")}><Download className="h-4 w-4" aria-hidden="true" /> PDF</Button>}
        {story.epub_url && <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleDownload("epub")}><Download className="h-4 w-4" aria-hidden="true" /> EPUB</Button>}
        {story.audio_url && <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleDownload("audio")}><Download className="h-4 w-4" aria-hidden="true" /> {t("kids.stories.audioFile")}</Button>}
      </motion.div>

      {quiz && (
        <motion.div variants={fadeIn(reduced)} className="mt-6 flex items-center justify-between rounded-2xl border-2 border-kids-accent/40 bg-kids-accent/10 p-4">
          <div>
            <p className="font-heading font-bold">{quiz.title}</p>
            <p className="text-sm text-muted-foreground">{t("kids.quiz.readyPrompt")}</p>
          </div>
          <Button asChild className="bg-kids-accent text-white hover:bg-kids-accent/90">
            <Link to={`/kids/stories/quiz/${story.slug}`}>{t("kids.quiz.start")}</Link>
          </Button>
        </motion.div>
      )}

      {user && (
        <motion.div variants={fadeIn(reduced)} className="mt-6 rounded-2xl border-2 border-border p-4">
          <p className="font-heading font-bold">{t("kids.stories.rateThisStory")}</p>
          <div className="mt-2" onMouseLeave={() => setHoverRating(null)}>
            <RatingStars
              value={hoverRating ?? myRating?.rating ?? 0}
              onChange={(v) => rateStory.mutate({ rating: v })}
              size={24}
            />
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
