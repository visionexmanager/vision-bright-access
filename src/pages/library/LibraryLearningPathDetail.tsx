import { useParams } from "react-router-dom";
import { Route, CheckCircle2, Lock, SkipForward, Award, Clock } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { SkeletonLoader } from "@/components/library/SkeletonLoader";
import { EmptyState } from "@/components/library/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useLearningPath } from "@/hooks/library/useLearningPath";
import { useCertificates } from "@/hooks/library/useCertificates";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";

export default function LibraryLearningPathDetail() {
  const { pathId } = useParams<{ pathId: string }>();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { path, enrollment, progress, isLoading, enroll, completeItem } = useLearningPath(pathId);
  const { isIssuing, issue } = useCertificates();

  useDocumentHead({ title: path?.title ?? t("library.learningPaths.title") });

  if (isLoading) {
    return (
      <Layout>
        <LibraryLayout title={t("library.learningPaths.title")} breadcrumb={[{ label: t("library.learningPaths.title"), to: "/library/learning-paths" }]}>
          <SkeletonLoader variant="detail" />
        </LibraryLayout>
      </Layout>
    );
  }

  if (!path) {
    return (
      <Layout>
        <LibraryLayout title={t("library.learningPaths.title")} breadcrumb={[{ label: t("library.learningPaths.title"), to: "/library/learning-paths" }]}>
          <EmptyState icon={<Route className="h-8 w-8" />} title={t("library.learningPaths.notFound")} className="py-12" />
        </LibraryLayout>
      </Layout>
    );
  }

  const progressPercent = enrollment?.progress_percent ?? 0;

  return (
    <Layout>
      <LibraryLayout
        title={path.title}
        breadcrumb={[{ label: t("library.learningPaths.title"), to: "/library/learning-paths" }, { label: path.title }]}
      >
        <div className="mb-6 space-y-3">
          {path.description && <p className="text-muted-foreground">{path.description}</p>}
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">{t(`library.learningPaths.level.${path.level}`)}</Badge>
            {path.is_certification_track && (
              <Badge variant="outline" className="gap-1"><Award className="h-3 w-3" aria-hidden="true" /> {t("library.learningPaths.certificationBadge")}</Badge>
            )}
            {path.estimated_minutes && (
              <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" aria-hidden="true" /> {t("library.learningPaths.estimatedTime").replace("{minutes}", String(path.estimated_minutes))}</Badge>
            )}
          </div>

          {user && (
            enrollment ? (
              <div>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium">{t("library.learningPaths.progress")}</span>
                  <span>{progressPercent}%</span>
                </div>
                <Progress value={progressPercent} aria-label={`${path.title}: ${progressPercent}%`} />
                {enrollment.completed_at && (
                  <div className="mt-2 space-y-2">
                    <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> {t("library.learningPaths.completed")}
                    </p>
                    {path.is_certification_track && pathId && (
                      <Button size="sm" variant="outline" disabled={isIssuing} onClick={() => void issue("learning_path", pathId)}>
                        {isIssuing ? t("library.certificates.claiming") : t("library.certificates.claim")}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <Button onClick={() => void enroll()}>{t("library.learningPaths.enroll")}</Button>
            )
          )}
        </div>

        <h2 className="mb-3 text-lg font-semibold">{t("library.learningPaths.items")}</h2>
        <ol className="space-y-2">
          {progress.map((item, index) => (
            <li
              key={item.item_id}
              className={cn(
                "flex items-center justify-between gap-3 rounded-lg border p-3",
                item.is_skipped && "opacity-60",
                !item.is_unlocked && !item.is_skipped && "opacity-70",
              )}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium">
                  {index + 1}
                </span>
                <div>
                  <p className="font-medium">{item.title}</p>
                  {item.is_skipped && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground"><SkipForward className="h-3 w-3" aria-hidden="true" /> {t("library.learningPaths.itemSkipped")}</p>
                  )}
                  {!item.is_unlocked && !item.is_skipped && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground"><Lock className="h-3 w-3" aria-hidden="true" /> {t("library.learningPaths.itemLocked")}</p>
                  )}
                </div>
              </div>
              {item.completed ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              ) : item.is_unlocked && enrollment ? (
                <Button size="sm" variant="outline" onClick={() => void completeItem(item.item_id)}>
                  {t("library.learningPaths.markComplete")}
                </Button>
              ) : null}
            </li>
          ))}
        </ol>
      </LibraryLayout>
    </Layout>
  );
}
