import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Mic, PhoneOff, RotateCcw, Volume2 } from "lucide-react";
import { useVoiceChat, type AssistantType, type VoiceStatus } from "@/hooks/useVoiceChat";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

type Props = {
  assistant?: AssistantType;
  assistantId?: string;
  assistantName?: string;
  className?: string;
};

const STATUS_COLOR: Record<VoiceStatus, string> = {
  idle: "bg-gray-400",
  connecting: "bg-yellow-400 animate-pulse",
  listening: "bg-green-500 animate-pulse",
  speaking: "bg-blue-500 animate-pulse",
  error: "bg-red-500",
};

export function VoiceChat({
  assistant = "visionex",
  assistantId,
  assistantName = "Visionex AI",
  className,
}: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { status, transcripts, error, connect, disconnect, clearTranscripts } =
    useVoiceChat(assistant, assistantId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isConnected = status !== "idle" && status !== "error";

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts]);

  const handleToggle = () => {
    if (!user) return;
    if (isConnected) disconnect();
    else connect();
  };

  const statusLabel = t(`voice.status.${status}`);
  const color = STATUS_COLOR[status];
  const displayError = !user ? t("tv.toast.loginRequired") : error;

  return (
    <div className={cn("flex flex-col rounded-2xl border bg-background shadow-lg", className)}>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <div className={cn("h-2.5 w-2.5 rounded-full", color)} />
          <span className="font-semibold text-sm">{assistantName}</span>
          <Badge variant="secondary" className="text-xs">{statusLabel}</Badge>
        </div>
        {transcripts.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={clearTranscripts}
            aria-label="Clear voice transcript"
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1 min-h-[200px] max-h-[320px]">
        <div ref={scrollRef} className="space-y-3 p-4">
          {transcripts.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {isConnected ? t("voice.activePrompt") : t("voice.startPrompt")}
            </div>
          )}
          {transcripts.map((item, index) => (
            <div key={`${item.role}-${index}`} className={cn("flex", item.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                  item.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-muted rounded-bl-sm",
                )}
              >
                {item.role === "assistant" && (
                  <div className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Volume2 className="h-3 w-3" /> {assistantName}
                  </div>
                )}
                {item.text}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {displayError && (
        <div className="mx-4 mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950 dark:text-red-400">
          {displayError}
        </div>
      )}

      <div className="flex items-center justify-center gap-4 border-t p-4">
        <div
          className={cn(
            "flex h-16 w-16 items-center justify-center rounded-full transition-all duration-300",
            status === "listening" && "bg-green-100 ring-4 ring-green-300 dark:bg-green-950",
            status === "speaking" && "bg-blue-100 ring-4 ring-blue-300 dark:bg-blue-950",
            status === "connecting" && "bg-yellow-100 dark:bg-yellow-950",
            (status === "idle" || status === "error") && "bg-muted",
          )}
        >
          {status === "connecting" ? (
            <Loader2 className="h-7 w-7 animate-spin text-yellow-500" />
          ) : status === "speaking" ? (
            <Volume2 className="h-7 w-7 text-blue-500" />
          ) : (
            <Button
              onClick={handleToggle}
              size="icon"
              disabled={!user}
              className={cn(
                "h-14 w-14 rounded-full text-white transition-all",
                isConnected ? "bg-red-500 hover:bg-red-600" : "bg-primary hover:bg-primary/90",
              )}
              aria-label={isConnected ? "End voice chat" : "Start voice chat"}
            >
              {isConnected ? <PhoneOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            </Button>
          )}
        </div>
      </div>

      <p className="pb-3 text-center text-xs text-muted-foreground">
        {isConnected ? t("voice.endPrompt") : t("voice.beginPrompt")}
      </p>
    </div>
  );
}
