import { useEffect, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useStoryBySlug, useStoryChapters } from "@/features/visionkids/hooks/stories/useStoryCatalog";
import { useReadingProgress, useSaveReadingProgress, useAddBookmark } from "@/features/visionkids/hooks/stories/useStoryEngagement";
import { AudioPlayerBar } from "@/features/visionkids/components/stories/AudioPlayerBar";

export default function StoryAudioPlayer() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: story } = useStoryBySlug(slug);
  const { data: chapters = [] } = useStoryChapters(story?.id);
  const { data: progress } = useReadingProgress(story?.id);
  const saveProgress = useSaveReadingProgress();
  const addBookmark = useAddBookmark();
  const lastSavedAt = useRef(0);

  useDocumentHead({ title: story ? `${story.title} — VisionKids` : t("kids.stories.meta.title"), description: story?.description ?? "", canonicalPath: `/kids/stories/listen/${slug}` });

  useEffect(() => () => { lastSavedAt.current = 0; }, [story?.id]);

  if (!story) return <div className="mx-auto max-w-2xl px-4 py-16" aria-busy="true"><div className="h-40 animate-pulse rounded-2xl bg-muted" /></div>;

  if (!story.audio_url) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-lg font-semibold">{t("kids.audio.notAvailable")}</p>
        <Link to={`/kids/stories/story/${story.slug}`} className="mt-4 inline-block text-kids-primary hover:underline">{t("kids.section.backHome")}</Link>
      </div>
    );
  }

  const handleProgress = (position: number, duration: number) => {
    if (!user || !duration) return;
    const now = Date.now();
    if (now - lastSavedAt.current < 15000) return; // throttle writes to every ~15s
    lastSavedAt.current = now;
    const percent = (position / duration) * 100;
    saveProgress.mutate({
      storyId: story.id,
      audioPositionSeconds: Math.round(position),
      progressPercent: percent,
      minutesReadDelta: 0,
      completed: percent > 97,
    });
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Link to={`/kids/stories/story/${story.slug}`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {story.title}
      </Link>

      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <div className="flex h-40 w-40 items-center justify-center rounded-3xl bg-gradient-to-br from-kids-primary/30 to-kids-purple/30">
          {story.cover_image_url ? (
            <img src={story.cover_image_url} alt="" className="h-full w-full rounded-3xl object-cover" />
          ) : (
            <span className="text-5xl" aria-hidden="true">🎧</span>
          )}
        </div>
        <h1 className="font-heading text-2xl font-extrabold">{story.title}</h1>
        {story.narrator && <p className="text-sm text-muted-foreground">{t("kids.stories.narratedBy")} {story.narrator.name}</p>}
      </div>

      <AudioPlayerBar
        audioUrl={story.audio_url}
        title={story.title}
        coverImageUrl={story.cover_image_url}
        chapters={chapters}
        startPositionSeconds={progress?.audio_position_seconds ?? 0}
        onProgress={handleProgress}
        onBookmark={(position) => user && addBookmark.mutate({ storyId: story.id, pageNumber: 0, label: `${Math.round(position)}s` })}
      />
    </div>
  );
}
