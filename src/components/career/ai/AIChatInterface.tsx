import { useState } from "react";
import { Sparkles, Send, ArrowUpRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { AIThinkingIndicator } from "./AIThinkingIndicator";
import { routeAssistantQuery } from "./aiAssistantRouter";
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

  const send = (value?: string) => {
    const query = (value ?? text).trim();
    if (!query) return;
    playSound("send");
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", content: query }]);
    setText("");
    setThinking(true);
    setSuggested(undefined);
    window.setTimeout(() => {
      const { reply, suggestedModule } = routeAssistantQuery(query);
      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: "assistant", content: reply }]);
      setSuggested(suggestedModule);
      setThinking(false);
    }, 1100);
  };

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
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                  m.role === "user" ? "bg-primary text-primary-foreground" : "border border-border/60 bg-card"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {thinking && <AIThinkingIndicator />}
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
        </div>
      )}

      <label htmlFor="ai-hub-input" className="sr-only">{t("aiSuite.chat.title")}</label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Textarea
          id="ai-hub-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={t("aiSuite.chat.placeholder")}
          rows={3}
          className="resize-none bg-background/60 text-base"
        />
        <Button onClick={() => send()} disabled={!text.trim()} size="lg" className="shrink-0 sm:h-auto sm:px-6">
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
            className="rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t(key)}
          </button>
        ))}
      </div>
    </div>
  );
}
