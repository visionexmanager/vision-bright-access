import type { DragEvent } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { CompanyAvatar } from "@/components/career/jobs/CompanyAvatar";
import type { Candidate } from "../../types";

interface CandidateCardProps {
  candidate: Candidate;
  onOpen: (id: string) => void;
  draggable?: boolean;
  onDragStart?: (e: DragEvent<HTMLButtonElement>, id: string) => void;
  onDragEnd?: (e: DragEvent<HTMLButtonElement>) => void;
}

export function CandidateCard({ candidate, onOpen, draggable, onDragStart, onDragEnd }: CandidateCardProps) {
  const { t } = useLanguage();

  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={draggable ? (e) => onDragStart?.(e, candidate.id) : undefined}
      onDragEnd={draggable ? onDragEnd : undefined}
      onClick={() => onOpen(candidate.id)}
      className="emp-kanban-card flex w-full items-start gap-3 rounded-xl border border-border/60 bg-card p-3 text-start transition-all hover:border-primary/30 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <CompanyAvatar name={candidate.name} color={candidate.avatarColor} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{candidate.name}</p>
        <p className="truncate text-xs text-muted-foreground">{candidate.headline}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{candidate.appliedJobTitle}</p>
      </div>
      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary" aria-label={`${t("employerDash.candidates.matchScore")}: ${candidate.matchScore}`}>
        {candidate.matchScore}
      </span>
    </button>
  );
}
