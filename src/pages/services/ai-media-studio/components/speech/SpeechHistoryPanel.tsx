import { Clock, Trash2, Volume2, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSpeechHistory } from "@/hooks/useSpeechHistory";
import { cn } from "@/lib/utils";
import type { SpeechJob } from "@/lib/types/speech-studio";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month:  "short",
    day:    "numeric",
    hour:   "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function StatusIcon({ status }: { status: SpeechJob["status"] }) {
  switch (status) {
    case "completed":  return <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />;
    case "failed":     return <XCircle       className="h-3.5 w-3.5 text-destructive" />;
    case "processing":
    case "queued":     return <Loader2       className="h-3.5 w-3.5 text-primary animate-spin" />;
    case "cancelled":  return <XCircle       className="h-3.5 w-3.5 text-muted-foreground" />;
    default:           return null;
  }
}

interface Props {
  className?: string;
}

export function SpeechHistoryPanel({ className }: Props) {
  const { history, isLoading, deleteJob } = useSpeechHistory(15);

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Generation History</h3>
        <Badge variant="secondary" className="ml-auto text-[10px]">{history.length}</Badge>
      </div>

      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-3 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center gap-2 px-4">
            <Volume2 className="h-7 w-7 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">
              Your generated audio files will appear here.
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {history.map((job) => (
              <div
                key={job.id}
                className="group flex items-start gap-2 rounded-lg p-2.5 hover:bg-muted/50 transition-colors"
              >
                <div className="mt-0.5 shrink-0">
                  <StatusIcon status={job.status} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium line-clamp-2 leading-snug">
                    {job.input_text.slice(0, 100)}{job.input_text.length > 100 ? "…" : ""}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span className="text-[10px] text-muted-foreground">{job.voice_name ?? job.voice_id}</span>
                    <span className="text-border">·</span>
                    <span className="text-[10px] text-muted-foreground">{formatDate(job.created_at)}</span>
                    {job.duration_sec && (
                      <>
                        <span className="text-border">·</span>
                        <span className="text-[10px] text-muted-foreground">
                          {job.duration_sec.toFixed(1)}s
                        </span>
                      </>
                    )}
                  </div>
                  {job.error_message && (
                    <p className="text-[10px] text-destructive mt-0.5 line-clamp-1">{job.error_message}</p>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => deleteJob(job.id)}
                  aria-label="Delete job"
                >
                  <Trash2 className="h-3 w-3 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
