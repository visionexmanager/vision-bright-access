import { useEffect, useRef, useState } from "react";
import { Sparkles, Send, ArrowUpRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { AIThinkingIndicator } from "./AIThinkingIndicator";
import { routeAssistantQuery } from "./aiAssistantRouter";
import { streamCareerChat } from "@/services/career/careerChat";
import type { AIModuleId, ChatMessage } from "./types";

interface AIChatInterfaceProps {
  onOpenModule: (id: AIModuleId) => void;
}

const EXAMPLE_KEYS = [
  "aiSuite.chat.example1",
  "aiSuite.chat.example2",
  "aiSuite.chat.example3",
  "aiSuite.chat.example4",
  "aiSuite.chat.example5",
  "aiSuite.chat.example6",
];

export function AIChatInterface({ onOpenModule }: AIChatInterfaceProps) {
  const { t } = useLanguage();
  const { playSound } = useSound();
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const [suggested, setSuggested] = useState<AIModuleId | undefined>();
  const [failed, setFailed] = useState(false);
  // The reply as it streams in. Shown, but hidden from screen readers until it
  // is complete, when it joins the log once and is announced once.
  const [streaming, setStreaming] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const send = async (value?: string) => {
    const query = (value ?? text).trim();
    if (!query || thinking) return;
    playSound("send");
    const history = [...messages, { id: `u-${Date.now()}`, role: "user" as const, content: query }];
    setMessages(history);
    setText("");
    setThinking(true);
    setFailed(false);
    setStreaming("");
    setSuggested(undefined);
    // Sending disables the button or chip that was pressed; keep focus where
    // the next question is typed rather than letting it fall to the page.
    inputRef.current?.focus();

    // The reply comes from the career-ai model; the module suggestion is still
    // the local keyword router, because it only picks which tool to offer.
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const reply = await streamCareerChat(
        history.map(({ role, content }) => ({ role, content })),
        setStreaming,
        controller.signal,
      );
      if (!reply.trim()) throw new Error("EMPTY_REPLY");
      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: "assistant", content: reply }]);
      setSuggested(routeAssistantQuery(query).suggestedModule);
    } catch {
      if (controller.signal.aborted) return;
      // Give the question back, so trying again is one key press.
      setText(query);
      setFailed(true);
    } finally {
      if (!controller.signal.aborted) {
        setStreaming("");
        setThinking(false);
      }
    }
  };

  const bubble = (role: "user" | "assistant") =>
    `max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
      role === "user" ? "bg-primary text-primary-foreground" : "border border-border/60 bg-card"
    }`;

  return (
    <div className="ai-glass ai-neon-ring mx-auto flex w-full max-w-3xl flex-col gap-4 rounded-3xl p-6 sm:p-8">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-lg font-bold">{t("aiSuite.chat.title")}</h1>
          <p className="text-xs text-muted-foreground">{t("aiSuite.chat.disclaimer")}</p>
        </div>
      </div>

      {messages.length > 0 && (
        <div className="flex flex-col gap-3" role="log" aria-label={t("aiSuite.chat.title")}>
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div dir="auto" className={bubble(m.role)}>{m.content}</div>
            </div>
          ))}
        </div>
      )}
      {streaming && (
        <div className="flex justify-start" aria-hidden="true">
          <div dir="auto" className={bubble("assistant")}>{streaming}</div>
        </div>
      )}
      {thinking && !streaming && <AIThinkingIndicator />}
      {failed && (
        <p role="alert" className="self-start rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm">
          {t("aiSuite.chat.error")}
        </p>
      )}
      {suggested && !thinking && (
        <button
          type="button"
          onClick={() => onOpenModule(suggested)}
          className="flex items-center gap-1.5 self-start rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("aiSuite.chat.openModule")}
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}

      <label htmlFor="ai-hub-input" className="sr-only">{t("aiSuite.chat.title")}</label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Textarea
          ref={inputRef}
          id="ai-hub-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={t("aiSuite.chat.placeholder")}
          rows={3}
          className="resize-none bg-background/60 text-base"
        />
        <Button onClick={() => send()} disabled={!text.trim() || thinking} size="lg" className="shrink-0 sm:h-auto sm:px-6">
          <Send className="me-2 h-4 w-4" aria-hidden="true" />
          {t("aiSuite.chat.send")}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {EXAMPLE_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => send(t(key))}
            aria-disabled={thinking}
            className="rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t(key)}
          </button>
        ))}
      </div>
    </div>
  );
}
