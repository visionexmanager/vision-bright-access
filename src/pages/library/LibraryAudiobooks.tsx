import { Link } from "react-router-dom";
import { Headphones } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { SkeletonLoader } from "@/components/library/SkeletonLoader";
import { EmptyState } from "@/components/library/EmptyState";
import { Card } from "@/components/ui/card";
import { useAudiobooks } from "@/hooks/library/useAudiobooks";
import { useLanguage } from "@/contexts/LanguageContext";

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export default function LibraryAudiobooks() {
  const { t } = useLanguage();
  const { audiobooks, isLoading } = useAudiobooks();

  return (
    <Layout>
      <LibraryLayout title={t("library.nav.audiobooks")} breadcrumb={[{ label: t("library.nav.audiobooks") }]}>
        {isLoading ? (
          <SkeletonLoader variant="list" />
        ) : audiobooks.length === 0 ? (
          <EmptyState icon={<Headphones className="h-10 w-10" />} title={t("library.emptyState.noAudiobooksTitle")} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
            {audiobooks.map((audiobook) => (
              <Link key={audiobook.id} to={`/library/audiobooks/${audiobook.id}`} role="listitem" className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
                <Card className="flex items-center gap-4 p-4 transition-shadow hover:shadow-md">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary" aria-hidden="true">
                    <Headphones className="h-7 w-7" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">{audiobook.title}</h3>
                    <p className="truncate text-sm text-muted-foreground">{audiobook.author_name}</p>
                    <p className="text-xs text-muted-foreground">{t("library.audiobooks.narratedBy").replace("{narrator}", audiobook.narrator_name)} · {formatDuration(audiobook.duration_seconds)}</p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </LibraryLayout>
    </Layout>
  );
}
