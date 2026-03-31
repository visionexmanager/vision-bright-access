import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAIChat } from "@/hooks/useAIChat";
import { Bot, X, Send, Trash2, Square, Mic, MicOff } from "lucide-react";
import ReactMarkdown from "react-markdown";

export type AIChatOpenEvent = CustomEvent<{ productName: string; prompt: string }>;

declare global {
  interface WindowEventMap {
    "ai-chat-open": AIChatOpenEvent;
  }
}

export function openAIChatWithProduct(productName: string, prompt: string) {
  window.dispatchEvent(new CustomEvent("ai-chat-open", { detail: { productName, prompt } }));
}

export function AIChat() {
  const { t, lang } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const { messages, isLoading, sendMessage, clearMessages, stopGeneration } = useAIChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const [isListening, setIsListening] = useState(false);
  const isRTL = lang === "ar";

  // Speech recognition language mapping
  const speechLangMap: Record<string, string> = {
    en: "en-US", ar: "ar-SA", es: "es-ES", fr: "fr-FR",
    de: "de-DE", pt: "pt-BR", tr: "tr-TR", ru: "ru-RU", zh: "zh-CN",
  };

  const hasSpeechRecognition = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const toggleListening = useCallback(() => {
    if (!hasSpeechRecognition) return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = speechLangMap[lang] || "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript.trim()) {
        setInput(transcript);
        // Auto-send after a brief pause so user can see what was transcribed
        setTimeout(() => {
          sendMessage(transcript.trim());
          setInput("");
        }, 500);
      }
      setIsListening(false);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening, lang, hasSpeechRecognition, sendMessage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { recognitionRef.current?.stop(); };
  }, []);

  // Listen for external open-with-product events
  useEffect(() => {
    const handler = (e: AIChatOpenEvent) => {
      clearMessages();
      setIsOpen(true);
      // Small delay so chat panel renders before sending
      setTimeout(() => {
        sendMessage(e.detail.prompt, { productName: e.detail.productName });
      }, 100);
    };
    window.addEventListener("ai-chat-open", handler);
    return () => window.removeEventListener("ai-chat-open", handler);
  }, [clearMessages, sendMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

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

  const suggestions = [
    t("ai.suggestion1"),
    t("ai.suggestion2"),
    t("ai.suggestion3"),
  ];

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 z-50 h-14 w-14 rounded-full shadow-lg hover:scale-105 transition-transform"
          style={{ [isRTL ? "left" : "right"]: "1.5rem" }}
          size="icon"
          aria-label={t("ai.openChat")}
        >
          <Bot className="h-6 w-6" />
        </Button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div
          className="fixed bottom-0 z-50 flex flex-col bg-background border shadow-2xl rounded-t-2xl sm:rounded-2xl sm:bottom-6 w-full sm:w-[400px] h-[85vh] sm:h-[600px] max-h-[85vh]"
          style={{ [isRTL ? "left" : "right"]: "0", ...(typeof window !== "undefined" && window.innerWidth >= 640 ? { [isRTL ? "left" : "right"]: "1.5rem" } : {}) }}
          role="dialog"
          aria-label={t("ai.chatTitle")}
          dir={isRTL ? "rtl" : "ltr"}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b px-4 py-3 shrink-0">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              <span className="font-semibold text-sm">{t("ai.chatTitle")}</span>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={clearMessages}
                  aria-label={t("ai.clearChat")}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsOpen(false)}
                aria-label={t("ai.closeChat")}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" aria-live="polite">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                <Bot className="h-12 w-12 text-muted-foreground/40" />
                <div>
                  <p className="font-medium text-sm">{t("ai.welcomeTitle")}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t("ai.welcomeSubtitle")}</p>
                </div>
                <div className="flex flex-col gap-2 w-full max-w-xs">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => { setInput(""); sendMessage(s); }}
                      className="text-xs text-start px-3 py-2 rounded-lg border bg-muted/50 hover:bg-muted transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
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
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="border-t px-3 py-3 shrink-0">
            <div className="flex items-end gap-2">
              {hasSpeechRecognition && (
                <Button
                  size="icon"
                  variant={isListening ? "default" : "ghost"}
                  className={`h-10 w-10 shrink-0 ${isListening ? "animate-pulse bg-destructive hover:bg-destructive/90" : ""}`}
                  onClick={toggleListening}
                  aria-label={isListening ? t("ai.stopListening") : t("ai.startListening")}
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
              )}
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isListening ? t("ai.listeningPlaceholder") : t("ai.placeholder")}
                rows={1}
                className="flex-1 resize-none rounded-xl border bg-muted/50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[40px] max-h-[100px]"
                aria-label={t("ai.placeholder")}
                dir="auto"
              />
              {isLoading ? (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-10 w-10 shrink-0"
                  onClick={stopGeneration}
                  aria-label={t("ai.stop")}
                >
                  <Square className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  onClick={handleSend}
                  disabled={!input.trim()}
                  aria-label={t("ai.send")}
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
