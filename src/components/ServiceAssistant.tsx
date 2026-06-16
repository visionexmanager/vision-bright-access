/**
 * ServiceAssistant — inline AI advisor card for service pages.
 *
 * Renders a collapsible chat panel wired to a registry-driven domain assistant
 * (legal, medical, sports, …) via useAIChat({ assistantId }). Inline (not
 * floating) so it never collides with the global AIChat button.
 */
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Bot, Send, Square, Sparkles, Trash2, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAIChat } from "@/hooks/useAIChat";
import { VoiceChat } from "@/components/VoiceChat";

interface Props {
  assistantId: string;
  assistantName: string;
  /** Service title, used in the intro line. */
  title: string;
}

export function ServiceAssistant({ assistantId, assistantName, title }: Props) {
  const { t, dir, translateText } = useLanguage();
  const isRTL = dir === "rtl";

  const [open, setOpen] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [input, setInput] = useState("");
  const { messages, isLoading, sendMessage, clearMessages, stopGeneration } = useAIChat({ assistantId });
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    setInput("");
    sendMessage(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const tx = {
    cta: t("ai.service.ask").replace("{assistant}", translateText(assistantName)),
    intro: t("ai.service.intro").replace("{title}", translateText(title)),
    placeholder: t("ai.service.placeholder"),
    send: t("ai.task.send"),
    stop: t("ai.task.stop"),
    clear: t("ai.clearChat"),
    voice: t("ai.service.voice"),
    disclaimer: t("ai.service.disclaimer"),
  };

  if (!open) {
    return (
      <Card className="shadow-sm border-primary/30">
        <CardContent className="flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold">{translateText(assistantName)}</p>
              <p className="text-sm text-muted-foreground">{tx.intro}</p>
            </div>
          </div>
          <Button onClick={() => setOpen(true)} className="shrink-0">
            <Bot className="me-2 h-4 w-4" />
            {tx.cta}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm border-primary/30" dir={isRTL ? "rtl" : "ltr"}>
      <CardContent className="p-0">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold">{translateText(assistantName)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant={voiceMode ? "default" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setVoiceMode((v) => !v)}
              aria-label={tx.voice}
              title={tx.voice}
            >
              <Phone className="h-4 w-4" />
            </Button>
            {messages.length > 0 && !voiceMode && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={clearMessages}
                aria-label={tx.clear}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {voiceMode && (
          <VoiceChat
            assistantId={assistantId}
            assistantName={translateText(assistantName)}
            className="rounded-none border-0 shadow-none"
          />
        )}

        {/* Messages */}
        <div className={`max-h-[420px] min-h-[200px] space-y-3 overflow-y-auto px-4 py-3 ${voiceMode ? "hidden" : ""}`} aria-live="polite">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-8 text-center text-muted-foreground">
              <Bot className="h-10 w-10 opacity-40" />
              <p className="text-sm">{tx.intro}</p>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                  msg.role === "user"
                    ? "rounded-br-md bg-primary text-primary-foreground"
                    : "rounded-bl-md bg-muted"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            </div>
          ))}

          {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-md bg-muted px-4 py-3">
                <div className="flex gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-foreground/40 [animation-delay:0ms]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-foreground/40 [animation-delay:150ms]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-foreground/40 [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Input */}
        <div className={`border-t px-3 py-3 ${voiceMode ? "hidden" : ""}`}>
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={tx.placeholder}
              rows={1}
              dir="auto"
              aria-label={tx.placeholder}
              className="max-h-[100px] min-h-[40px] flex-1 resize-none rounded-xl border bg-muted/50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {isLoading ? (
              <Button size="icon" variant="ghost" className="h-10 w-10 shrink-0" onClick={stopGeneration} aria-label={tx.stop}>
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button size="icon" className="h-10 w-10 shrink-0" onClick={handleSend} disabled={!input.trim()} aria-label={tx.send}>
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">{tx.disclaimer}</p>
        </div>
      </CardContent>
    </Card>
  );
}
