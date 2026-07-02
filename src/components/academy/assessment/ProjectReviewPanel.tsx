import { Rocket } from "lucide-react";
import { RubricScoringForm } from "./RubricScoringForm";
import { reviewProjectSubmissionLocal } from "@/lib/academy/assessmentLocalStore";
import type { AcademyProjectRow, AcademyProjectSubmissionRow } from "@/lib/types/academy-lms";

interface PendingProjectItem {
  submission: AcademyProjectSubmissionRow;
  project: AcademyProjectRow;
  courseTitle: string;
}

interface ProjectReviewPanelProps {
  items: PendingProjectItem[];
  reviewerUserId: string;
  onReviewed: () => void;
}

export function ProjectReviewPanel({ items, reviewerUserId, onReviewed }: ProjectReviewPanelProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12 border-2 border-dashed border-border rounded-3xl space-y-3">
        <Rocket className="w-10 h-10 mx-auto text-muted-foreground" aria-hidden="true" />
        <p className="text-muted-foreground text-sm">لا توجد مشاريع بانتظار المراجعة.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-4">
      {items.map(({ submission, project, courseTitle }) => (
        <li key={submission.id} className="p-4 rounded-2xl bg-card border border-border space-y-3">
          <div>
            <p className="font-bold text-foreground text-sm">{project.title}</p>
            <p className="text-xs text-muted-foreground">{courseTitle} · المحاولة {submission.attempt_number}</p>
          </div>
          {submission.repo_or_file_url && (
            <a href={submission.repo_or_file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline break-all">
              {submission.repo_or_file_url}
            </a>
          )}
          <RubricScoringForm
            rubric={project.rubric}
            submitLabel="حفظ المراجعة"
            onSubmit={(scores, review) => {
              reviewProjectSubmissionLocal(submission.id, scores, review, reviewerUserId);
              onReviewed();
            }}
          />
        </li>
      ))}
    </ul>
  );
}
