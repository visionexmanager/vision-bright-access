import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft, Rocket, Upload, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useProjectById } from "@/features/visionkids/hooks/academy/useAcademyCatalog";
import { useMyProjectSubmission, useSubmitProject, useUploadSubmissionFile } from "@/features/visionkids/hooks/academy/useAcademyAssignments";

export default function ProjectSubmit() {
  const { projectId } = useParams<{ projectId: string }>();
  const { t } = useLanguage();
  const { user } = useAuth();

  const { data: project, isLoading } = useProjectById(projectId);
  const { data: submission } = useMyProjectSubmission(projectId);
  const submitProject = useSubmitProject();
  const uploadFile = useUploadSubmissionFile();

  const [text, setText] = useState("");
  const [fileUrls, setFileUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  useDocumentHead({ title: project ? `${project.title} — VisionKids` : t("kids.academy.projectsTitle"), description: project?.description ?? "", canonicalPath: `/kids/academy/projects/${projectId}` });

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-lg font-semibold">{t("kids.stories.signInRequired")}</p>
        <Link to="/login" className="mt-2 inline-block text-kids-primary hover:underline">{t("nav.login")}</Link>
      </div>
    );
  }

  if (isLoading) return <div className="mx-auto max-w-xl px-4 py-16" aria-busy="true"><div className="h-64 animate-pulse rounded-2xl bg-muted" /></div>;
  if (!project) return <div className="mx-auto max-w-xl px-4 py-16 text-center text-muted-foreground">{t("kids.academy.projectNotFound")}</div>;

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadFile.mutateAsync({ file, ownerFolder: project.id });
      setFileUrls((prev) => [...prev, url]);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-8 sm:px-6">
      <Link to="/kids/academy/projects" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {t("kids.academy.projectsTitle")}
      </Link>

      <h1 className="flex items-center gap-2 font-heading text-2xl font-extrabold"><Rocket className="h-6 w-6 text-kids-purple" aria-hidden="true" /> {project.title}</h1>
      {project.description && <p className="mt-2 text-muted-foreground">{project.description}</p>}
      {project.instructions && <p className="mt-3 rounded-xl bg-muted p-3 text-sm leading-relaxed">{project.instructions}</p>}

      {submission ? (
        <div className="mt-6 rounded-2xl border-2 border-kids-green/40 bg-kids-green/10 p-4">
          <p className="flex items-center gap-2 font-heading font-bold text-kids-green"><CheckCircle2 className="h-5 w-5" aria-hidden="true" /> {t("kids.academy.submitted")}</p>
          {submission.text_content && <p className="mt-2 text-sm">{submission.text_content}</p>}
          {submission.status === "graded" && <p className="mt-2 text-sm font-semibold">{t("kids.academy.grade")}: {submission.grade}%</p>}
          {submission.feedback && <p className="mt-1 text-sm text-muted-foreground">{submission.feedback}</p>}
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={t("kids.academy.projectAnswerPlaceholder")} className="min-h-28" />
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border-2 border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted">
              <Upload className="h-4 w-4" aria-hidden="true" />
              {t("kids.academy.uploadFile")}
              <input type="file" accept="image/*,audio/*,application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
            </label>
            {uploading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />}
            {fileUrls.length > 0 && <span className="text-xs text-kids-green">{fileUrls.length} {t("kids.academy.filesAttached")}</span>}
          </div>
          <Button
            onClick={() => submitProject.mutate({ projectId: project.id, textContent: text.trim() || undefined, fileUrls, project })}
            disabled={submitProject.isPending || (!text.trim() && fileUrls.length === 0)}
            className="self-start bg-kids-purple text-white hover:bg-kids-purple/90"
          >
            {t("kids.academy.submitProject")}
          </Button>
        </div>
      )}
    </div>
  );
}
