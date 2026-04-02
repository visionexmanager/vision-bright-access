import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAIChat } from "@/hooks/useAIChat";
import { Bot, X, Send, Lightbulb } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface SimulationMentorProps {
  simulationTitle: string;
  currentStepTitle: string;
}

export function SimulationMentor({ simulationTitle, currentStepTitle }: SimulationMentorProps) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const { messages, isLoading, sendMessage, clearMessages } = useAIChat();

  const mentorContext = {
    productName: `Business Simulation: ${simulationTitle}`,
  };

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    setInput("");
    sendMessage(
      `[Business Mentor Context: Simulation "${simulationTitle}", Current step: "${currentStepTitle}"]\n\n${trimmed}`,
      mentorContext
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickPrompts = [
    t("bsim.mentor.explain"),
    t("bsim.mentor.hint"),
    t("bsim.mentor.concept"),
  ];

  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-40">
        <Button
          onClick={() => setIsOpen(true)}
          className="h-14 rounded-full shadow-lg gap-2 px-5 hover:scale-105 transition-transform"
          aria-label={t("bsim.mentor.open")}
        >
          <Lightbulb className="h-5 w-5" />
          <span className="hidden sm:inline">{t("bsim.mentor.label")}</span>
        </Button>
      </div>
    );
  }

  return (
    <div
      className="fixed bottom-0 right-0 z-50 flex flex-col bg-background border shadow-2xl rounded-t-2xl sm:rounded-2xl sm:bottom-6 sm:right-6 w-full sm:w-[380px] h-[70vh] sm:h-[500px] max-h-[80vh]"
      role="dialog"
      aria-label={t("bsim.mentor.label")}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm">{t("bsim.mentor.label")}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsOpen(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" aria-live="polite">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <Bot className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">{t("bsim.mentor.welcome")}</p>
            <div className="flex flex-col gap-2 w-full max-w-xs">
              {quickPrompts.map((p, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(
                    `[Business Mentor Context: Simulation "${simulationTitle}", Current step: "${currentStepTitle}"]\n\n${p}`,
                    mentorContext
                  )}
                  className="text-xs text-start px-3 py-2 rounded-lg border bg-muted/50 hover:bg-muted transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "bg-muted rounded-bl-md"
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
            <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1">
                <span className="h-2 w-2 rounded-full bg-foreground/40 animate-bounce [animation-delay:0ms]" />
                <span className="h-2 w-2 rounded-full bg-foreground/40 animate-bounce [animation-delay:150ms]" />
                <span className="h-2 w-2 rounded-full bg-foreground/40 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t px-3 py-3 shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("bsim.mentor.placeholder")}
            rows={1}
            className="flex-1 resize-none rounded-xl border bg-muted/50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[40px] max-h-[80px]"
            dir="auto"
          />
          <Button
            size="icon"
            className="h-10 w-10 shrink-0"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
