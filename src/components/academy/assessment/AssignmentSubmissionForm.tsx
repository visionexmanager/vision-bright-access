import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardList, Upload, Send, Clock, CheckCircle2, MessageSquare, RotateCcw,
} from "lucide-react";
import { submitAssignmentLocal, getAssignmentSubmissions } from "@/lib/academy/assessmentLocalStore";
import type { AcademyAssignmentRow } from "@/lib/types/academy-lms";

const TYPE_LABEL: Record<AcademyAssignmentRow["type"], string> = {
  written: "إجابة كتابية", file_upload: "رفع ملف", coding: "مهمة برمجية", research: "مهمة بحثية", problem_solving: "حل مسألة",
};
const STATUS_LABEL: Record<string, string> = { submitted: "قيد المراجعة", graded: "تم التقييم", returned: "أُعيد للتعديل" };

interface AssignmentSubmissionFormProps {
  assignment: AcademyAssignmentRow;
  userId: string;
}

export function AssignmentSubmissionForm({ assignment, userId }: AssignmentSubmissionFormProps) {
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [, forceRender] = useState(0);

  const submissions = getAssignmentSubmissions(userId, assignment.id);
  const canSubmit = submissions.length === 0 || assignment.allow_resubmission;

  const handleSubmit = () => {
    if (!content.trim() && !fileName) return;
    submitAssignmentLocal(userId, assignment.id, null, content.trim() || null, fileName);
    setContent("");
    setFileName(null);
    forceRender((n) => n + 1);
  };

  return (
    <div className="bg-card p-6 md:p-8 rounded-2xl border border-border space-y-6">
      <div className="flex items-start gap-3">
        <div className="p-2.5 bg-primary/10 text-primary rounded-xl shrink-0" aria-hidden="true"><ClipboardList className="w-5 h-5" /></div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-black text-foreground">{assignment.title}</h3>
            <Badge variant="secondary">{TYPE_LABEL[assignment.type]}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            الدرجة القصوى: {assignment.max_score}
            {assignment.due_offset_days != null && ` · الموعد النهائي: خلال ${assignment.due_offset_days} يوماً من التسجيل`}
          </p>
        </div>
      </div>

      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown>{assignment.instructions_markdown}</ReactMarkdown>
      </div>

      {assignment.rubric.length > 0 && (
        <div className="p-4 rounded-xl bg-muted/50 border border-border">
          <p className="text-xs font-bold text-muted-foreground mb-2">معايير التقييم</p>
          <ul className="space-y-1">
            {assignment.rubric.map((r) => (
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
                <Badge variant={s.status === "graded" ? "default" : "secondary"} className="gap-1">
                  {s.status === "graded" ? <CheckCircle2 className="w-3 h-3" aria-hidden="true" /> : <Clock className="w-3 h-3" aria-hidden="true" />}
                  {STATUS_LABEL[s.status]}
                </Badge>
              </div>
              {s.notes && <p className="text-sm text-muted-foreground">{s.notes}</p>}
              {s.file_name && <p className="text-xs text-muted-foreground">الملف: {s.file_name}</p>}
              {s.status === "graded" && (
                <div className="pt-2 border-t border-border/50 space-y-1">
                  <p className="text-sm font-bold text-foreground">الدرجة: {s.score}/{assignment.max_score}</p>
                  {s.instructor_feedback && (
                    <p className="text-sm text-muted-foreground flex items-start gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                      {s.instructor_feedback}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {canSubmit && (
        <div className="space-y-3 pt-2 border-t border-border">
          {assignment.type === "file_upload" ? (
            <div>
              <label htmlFor="assignment-file" className="text-sm font-bold text-foreground">اسم الملف المرفوع</label>
              <div className="flex items-center gap-2 mt-1.5">
                <Upload className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                <Input id="assignment-file" value={fileName ?? ""} onChange={(e) => setFileName(e.target.value)} placeholder="مثال: assignment.pdf" className="rounded-xl" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">رفع الملفات الفعلي قيد التطوير — أدخل اسم الملف للتوثيق حالياً.</p>
            </div>
          ) : null}
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={assignment.type === "coding" ? "الصق الكود أو رابط المستودع..." : "اكتب إجابتك هنا..."}
            className={`rounded-xl min-h-32 ${assignment.type === "coding" ? "font-mono text-sm" : ""}`}
            dir={assignment.type === "coding" ? "ltr" : undefined}
          />
          <Button onClick={handleSubmit} disabled={!content.trim() && !fileName} className="gap-2 rounded-xl">
            {submissions.length > 0 ? <RotateCcw className="w-4 h-4" aria-hidden="true" /> : <Send className="w-4 h-4" aria-hidden="true" />}
            {submissions.length > 0 ? "إعادة التسليم" : "تسليم الواجب"}
          </Button>
        </div>
      )}
    </div>
  );
}
