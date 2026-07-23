import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Headphones } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlayerControls } from "@/components/library/PlayerControls";
import { SkeletonLoader } from "@/components/library/SkeletonLoader";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAudiobookProgress } from "@/hooks/library/useAudiobookProgress";
import { fetchAudiobookForBook } from "@/services/library/audiobooks";

interface AudiobookProgressCardProps {
  bookId: string;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatFileSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`;
}

/** Summary card: duration/file-size/last-position/playback-speed plus a
 *  "Resume Listening" link into the reader. The interactive PlayerControls
 *  here only drives the free `sample_url` preview — the full protected
 *  audio file requires a signed URL resolved by the reading engine itself
 *  (out of this phase's scope; not a persisted position). */
export function AudiobookProgressCard({ bookId }: AudiobookProgressCardProps) {
  const { t } = useLanguage();
  const { progress, hasStarted, isLoading: progressLoading } = useAudiobookProgress(bookId);
  const { data: audiobook, isLoading: audiobookLoading } = useQuery({
    queryKey: ["library", "audiobook-for-book", bookId],
    queryFn: () => fetchAudiobookForBook(bookId),
    enabled: !!bookId,
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [rate, setRate] = useState(1);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => setPosition(el.currentTime);
    const onEnd = () => setIsPlaying(false);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("ended", onEnd);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("ended", onEnd);
    };
  }, [audiobook?.sampleUrl]);

  if (progressLoading || audiobookLoading) return <SkeletonLoader variant="detail" />;
  if (!audiobook) return null;

  const lastPositionSeconds = progress.last_position?.position_seconds;
  const lastPlaybackRate = progress.last_position?.playback_rate;

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (isPlaying) el.pause();
    else void el.play();
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (delta: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(el.duration || 0, el.currentTime + delta));
  };

  const handleRateChange = (newRate: number) => {
    setRate(newRate);
    if (audioRef.current) audioRef.current.playbackRate = newRate;
  };

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-center gap-2">
        <Headphones className="h-5 w-5 text-primary" aria-hidden="true" />
        <h2 className="text-lg font-semibold">{t("library.bookDetails.audiobook")}</h2>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-muted-foreground sm:grid-cols-4">
        {audiobook.narratorName && (
          <div>
            <dt className="sr-only">{t("library.bookDetails.narrator")}</dt>
            <dd>{audiobook.narratorName}</dd>
          </div>
        )}
        <div>
          <dt className="sr-only">{t("library.bookDetails.duration")}</dt>
          <dd>{formatDuration(audiobook.durationSeconds)}</dd>
        </div>
        {audiobook.fileSizeBytes != null && (
          <div>
            <dt className="sr-only">{t("library.bookDetails.fileSize")}</dt>
            <dd>{formatFileSize(audiobook.fileSizeBytes)}</dd>
          </div>
        )}
        {hasStarted && lastPositionSeconds != null && (
          <div>
            <dt className="sr-only">{t("library.bookDetails.lastPosition")}</dt>
            <dd>{formatDuration(lastPositionSeconds)}{lastPlaybackRate ? ` · ${lastPlaybackRate}x` : ""}</dd>
          </div>
        )}
      </dl>

      {hasStarted && (
        <Button asChild>
          <Link to={`/library/read/${bookId}`}>{t("library.bookDetails.resumeListening")}</Link>
        </Button>
      )}

      {audiobook.sampleUrl && (
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">{t("library.bookDetails.previewSample")}</p>
          <audio ref={audioRef} src={audiobook.sampleUrl} preload="none" />
          <PlayerControls
            isPlaying={isPlaying}
            onTogglePlay={togglePlay}
            positionSeconds={position}
            durationSeconds={audioRef.current?.duration || 0}
            onSeek={handleSeek}
            playbackRate={rate}
            onPlaybackRateChange={handleRateChange}
          />
        </div>
      )}
    </Card>
  );
}
