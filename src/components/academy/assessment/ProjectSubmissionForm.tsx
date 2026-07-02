import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Rocket, Send, Link as LinkIcon, CheckCircle2, Clock, MessageSquare, RotateCcw, ListChecks, BookOpen,
} from "lucide-react";
import { submitProjectLocal, getProjectSubmissions } from "@/lib/academy/assessmentLocalStore";
import { awardAcademyXP } from "@/services/academy/academyService";
import type { AcademyProjectRow } from "@/lib/types/academy-lms";

const METHOD_PLACEHOLDER: Record<AcademyProjectRow["submission_method"], string> = {
  repo_url: "https://github.com/username/project",
  file_upload: "اسم الملف المرفوع",
  live_url: "https://your-project-demo.example.com",
};
const METHOD_LABEL: Record<AcademyProjectRow["submission_method"], string> = {
  repo_url: "رابط المستودع", file_upload: "رفع ملف", live_url: "رابط مباشر للمشروع",
};

interface ProjectSubmissionFormProps {
  project: AcademyProjectRow;
  userId: string;
}

export function ProjectSubmissionForm({ project, userId }: ProjectSubmissionFormProps) {
  const [url, setUrl] = useState("");
  const [, forceRender] = useState(0);

  const submissions = getProjectSubmissions(userId, project.id);
  const latest = submissions[0];

  const handleSubmit = () => {
    if (!url.trim()) return;
    const submission = submitProjectLocal(userId, project.id, url.trim());
    if (submission.attempt_number === 1) {
      void awardAcademyXP(userId, "academy_project_completed");
    }
    setUrl("");
    forceRender((n) => n + 1);
  };

  return (
    <div className="bg-card p-6 md:p-8 rounded-2xl border border-border space-y-6">
      <div className="flex items-start gap-3">
        <div className="p-2.5 bg-primary/10 text-primary rounded-xl shrink-0" aria-hidden="true"><Rocket className="w-5 h-5" /></div>
        <h3 className="font-black text-foreground">{project.title}</h3>
      </div>

      {project.description && <p className="text-sm text-foreground">{project.description}</p>}

      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown>{project.brief_markdown}</ReactMarkdown>
      </div>

      {project.requirements.length > 0 && (
        <div>
          <p className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1.5"><ListChecks className="w-3.5 h-3.5" aria-hidden="true" />المتطلبات</p>
          <ul className="space-y-1.5">
            {project.requirements.map((r) => (
              <li key={r} className="flex items-start gap-2 text-sm text-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" aria-hidden="true" />
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {project.steps.length > 0 && (
        <div>
          <p className="text-xs font-bold text-muted-foreground mb-2">خطوات العمل</p>
          <ol className="space-y-1.5 list-decimal list-inside">
            {project.steps.map((s) => <li key={s} className="text-sm text-foreground">{s}</li>)}
          </ol>
        </div>
      )}

      {project.resources.length > 0 && (
        <div>
          <p className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" aria-hidden="true" />موارد مساعدة</p>
          <ul className="space-y-1">
            {project.resources.map((res) => (
              <li key={res.url}>
                <a href={res.url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">{res.label}</a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {project.rubric.length > 0 && (
        <div className="p-4 rounded-xl bg-muted/50 border border-border">
          <p className="text-xs font-bold text-muted-foreground mb-2">معايير التقييم</p>
          <ul className="space-y-1">
            {project.rubric.map((r) => (
              <li key={r.criterion} className="flex justify-between text-sm text-foreground">
                <span>{r.criterion}</span>
                <span className="text-muted-foreground">{r.max_points} نقطة</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {submissions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-muted-foreground">سجل التسليمات</p>
          {submissions.map((s) => (
            <div key={s.id} className="p-4 rounded-xl bg-muted/50 border border-border space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-sm font-medium text-foreground">المحاولة {s.attempt_number}</span>
                <Badge variant={s.status === "reviewed" ? "default" : "secondary"} className="gap-1">
                  {s.status === "reviewed" ? <CheckCircle2 className="w-3 h-3" aria-hidden="true" /> : <Clock className="w-3 h-3" aria-hidden="true" />}
                  {s.status === "reviewed" ? "تمت المراجعة" : "قيد المراجعة"}
                </Badge>
              </div>
              {s.repo_or_file_url && <p className="text-xs text-primary truncate">{s.repo_or_file_url}</p>}
              {s.status === "reviewed" && (
                <div className="pt-2 border-t border-border/50 space-y-1">
                  {s.instructor_review && (
                    <p className="text-sm text-muted-foreground flex items-start gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                      {s.instructor_review}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3 pt-2 border-t border-border">
        <label htmlFor="project-submission-url" className="text-sm font-bold text-foreground flex items-center gap-1.5">
          <LinkIcon className="w-4 h-4" aria-hidden="true" />
          {METHOD_LABEL[project.submission_method]}
        </label>
        <Input id="project-submission-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={METHOD_PLACEHOLDER[project.submission_method]} className="rounded-xl" dir="ltr" />
        <Button onClick={handleSubmit} disabled={!url.trim()} className="gap-2 rounded-xl">
          {latest ? <RotateCcw className="w-4 h-4" aria-hidden="true" /> : <Send className="w-4 h-4" aria-hidden="true" />}
          {latest ? "إعادة تسليم المشروع" : "تسليم المشروع"}
        </Button>
      </div>
    </div>
  );
}
