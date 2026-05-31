import { Button } from "@/components/ui/button";
import { Users2 } from "lucide-react";

export interface QueueEntry {
  id: string;
  name: string;
  raisedAt: number;
}

interface SpeakerQueuePanelProps {
  queue: QueueEntry[];
  t: (key: string) => string;
  onInvite: (userId: string) => void;
  onClose: () => void;
}

export function SpeakerQueuePanel({ queue, t, onInvite, onClose }: SpeakerQueuePanelProps) {
  const formatElapsed = (ts: number) => {
    const secs = Math.floor((Date.now() - ts) / 1000);
    if (secs < 60) return `${secs}s`;
    return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  };

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold flex items-center gap-1.5">
          <Users2 className="h-4 w-4 text-primary" />
          {t("vroom.speakerQueue")} ({queue.length})
        </span>
        <button
          className="text-xs text-muted-foreground hover:text-foreground"
          onClick={onClose}
        >
          ✕
        </button>
      </div>
      {queue.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2 text-center">{t("vroom.queueEmpty")}</p>
      ) : (
        <div className="space-y-2">
          {queue.map((entry, idx) => (
            <div
              key={entry.id}
              className="flex items-center justify-between rounded-lg border px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-5 text-center">{idx + 1}.</span>
                <span className="text-sm font-medium">✋ {entry.name}</span>
                <span className="text-xs text-muted-foreground">({formatElapsed(entry.raisedAt)})</span>
              </div>
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={() => onInvite(entry.id)}
              >
                {t("vroom.inviteToStage")}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
