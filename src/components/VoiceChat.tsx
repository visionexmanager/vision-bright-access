import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mic, MicOff, PhoneOff, Volume2, Loader2, RotateCcw } from "lucide-react";
import { useVoiceChat, AssistantType, VoiceStatus } from "@/hooks/useVoiceChat";
import { cn } from "@/lib/utils";

type Props = {
  assistant?: AssistantType;
  assistantName?: string;
  className?: string;
};

const STATUS_CONFIG: Record<VoiceStatus, { label: string; color: string }> = {
  idle:       { label: "غير متصل",  color: "bg-gray-400" },
  connecting: { label: "جاري الاتصال...", color: "bg-yellow-400 animate-pulse" },
  listening:  { label: "يستمع...",  color: "bg-green-500 animate-pulse" },
  speaking:   { label: "يتحدث...",  color: "bg-blue-500 animate-pulse" },
  error:      { label: "خطأ",       color: "bg-red-500" },
};

export function VoiceChat({ assistant = "visionex", assistantName = "Visionex AI", className }: Props) {
  const { status, transcripts, error, connect, disconnect, clearTranscripts } = useVoiceChat(assistant);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isConnected = status !== "idle" && status !== "error";

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts]);

  const handleToggle = () => {
    if (isConnected) disconnect();
    else connect();
  };

  const { label, color } = STATUS_CONFIG[status];

  return (
    <div className={cn("flex flex-col rounded-2xl border bg-background shadow-lg", className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <div className={cn("h-2.5 w-2.5 rounded-full", color)} />
          <span className="font-semibold text-sm">{assistantName}</span>
          <Badge variant="secondary" className="text-xs">{label}</Badge>
        </div>
        {transcripts.length > 0 && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearTranscripts}>
            <RotateCcw className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Transcript area */}
      <ScrollArea className="flex-1 min-h-[200px] max-h-[320px]">
        <div ref={scrollRef} className="space-y-3 p-4">
          {transcripts.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">
              {isConnected
                ? "ابدأ الحديث... الميكروفون مفتوح"
                : "اضغط على الميكروفون لبدء المحادثة الصوتية"}
            </div>
          )}
          {transcripts.map((t, i) => (
            <div key={i} className={cn("flex", t.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                t.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-muted rounded-bl-sm"
              )}>
                {t.role === "assistant" && (
                  <div className="flex items-center gap-1 mb-1 text-xs text-muted-foreground">
                    <Volume2 className="h-3 w-3" /> {assistantName}
                  </div>
                )}
                {t.text}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Error */}
      {error && (
        <div className="mx-4 mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 border-t p-4">
        {/* Visual indicator */}
        <div className={cn(
          "flex h-16 w-16 items-center justify-center rounded-full transition-all duration-300",
          status === "listening" && "bg-green-100 ring-4 ring-green-300 dark:bg-green-950",
          status === "speaking" && "bg-blue-100 ring-4 ring-blue-300 dark:bg-blue-950",
          status === "connecting" && "bg-yellow-100 dark:bg-yellow-950",
          status === "idle" || status === "error" ? "bg-muted" : ""
        )}>
          {status === "connecting" ? (
            <Loader2 className="h-7 w-7 animate-spin text-yellow-500" />
          ) : status === "speaking" ? (
            <Volume2 className="h-7 w-7 text-blue-500" />
          ) : (
            <Button
              onClick={handleToggle}
              size="icon"
              className={cn(
                "h-14 w-14 rounded-full text-white transition-all",
                isConnected
                  ? "bg-red-500 hover:bg-red-600"
                  : "bg-primary hover:bg-primary/90"
              )}
            >
              {isConnected ? <PhoneOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            </Button>
          )}
        </div>
      </div>

      <p className="pb-3 text-center text-xs text-muted-foreground">
        {isConnected ? "اضغط لإنهاء المحادثة" : "اضغط لبدء المحادثة الصوتية"}
      </p>
    </div>
  );
}
