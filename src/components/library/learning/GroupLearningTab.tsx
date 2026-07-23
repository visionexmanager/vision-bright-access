import { useRef, useState } from "react";
import { Star, Trash2, Paperclip, NotebookPen, ClipboardList } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useGroupSharedNotes, useGroupAssignments, useAssignmentSubmissions, usePeerReviews, useTeacherFeedback } from "@/hooks/library/useGroupLearning";
import { cn } from "@/lib/utils";

function SharedNotesSection({ clubId }: { clubId: string }) {
  const { t } = useLanguage();
  const { notes, addNote, removeNote } = useGroupSharedNotes(clubId);
  const { user } = useAuth();
  const [content, setContent] = useState("");

  return (
    <Card className="space-y-3 p-4">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold"><NotebookPen className="h-4 w-4" aria-hidden="true" /> {t("library.group.sharedNotes")}</h3>
      <div className="flex gap-2">
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={2} placeholder={t("library.group.newSharedNote")} />
        <Button size="sm" disabled={!content.trim()} onClick={async () => { await addNote(content); setContent(""); }}>{t("library.group.post")}</Button>
      </div>
      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("library.group.sharedNotesEmpty")}</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((note) => (
            <li key={note.id} className="rounded-md border p-2 text-sm">
              <p className="whitespace-pre-line">{note.content}</p>
              <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>{new Date(note.created_at).toLocaleDateString()}</span>
                {note.user_id === user?.id && (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => void removeNote(note.id)} aria-label={t("library.reviews.delete")}>
                    <Trash2 className="h-3 w-3" aria-hidden="true" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function SubmissionCard({ submissionId, authorId, content, fileUrl, isModerator }: { submissionId: string; authorId: string; content: string | null; fileUrl: string | null; isModerator: boolean }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { reviews, review } = usePeerReviews(submissionId);
  const { feedback, giveFeedback } = useTeacherFeedback(submissionId);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  const [grade, setGrade] = useState("");
  const isOwnSubmission = authorId === user?.id;

  return (
    <div className="space-y-2 rounded-md border p-3">
      {content && <p className="whitespace-pre-line text-sm">{content}</p>}
      {fileUrl && <a href={fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-primary underline"><Paperclip className="h-3 w-3" aria-hidden="true" /> {t("library.group.attachFile")}</a>}

      {feedback.length > 0 && (
        <div className="rounded-md bg-muted/50 p-2 text-xs">
          <p className="font-semibold">{t("library.group.teacherFeedback")}</p>
          {feedback.map((f) => <p key={f.id}>{f.grade ? `[${f.grade}] ` : ""}{f.feedback}</p>)}
        </div>
      )}

      {reviews.length > 0 && (
        <div className="text-xs text-muted-foreground">
          {reviews.map((r) => (
            <p key={r.id} className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => <Star key={i} className={cn("h-3 w-3", i < r.rating && "fill-primary text-primary")} aria-hidden="true" />)}
              {r.feedback}
            </p>
          ))}
        </div>
      )}

      {!isOwnSubmission && (
        <div className="flex flex-wrap items-center gap-2 border-t pt-2">
          <div className="flex gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <button key={i} type="button" onClick={() => setRating(i + 1)} aria-label={`${i + 1} stars`}>
                <Star className={cn("h-4 w-4", i < rating && "fill-primary text-primary")} aria-hidden="true" />
              </button>
            ))}
          </div>
          <Input value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder={t("library.group.feedbackPlaceholder")} className="h-7 flex-1 text-xs" />
          <Button size="sm" variant="outline" disabled={rating === 0} onClick={async () => { await review(rating, reviewText.trim() || null); setReviewText(""); setRating(0); }}>
            {t("library.group.peerReview")}
          </Button>
        </div>
      )}

      {isModerator && (
        <div className="flex flex-wrap items-center gap-2 border-t pt-2">
          <Input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder={t("library.group.gradeLabel")} className="h-7 w-24 text-xs" />
          <Input value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} placeholder={t("library.group.feedbackPlaceholder")} className="h-7 flex-1 text-xs" />
          <Button size="sm" variant="outline" disabled={!feedbackText.trim()} onClick={async () => { await giveFeedback(feedbackText.trim(), grade.trim() || null); setFeedbackText(""); setGrade(""); }}>
            {t("library.group.giveFeedback")}
          </Button>
        </div>
      )}
    </div>
  );
}

function AssignmentCard({ assignmentId, title, description, dueAt, isModerator }: { assignmentId: string; title: string; description: string | null; dueAt: string | null; isModerator: boolean }) {
  const { t } = useLanguage();
  const { submissions, submit, mySubmission } = useAssignmentSubmissions(assignmentId);
  const [content, setContent] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div>
        <p className="font-medium">{title}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
        {dueAt && <Badge variant="outline" className="mt-1">{new Date(dueAt).toLocaleDateString()}</Badge>}
      </div>

      {!mySubmission ? (
        <div className="space-y-2">
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={2} placeholder={t("library.group.yourSubmission")} />
          <div className="flex gap-2">
            <input ref={fileInputRef} type="file" className="hidden" />
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileInputRef.current?.click()}><Paperclip className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.group.attachFile")}</Button>
            <Button
              size="sm"
              disabled={!content.trim()}
              onClick={async () => { await submit(content, fileInputRef.current?.files?.[0] ?? null); setContent(""); }}
            >
              {t("library.group.submit")}
            </Button>
          </div>
        </div>
      ) : (
        <Badge>{t("library.group.submitted")}</Badge>
      )}

      {submissions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">{t("library.group.submissions")}</p>
          {submissions.map((s) => (
            <SubmissionCard key={s.id} submissionId={s.id} authorId={s.user_id} content={s.content} fileUrl={s.file_url} isModerator={isModerator} />
          ))}
        </div>
      )}
    </div>
  );
}

export function GroupLearningTab({ clubId, isModerator }: { clubId: string; isModerator: boolean }) {
  const { t } = useLanguage();
  const { assignments, createAssignment } = useGroupAssignments(clubId);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");

  return (
    <div className="space-y-4">
      <SharedNotesSection clubId={clubId} />

      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold"><ClipboardList className="h-4 w-4" aria-hidden="true" /> {t("library.group.assignments")}</h3>
          {isModerator && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm" variant="outline">{t("library.group.newAssignment")}</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{t("library.group.newAssignment")}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label htmlFor="assignment-title">{t("library.group.assignmentTitle")}</Label><Input id="assignment-title" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
                  <div><Label htmlFor="assignment-desc">{t("library.group.assignmentDescription")}</Label><Textarea id="assignment-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
                  <div><Label htmlFor="assignment-due">{t("library.group.dueDate")}</Label><Input id="assignment-due" type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} /></div>
                </div>
                <DialogFooter>
                  <Button
                    disabled={!title.trim()}
                    onClick={async () => {
                      await createAssignment(title.trim(), description.trim() || null, dueAt || null);
                      setOpen(false); setTitle(""); setDescription(""); setDueAt("");
                    }}
                  >
                    {t("library.group.newAssignment")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
        {assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("library.group.assignmentsEmpty")}</p>
        ) : (
          <div className="space-y-3">
            {assignments.map((a) => (
              <AssignmentCard key={a.id} assignmentId={a.id} title={a.title} description={a.description} dueAt={a.due_at} isModerator={isModerator} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
