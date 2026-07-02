import { ClipboardList } from "lucide-react";
import { RubricScoringForm } from "./RubricScoringForm";
import { gradeAssignmentSubmissionLocal } from "@/lib/academy/assessmentLocalStore";
import type { AcademyAssignmentRow, AcademyAssignmentSubmissionRow } from "@/lib/types/academy-lms";

interface PendingAssignmentItem {
  submission: AcademyAssignmentSubmissionRow;
  assignment: AcademyAssignmentRow;
  courseTitle: string;
}

interface AssignmentGradingPanelProps {
  items: PendingAssignmentItem[];
  graderUserId: string;
  onGraded: () => void;
}

export function AssignmentGradingPanel({ items, graderUserId, onGraded }: AssignmentGradingPanelProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12 border-2 border-dashed border-border rounded-3xl space-y-3">
        <ClipboardList className="w-10 h-10 mx-auto text-muted-foreground" aria-hidden="true" />
        <p className="text-muted-foreground text-sm">لا توجد واجبات بانتظار التقييم.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-4">
      {items.map(({ submission, assignment, courseTitle }) => (
        <li key={submission.id} className="p-4 rounded-2xl bg-card border border-border space-y-3">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <p className="font-bold text-foreground text-sm">{assignment.title}</p>
              <p className="text-xs text-muted-foreground">{courseTitle} · المحاولة {submission.attempt_number}</p>
            </div>
          </div>
          {submission.notes && <p className="text-sm text-foreground bg-muted/50 p-3 rounded-xl">{submission.notes}</p>}
          {submission.file_name && <p className="text-xs text-muted-foreground">الملف: {submission.file_name}</p>}
          <RubricScoringForm
            rubric={assignment.rubric}
            submitLabel="حفظ التقييم"
            onSubmit={(scores, feedback) => {
              gradeAssignmentSubmissionLocal(submission.id, scores, feedback, graderUserId);
              onGraded();
            }}
          />
        </li>
      ))}
    </ul>
  );
}
