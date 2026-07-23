import { useParams } from "react-router-dom";
import { useState } from "react";
import { Headphones } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { PlayerControls } from "@/components/library/PlayerControls";
import { SkeletonLoader } from "@/components/library/SkeletonLoader";
import { EmptyState } from "@/components/library/EmptyState";
import { useAudiobookDetails } from "@/hooks/library/useAudiobooks";
import { useLanguage } from "@/contexts/LanguageContext";

export default function LibraryAudiobookPlayer() {
  const { t } = useLanguage();
  const { audiobookId } = useParams<{ audiobookId: string }>();
  const { audiobook, isLoading } = useAudiobookDetails(audiobookId);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [rate, setRate] = useState(1);

  return (
    <Layout>
      <LibraryLayout
        title={audiobook?.title ?? t("library.nav.audiobooks")}
        breadcrumb={audiobook ? [{ label: t("library.nav.audiobooks"), to: "/library/audiobooks" }, { label: audiobook.title }] : []}
      >
        {isLoading ? (
          <SkeletonLoader variant="detail" />
        ) : !audiobook ? (
          <EmptyState icon={<Headphones className="h-10 w-10" />} title={t("library.emptyState.audiobookNotFoundTitle")} actionLabel={t("library.nav.audiobooks")} actionTo="/library/audiobooks" />
        ) : (
          <div className="mx-auto max-w-md space-y-6 text-center">
            <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-2xl bg-primary/10 text-primary" aria-hidden="true">
              <Headphones className="h-16 w-16" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{audiobook.title}</h2>
              <p className="text-sm text-muted-foreground">{audiobook.author_name}</p>
              <p className="text-xs text-muted-foreground">{t("library.audiobooks.narratedBy").replace("{narrator}", audiobook.narrator_name)}</p>
            </div>
            <PlayerControls
              isPlaying={isPlaying}
              onTogglePlay={() => setIsPlaying((p) => !p)}
              positionSeconds={position}
              durationSeconds={audiobook.duration_seconds}
              onSeek={(delta) => setPosition((p) => Math.max(0, Math.min(audiobook.duration_seconds, p + delta)))}
              playbackRate={rate}
              onPlaybackRateChange={setRate}
            />
            <p className="text-xs text-muted-foreground">{t("library.player.previewNotice")}</p>
          </div>
        )}
      </LibraryLayout>
    </Layout>
  );
}
