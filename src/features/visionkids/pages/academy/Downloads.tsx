import { Link } from "react-router-dom";
import { Download, Video, Music, FileText, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useDownloadableLessons, useAllWorksheets } from "@/features/visionkids/hooks/academy/useAcademyCatalog";
import { useMyAcademyDownloads, useLogAcademyDownload } from "@/features/visionkids/hooks/academy/useAcademyAnalytics";

export default function Downloads() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: lessons = [], isLoading: lessonsLoading } = useDownloadableLessons();
  const { data: worksheets = [], isLoading: worksheetsLoading } = useAllWorksheets();
  const { data: history = [] } = useMyAcademyDownloads();
  const logDownload = useLogAcademyDownload();

  useDocumentHead({ title: t("kids.academy.downloadsTitle"), description: t("kids.academy.meta.description"), canonicalPath: "/kids/academy/downloads" });

  const download = (url: string, format: "video" | "audio" | "worksheet", lessonId?: string, worksheetId?: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
    if (user) logDownload.mutate({ lessonId, worksheetId, format });
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="flex items-center gap-2 font-heading text-3xl font-extrabold">
        <Download className="h-7 w-7 text-kids-primary" aria-hidden="true" /> {t("kids.academy.downloadsTitle")}
      </h1>
      <p className="mt-1 text-muted-foreground">{t("kids.academy.downloadsSubtitle")}</p>

      <section className="mt-6">
        <h2 className="mb-2 font-heading text-lg font-bold">{t("kids.academy.offlineLessons")}</h2>
        {lessonsLoading ? (
          <div className="flex flex-col gap-2" aria-busy="true">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />)}</div>
        ) : lessons.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("kids.academy.noDownloadsYet")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {lessons.map((lesson) => (
              <li key={lesson.id} className="flex items-center justify-between rounded-xl border-2 border-border p-3">
                <span className="font-medium">{lesson.title}</span>
                <div className="flex gap-2">
                  {lesson.video_url && (
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => download(lesson.video_url!, "video", lesson.id)}>
                      <Video className="h-4 w-4" aria-hidden="true" /> {t("kids.academy.video")}
                    </Button>
                  )}
                  {lesson.audio_url && (
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => download(lesson.audio_url!, "audio", lesson.id)}>
                      <Music className="h-4 w-4" aria-hidden="true" /> {t("kids.academy.audio")}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h2 className="mb-2 font-heading text-lg font-bold">{t("kids.academy.offlineWorksheets")}</h2>
        {worksheetsLoading ? (
          <div className="h-14 animate-pulse rounded-xl bg-muted" aria-busy="true" />
        ) : worksheets.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("kids.academy.noDownloadsYet")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {worksheets.map((w) => (
              <li key={w.id} className="flex items-center justify-between rounded-xl border-2 border-border p-3">
                <span className="font-medium">{w.title}</span>
                <Button size="sm" variant="outline" className="gap-1" onClick={() => download(w.file_url, "worksheet", undefined, w.id)}>
                  <FileText className="h-4 w-4" aria-hidden="true" /> PDF
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {user && history.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 flex items-center gap-1.5 font-heading text-lg font-bold"><History className="h-5 w-5 text-muted-foreground" aria-hidden="true" /> {t("kids.academy.downloadHistory")}</h2>
          <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
            {history.slice(0, 10).map((d) => (
              <li key={d.id}>{new Date(d.downloaded_at).toLocaleDateString()} — {d.format}</li>
            ))}
          </ul>
        </section>
      )}

      {!user && (
        <p className="mt-8 text-center text-sm text-muted-foreground">
          <Link to="/login" className="font-semibold text-kids-primary hover:underline">{t("nav.login")}</Link> {t("kids.academy.toTrackDownloads")}
        </p>
      )}
    </div>
  );
}
