import { useEffect, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft, PlayCircle, VideoOff } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useReplays, useMyReplayProgress, useSaveReplayProgress, useIncrementReplayView } from "@/features/visionkids/hooks/events/useReplay";

export default function ReplayPlayer() {
  const { replayId } = useParams<{ replayId: string }>();
  const { t } = useLanguage();
  const { data: replays = [] } = useReplays();
  const replay = replays.find((r) => r.id === replayId);
  const { data: progress } = useMyReplayProgress(replayId);
  const saveProgress = useSaveReplayProgress(replayId);
  const incrementView = useIncrementReplayView();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasIncrementedRef = useRef(false);

  useDocumentHead({ title: replay?.event ? `${replay.event.title} — VisionKids` : t("kids.events.meta.title"), description: "", canonicalPath: `/kids/events/replays/${replayId}` });

  useEffect(() => {
    if (videoRef.current && progress?.position_seconds) {
      videoRef.current.currentTime = progress.position_seconds;
    }
  }, [progress]);

  const handleTimeUpdate = () => {
    if (!videoRef.current || !replayId) return;
    if (!hasIncrementedRef.current) {
      hasIncrementedRef.current = true;
      incrementView.mutate(replayId);
    }
    saveProgress.mutate(Math.floor(videoRef.current.currentTime));
  };

  if (!replay) return <div className="mx-auto max-w-2xl px-4 py-16" aria-busy="true"><div className="h-64 animate-pulse rounded-2xl bg-muted" /></div>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Link to="/kids/events/replays" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {t("kids.events.nav.replays")}
      </Link>

      <h1 className="flex items-center gap-2 font-heading text-2xl font-extrabold"><PlayCircle className="h-6 w-6 text-kids-green" aria-hidden="true" /> {replay.event?.title}</h1>

      {replay.video_url ? (
        <video
          ref={videoRef}
          controls
          src={replay.video_url}
          poster={replay.thumbnail_url ?? undefined}
          className="mt-4 aspect-video w-full rounded-2xl bg-black"
          onTimeUpdate={handleTimeUpdate}
        >
          {replay.captions_url && <track kind="captions" src={replay.captions_url} default />}
        </video>
      ) : (
        <div className="mt-4 flex aspect-video flex-col items-center justify-center gap-2 rounded-2xl bg-muted text-center">
          <VideoOff className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">{t("kids.events.replays.noRecordingYet")}</p>
        </div>
      )}

      {replay.event?.description && <p className="mt-4 text-muted-foreground">{replay.event.description}</p>}
    </div>
  );
}
