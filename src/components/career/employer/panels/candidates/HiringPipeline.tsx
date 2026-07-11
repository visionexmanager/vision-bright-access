import { useState } from "react";
import type { DragEvent } from "react";
import { MoreVertical } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CandidateCard } from "./CandidateCard";
import type { Candidate, PipelineStage } from "../../types";

const STAGES: PipelineStage[] = ["applied", "screening", "interview", "shortlisted", "offered", "hired", "rejected"];

interface HiringPipelineProps {
  candidates: Candidate[];
  onOpen: (id: string) => void;
  onStageChange: (candidateId: string, stage: PipelineStage) => void;
}

export function HiringPipeline({ candidates, onOpen, onStageChange }: HiringPipelineProps) {
  const { t } = useLanguage();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<PipelineStage | null>(null);

  const handleDrop = (stage: PipelineStage) => {
    if (draggingId) onStageChange(draggingId, stage);
    setDraggingId(null);
    setDropTarget(null);
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-2" role="group" aria-label={t("employerDash.candidates.pipelineLabel")}>
      {STAGES.map((stage) => {
        const stageCandidates = candidates.filter((c) => c.stage === stage);
        return (
          <div
            key={stage}
            className={`emp-kanban-column flex w-64 shrink-0 flex-col gap-2 rounded-2xl p-3 ${dropTarget === stage ? "is-drop-target" : ""}`}
            onDragOver={(e: DragEvent) => { e.preventDefault(); setDropTarget(stage); }}
            onDragLeave={() => setDropTarget((prev) => (prev === stage ? null : prev))}
            onDrop={(e: DragEvent) => { e.preventDefault(); handleDrop(stage); }}
          >
            <div className="flex items-center justify-between px-1">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t(`employerDash.candidates.stage.${stage}`)}</p>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">{stageCandidates.length}</span>
            </div>
            <ul role="list" className="flex flex-col gap-2">
              {stageCandidates.map((c) => (
                <li key={c.id} className={`relative ${draggingId === c.id ? "is-dragging" : ""}`}>
                  <CandidateCard
                    candidate={c}
                    onOpen={onOpen}
                    draggable
                    onDragStart={(_e, id) => setDraggingId(id)}
                    onDragEnd={() => setDraggingId(null)}
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={t("employerDash.candidates.moveStage").replace("{name}", c.name)}
                        className="absolute end-2 top-2 rounded-md bg-card p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <MoreVertical className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {STAGES.filter((s) => s !== stage).map((s) => (
                        <DropdownMenuItem key={s} onClick={() => onStageChange(c.id, s)}>
                          {t("employerDash.candidates.moveTo")} {t(`employerDash.candidates.stage.${s}`)}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
