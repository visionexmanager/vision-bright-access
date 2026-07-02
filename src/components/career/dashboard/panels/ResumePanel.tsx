import { FileText, Star, Plus, Download } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useComingSoon } from "@/components/career/useComingSoon";
import { MOCK_RESUMES } from "../mock/mockResumes";

export function ResumePanel() {
  const { t } = useLanguage();
  const handleAction = useComingSoon();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="type-heading mb-1">{t("careerDash.nav.resume")}</h1>
          <p className="text-sm text-muted-foreground">{t("careerDash.resume.subtitle")}</p>
        </div>
        <Button onClick={handleAction}>
          <Plus className="me-2 h-4 w-4" aria-hidden="true" />
          {t("careerDash.resume.create")}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MOCK_RESUMES.map((resume) => (
          <div key={resume.id} className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-5">
            <div className="flex items-start justify-between gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileText className="h-5 w-5" aria-hidden="true" />
              </span>
              {resume.isPrimary && (
                <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                  <Star className="h-3 w-3 fill-current" aria-hidden="true" />
                  {t("careerDash.resume.primary")}
                </span>
              )}
            </div>
            <div>
              <p className="text-sm font-bold">{resume.name}</p>
              <p className="text-xs text-muted-foreground">{t("careerDash.resume.updated")} {resume.updatedAt}</p>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>{t("careerDash.resume.completeness")}</span>
                <span>{resume.completeness}%</span>
              </div>
              <Progress value={resume.completeness} aria-label={t("careerDash.resume.completeness")} />
            </div>
            <div className="mt-1 flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={handleAction}>{t("careerDash.resume.editBtn")}</Button>
              <Button variant="ghost" size="icon" onClick={handleAction} aria-label={t("careerDash.resume.download")}>
                <Download className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
