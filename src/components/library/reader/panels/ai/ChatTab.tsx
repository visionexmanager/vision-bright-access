import { FormEvent, useEffect, useRef, useState } from "react";
import { Loader2, RotateCcw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLibraryAiChat } from "@/hooks/library/useLibraryAiChat";
import { cn } from "@/lib/utils";

interface ChatTabProps {
  bookId: string;
  chapterId: string | null;
}

/** "Chat with the book" — grounded answers only from retrieved excerpts
 *  (server-enforced), with citation chips showing which chapter(s) an
 *  answer drew from. */
export function ChatTab({ bookId, chapterId }: ChatTabProps) {
  const { t } = useLanguage();
  const { messages, sendMessage, isStreaming, error, citations, startNewConversation } = useLibraryAiChat(bookId, chapterId ?? undefined);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    void sendMessage(input);
    setInput("");
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{t("library.ai.chat.grounded")}</p>
        <Button variant="ghost" size="sm" onClick={startNewConversation} className="h-7 gap-1 text-xs">
          <RotateCcw className="h-3 w-3" aria-hidden="true" /> {t("library.ai.chat.newConversation")}
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto" role="log" aria-live="polite" aria-label={t("library.ai.chat.title")}>
        {messages.length === 0 && (
          <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">{t("library.ai.chat.emptyState")}</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn("max-w-[90%] rounded-lg p-3 text-sm", m.role === "user" ? "ms-auto bg-primary text-primary-foreground" : "bg-muted")}>
            <p className="whitespace-pre-line">{m.content || (isStreaming && i === messages.length - 1 ? "…" : "")}</p>
          </div>
        ))}
        {citations.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {citations.map((c) => (
              <Badge key={c.chapterId} variant="outline" className="text-xs">
                {t("library.ai.chat.foundIn").replace("{chapter}", c.chapterTitle ?? t("library.bookDetails.chapters"))}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}

      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
          rows={2}
          placeholder={t("library.ai.chat.placeholder")}
          className="flex-1 resize-none"
        />
        <Button type="submit" size="icon" disabled={isStreaming || !input.trim()} aria-label={t("library.ai.chat.send")}>
          {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
        </Button>
      </form>
    </div>
  );
}
