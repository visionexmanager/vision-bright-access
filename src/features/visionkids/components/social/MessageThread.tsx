import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Send, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

export interface ThreadMessage {
  id: string;
  senderId: string;
  content: string;
  isFlagged: boolean;
  wasFiltered: boolean;
  createdAt: string;
}

interface MessageThreadProps {
  messages: ThreadMessage[];
  onSend: (text: string) => void;
  sending?: boolean;
  onReport?: (messageId: string) => void;
  disabledReason?: string;
}

/** Shared by 1:1 Safe Chat and club group chat — both send through the
 *  same client-filter-first moderation path (see chatModeration.ts), so
 *  the UI treats them identically. */
export function MessageThread({ messages, onSend, sending, onReport, disabledReason }: MessageThreadProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text || disabledReason) return;
    onSend(text);
    setDraft("");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {messages.map((m) => {
          const isMine = m.senderId === user?.id;
          return (
            <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div className={`group relative max-w-[75%] rounded-2xl px-3 py-2 text-sm ${isMine ? "bg-kids-primary text-white" : "bg-muted"}`}>
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
                {m.wasFiltered && (
                  <p className={`mt-1 flex items-center gap-1 text-[10px] ${isMine ? "text-white/80" : "text-muted-foreground"}`}>
                    <AlertTriangle className="h-3 w-3" aria-hidden="true" /> {t("kids.social.chat.wasFiltered")}
                  </p>
                )}
                {!isMine && onReport && (
                  <button
                    type="button"
                    onClick={() => onReport(m.id)}
                    className="absolute -top-2 -end-2 hidden h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:text-destructive group-hover:flex"
                    aria-label={t("kids.social.report.reportMessage")}
                  >
                    <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border p-3">
        {disabledReason ? (
          <p className="text-center text-sm text-muted-foreground">{disabledReason}</p>
        ) : (
          <div className="flex items-center gap-2">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
              placeholder={t("kids.social.chat.typeMessage")}
              maxLength={500}
              aria-label={t("kids.social.chat.typeMessage")}
            />
            <Button size="icon" onClick={handleSend} disabled={sending || !draft.trim()} aria-label={t("kids.social.chat.send")}>
              <Send className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
