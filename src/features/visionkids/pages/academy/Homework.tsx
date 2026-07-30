import { useState } from "react";
import { Link } from "react-router-dom";
import { FileText, Upload, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useMyHomework, useMyHomeworkSubmission, useSubmitHomework, useUploadSubmissionFile } from "@/features/visionkids/hooks/academy/useAcademyAssignments";
import type { Homework as HomeworkType } from "@/features/visionkids/types/academy.types";

function HomeworkItem({ homework }: { homework: HomeworkType }) {
  const { t } = useLanguage();
  const { data: submission } = useMyHomeworkSubmission(homework.id);
  const submitHomework = useSubmitHomework();
  const uploadFile = useUploadSubmissionFile();
  const [text, setText] = useState("");
  const [fileUrls, setFileUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadFile.mutateAsync({ file, ownerFolder: homework.id });
      setFileUrls((prev) => [...prev, url]);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = () => {
    submitHomework.mutate({ homeworkId: homework.id, textAnswer: text.trim() || undefined, fileUrls });
  };

  return (
    <div className="rounded-2xl border-2 border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-heading font-bold">{homework.title}</p>
          {homework.description && <p className="mt-0.5 text-sm text-muted-foreground">{homework.description}</p>}
          {homework.due_note && <p className="mt-1 text-xs text-kids-accent">{homework.due_note}</p>}
        </div>
        {submission && (
          <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${submission.status === "graded" ? "bg-kids-green/10 text-kids-green" : "bg-kids-accent/10 text-kids-accent"}`}>
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> {submission.status === "graded" ? `${t("kids.academy.graded")}: ${submission.grade}%` : t("kids.academy.submitted")}
          </span>
        )}
      </div>

      {!submission && (
        <div className="mt-3 flex flex-col gap-2">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={t("kids.academy.homeworkAnswerPlaceholder")} />
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border-2 border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted">
              <Upload className="h-4 w-4" aria-hidden="true" />
              {t("kids.academy.uploadFile")}
              <input type="file" accept="image/*,audio/*,application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
            </label>
            {uploading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />}
            {fileUrls.length > 0 && <span className="text-xs text-kids-green">{fileUrls.length} {t("kids.academy.filesAttached")}</span>}
          </div>
          <Button onClick={handleSubmit} disabled={submitHomework.isPending || (!text.trim() && fileUrls.length === 0)} className="self-start bg-kids-primary text-white hover:bg-kids-primary/90">
            {t("kids.academy.submitHomework")}
          </Button>
        </div>
      )}

      {submission?.feedback && (
        <p className="mt-3 rounded-lg bg-muted p-2 text-sm"><strong>{t("kids.academy.feedback")}:</strong> {submission.feedback}</p>
      )}
    </div>
  );
}

export default function Homework() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: homeworkList = [], isLoading } = useMyHomework();

  useDocumentHead({ title: t("kids.academy.homeworkTitle"), description: t("kids.academy.meta.description"), canonicalPath: "/kids/academy/homework" });

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <FileText className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden="true" />
        <p className="mt-3 text-lg font-semibold">{t("kids.stories.signInRequired")}</p>
        <Link to="/login" className="mt-2 inline-block text-kids-primary hover:underline">{t("nav.login")}</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="flex items-center gap-2 font-heading text-3xl font-extrabold">
        <FileText className="h-7 w-7 text-kids-primary" aria-hidden="true" /> {t("kids.academy.homeworkTitle")}
      </h1>

      {isLoading ? (
        <div className="mt-6 flex flex-col gap-3" aria-busy="true">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : homeworkList.length === 0 ? (
        <p className="mt-8 text-center text-muted-foreground">{t("kids.academy.noHomeworkYet")}</p>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {homeworkList.map((h) => <HomeworkItem key={h.id} homework={h} />)}
        </div>
      )}
    </div>
  );
}
