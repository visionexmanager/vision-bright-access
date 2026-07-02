import { useState } from "react";
import { MapPin, GraduationCap, Link2, ShieldAlert, MessageSquarePlus } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { CompanyAvatar } from "@/components/career/jobs/CompanyAvatar";
import type { Candidate, CandidateNote, PipelineStage } from "../../types";

interface CandidateProfileProps {
  candidate: Candidate | null;
  onOpenChange: (open: boolean) => void;
  onStageChange: (candidateId: string, stage: PipelineStage) => void;
  onAddNote: (candidateId: string, note: CandidateNote) => void;
}

const SCORE_METRICS: { key: keyof Candidate; labelKey: string }[] = [
  { key: "matchScore", labelKey: "employerDash.candidates.matchScore" },
  { key: "skillMatch", labelKey: "employerDash.candidates.skillMatch" },
  { key: "experienceMatch", labelKey: "employerDash.candidates.experienceMatch" },
  { key: "cultureFit", labelKey: "employerDash.candidates.cultureFit" },
  { key: "salaryFit", labelKey: "employerDash.candidates.salaryFit" },
];

export function CandidateProfile({ candidate, onOpenChange, onStageChange, onAddNote }: CandidateProfileProps) {
  const { t } = useLanguage();
  const [noteText, setNoteText] = useState("");

  if (!candidate) return null;

  const submitNote = () => {
    if (!noteText.trim()) return;
    onAddNote(candidate.id, { id: `note-${Date.now()}`, author: t("employerDash.candidates.you"), text: noteText.trim(), date: new Date().toISOString().slice(0, 10) });
    setNoteText("");
  };

  return (
    <Dialog open={Boolean(candidate)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <CompanyAvatar name={candidate.name} color={candidate.avatarColor} />
            <span>
              <span className="block">{candidate.name}</span>
              <span className="block text-sm font-normal text-muted-foreground">{candidate.headline}</span>
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{candidate.location}</span>
            <span className="flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />{candidate.education}</span>
            {candidate.portfolioUrl && <span className="flex items-center gap-1"><Link2 className="h-3.5 w-3.5" aria-hidden="true" />{candidate.portfolioUrl}</span>}
          </div>

          <p className="text-sm text-muted-foreground">{candidate.resumeSummary}</p>

          <div>
            <p className="mb-2 text-sm font-bold">{t("employerDash.candidates.aiScores")}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {SCORE_METRICS.map(({ key, labelKey }) => (
                <div key={key}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{t(labelKey)}</span>
                    <span className="font-semibold">{candidate[key] as number}</span>
                  </div>
                  <Progress value={candidate[key] as number} aria-label={t(labelKey)} />
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {t("employerDash.candidates.riskScore")}: {candidate.riskScore}/100
            </div>
          </div>

          {candidate.missingSkills.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold text-muted-foreground">{t("employerDash.candidates.missingSkills")}</p>
              <div className="flex flex-wrap gap-1.5">
                {candidate.missingSkills.map((s) => <span key={s} className="rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-600 dark:text-red-400">{s}</span>)}
              </div>
            </div>
          )}

          <div>
            <p className="mb-1.5 text-xs font-semibold text-muted-foreground">{t("employerDash.candidates.skills")}</p>
            <div className="flex flex-wrap gap-1.5">
              {candidate.skills.map((s) => <span key={s} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">{s}</span>)}
            </div>
          </div>

          {candidate.interviewHistory.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold text-muted-foreground">{t("employerDash.candidates.interviewHistory")}</p>
              <ul className="flex flex-col gap-1 text-sm">
                {candidate.interviewHistory.map((ih) => (
                  <li key={ih.id} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-1.5">
                    <span>{t(`employerDash.interviews.mode.${ih.mode}`)} · {ih.date}</span>
                    <span className="font-semibold text-primary">{ih.score}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="mb-1.5 text-xs font-semibold text-muted-foreground">{t("employerDash.candidates.notes")}</p>
            <ul className="mb-2 flex flex-col gap-1.5">
              {candidate.notes.map((n) => (
                <li key={n.id} className="rounded-lg bg-muted/40 p-2.5 text-xs">
                  <span className="font-semibold">{n.author}</span> · {n.date}
                  <p className="mt-0.5 text-muted-foreground">{n.text}</p>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder={t("employerDash.candidates.addNotePlaceholder")} rows={2} className="resize-none" />
              <Button size="icon" onClick={submitNote} aria-label={t("employerDash.candidates.addNote")} className="shrink-0">
                <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
            <Button onClick={() => onStageChange(candidate.id, "shortlisted")}>{t("employerDash.candidates.shortlist")}</Button>
            <Button variant="outline" onClick={() => onStageChange(candidate.id, "interview")}>{t("employerDash.candidates.inviteInterview")}</Button>
            <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => onStageChange(candidate.id, "rejected")}>{t("employerDash.candidates.reject")}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
