import { FormEvent, useEffect, useRef, useState } from "react";
import { Plus, Send, Loader2, MessageSquare } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/library/EmptyState";
import { VoiceSearchButton } from "@/components/library/marketplace/VoiceSearchButton";
import { useLibrarianChat, useLibrarianChatSessions } from "@/hooks/library/useLibrarianChat";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { cn } from "@/lib/utils";

export default function LibraryLibrarianChat() {
  const { t } = useLanguage();
  const { sessions, isLoading: isLoadingSessions } = useLibrarianChatSessions();
  const [activeSessionId, setActiveSessionId] = useState<string>(() => crypto.randomUUID());
  const { messages, sendMessage, isStreaming, error } = useLibrarianChat(activeSessionId);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useDocumentHead({ title: t("library.librarian.chat.title") });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    void sendMessage(input);
    setInput("");
  };

  const startNewChat = () => setActiveSessionId(crypto.randomUUID());

  return (
    <Layout>
      <LibraryLayout title={t("library.librarian.chat.title")} breadcrumb={[{ label: t("library.librarian.title"), to: "/library/librarian" }, { label: t("library.librarian.chat.title") }]}>
        <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
          <div className="space-y-2">
            <Button size="sm" className="w-full gap-1.5" onClick={startNewChat}>
              <Plus className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.librarian.chat.newChat")}
            </Button>
            <div className="space-y-1">
              {isLoadingSessions ? (
                <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" /></div>
              ) : sessions.length === 0 ? (
                <p className="px-1 text-xs text-muted-foreground">{t("library.librarian.chat.noSessions")}</p>
              ) : (
                sessions.map((s) => (
                  <button
                    key={s.session_id}
                    type="button"
                    onClick={() => setActiveSessionId(s.session_id)}
                    className={cn(
                      "w-full truncate rounded-md px-2 py-1.5 text-start text-sm hover:bg-muted",
                      s.session_id === activeSessionId && "bg-muted font-medium"
                    )}
                  >
                    {s.title}
                  </button>
                ))
              )}
            </div>
          </div>

          <Card className="flex h-[70vh] flex-col gap-3 p-4">
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto" role="log" aria-live="polite" aria-label={t("library.librarian.chat.title")}>
              {messages.length === 0 && (
                <EmptyState icon={<MessageSquare className="h-8 w-8" />} title={t("library.librarian.chat.emptyState")} className="py-8" />
              )}
              {messages.map((m, i) => (
                <div key={i} className={cn("max-w-[85%] rounded-lg p-3 text-sm", m.role === "user" ? "ms-auto bg-primary text-primary-foreground" : "bg-muted")}>
                  <p className="whitespace-pre-line">{m.content || (isStreaming && i === messages.length - 1 ? "…" : "")}</p>
                </div>
              ))}
            </div>

            {error && <p role="alert" className="text-xs text-destructive">{error}</p>}

            <form onSubmit={handleSubmit} className="flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
                rows={2}
                placeholder={t("library.librarian.chat.placeholder")}
                className="flex-1 resize-none"
              />
              <VoiceSearchButton onResult={(transcript) => setInput((prev) => (prev ? `${prev} ${transcript}` : transcript))} />
              <Button type="submit" size="icon" disabled={isStreaming || !input.trim()} aria-label={t("library.librarian.chat.send")}>
                {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
              </Button>
            </form>
          </Card>
        </div>
      </LibraryLayout>
    </Layout>
  );
}
