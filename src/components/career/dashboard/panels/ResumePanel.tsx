import { useRef } from "react";
import { FileText, Upload, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { useCareerProfile } from "@/hooks/career/useCareerProfile";
import { CareerErrorState } from "../../ui/CareerErrorState";

const ACCEPTED = ".pdf,.doc,.docx";
const MAX_SIZE_MB = 10;

// Simplified from the earlier mock's multi-version "resumes" list to a
// single real upload — career_profiles.resume_url is one column, there's no
// versions table in the deployed schema.
export function ResumePanel() {
  const { t } = useLanguage();
  const { profile, isLoading, error, refetch, uploadResume, isUploadingResume } = useCareerProfile();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(t("careerDash.resume.tooLarge").replace("{max}", String(MAX_SIZE_MB)));
      return;
    }
    try {
      await uploadResume(file);
      toast.success(t("careerDash.resume.uploadSuccess"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("careerDash.resume.uploadError"));
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="type-heading mb-1">{t("careerDash.nav.resume")}</h1>
          <p className="text-sm text-muted-foreground">{t("careerDash.resume.subtitle")}</p>
        </div>
        <input ref={inputRef} type="file" accept={ACCEPTED} className="sr-only" onChange={onFileChange} aria-label={t("careerDash.resume.upload")} />
        <Button onClick={() => inputRef.current?.click()} disabled={isUploadingResume}>
          {isUploadingResume ? <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="me-2 h-4 w-4" aria-hidden="true" />}
          {profile?.resume_url ? t("careerDash.resume.replace") : t("careerDash.resume.upload")}
        </Button>
      </div>

      {isLoading ? (
        <div className="h-40 rounded-2xl border border-border/60 bg-card animate-pulse" aria-hidden="true" />
      ) : error ? (
        <CareerErrorState message={error} onRetry={refetch} className="rounded-2xl border border-border/60 bg-card" />
      ) : profile?.resume_url ? (
        <div className="flex max-w-md flex-col gap-3 rounded-2xl border border-border/60 bg-card p-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileText className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="text-sm font-bold">{t("careerDash.resume.onFile")}</p>
          <p className="text-xs text-muted-foreground">{t("careerDash.resume.updated")} {new Date(profile.updated_at).toLocaleDateString()}</p>
          <Button variant="outline" size="sm" asChild className="w-fit">
            <a href={profile.resume_url} target="_blank" rel="noopener noreferrer">
              <Download className="me-2 h-3.5 w-3.5" aria-hidden="true" />
              {t("careerDash.resume.download")}
            </a>
          </Button>
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {t("careerDash.resume.empty")}
        </p>
      )}
    </div>
  );
}
