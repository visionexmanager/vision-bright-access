import { useState, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export type RateLimitInfo = {
  isRateLimited: boolean;
  cooldownSeconds: number;
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

export function useAIChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo>({ isRateLimited: false, cooldownSeconds: 0 });
  const abortRef = useRef<AbortController | null>(null);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { lang } = useLanguage();
  const { pathname } = useLocation();

  const sendMessage = useCallback(
    async (input: string, productContext?: { productName?: string }) => {
      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: input,
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      const controller = new AbortController();
      abortRef.current = controller;

      let assistantSoFar = "";
      const assistantId = crypto.randomUUID();

      const apiMessages = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      try {
        const resp = await fetch(CHAT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: apiMessages,
            context: {
              currentPage: pathname,
              language: lang,
              ...(productContext || {}),
            },
          }),
          signal: controller.signal,
        });

        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}));
          const isRateLimit = resp.status === 429;
          throw Object.assign(
            new Error(errData.error || `Request failed (${resp.status})`),
            { isRateLimit }
          );
        }

        if (!resp.body) throw new Error("No response body");

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let textBuffer = "";
        let streamDone = false;

        while (!streamDone) {
          const { done, value } = await reader.read();
          if (done) break;
          textBuffer += decoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
            let line = textBuffer.slice(0, newlineIndex);
            textBuffer = textBuffer.slice(newlineIndex + 1);

            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (line.startsWith(":") || line.trim() === "") continue;
            if (!line.startsWith("data: ")) continue;

            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") {
              streamDone = true;
              break;
            }

            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (content) {
                assistantSoFar += content;
                setMessages((prev) => {
                  const last = prev[prev.length - 1];
                  if (last?.id === assistantId) {
                    return prev.map((m) =>
                      m.id === assistantId ? { ...m, content: assistantSoFar } : m
                    );
                  }
                  return [...prev, { id: assistantId, role: "assistant", content: assistantSoFar }];
                });
              }
            } catch {
              textBuffer = line + "\n" + textBuffer;
              break;
            }
          }
        }

        // Flush remaining
        if (textBuffer.trim()) {
          for (let raw of textBuffer.split("\n")) {
            if (!raw) continue;
            if (raw.endsWith("\r")) raw = raw.slice(0, -1);
            if (raw.startsWith(":") || raw.trim() === "") continue;
            if (!raw.startsWith("data: ")) continue;
            const jsonStr = raw.slice(6).trim();
            if (jsonStr === "[DONE]") continue;
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (content) {
                assistantSoFar += content;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: assistantSoFar } : m
                  )
                );
              }
            } catch { /* ignore */ }
          }
        }
      } catch (e: any) {
        if (e.name === "AbortError") return;
        const errorMsg = e.message || "Something went wrong. Please try again.";
        const isRateLimit = e.isRateLimit === true;

        if (isRateLimit) {
          const COOLDOWN = 30;
          setRateLimitInfo({ isRateLimited: true, cooldownSeconds: COOLDOWN });
          if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
          let remaining = COOLDOWN;
          cooldownTimerRef.current = setInterval(() => {
            remaining -= 1;
            if (remaining <= 0) {
              clearInterval(cooldownTimerRef.current!);
              cooldownTimerRef.current = null;
              setRateLimitInfo({ isRateLimited: false, cooldownSeconds: 0 });
            } else {
              setRateLimitInfo({ isRateLimited: true, cooldownSeconds: remaining });
            }
          }, 1000);
        }

        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: "assistant", content: `⚠️ ${errorMsg}` },
        ]);
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [messages, lang, pathname]
  );

  const clearMessages = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setIsLoading(false);
  }, []);

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
    setIsLoading(false);
  }, []);

  return { messages, isLoading, rateLimitInfo, sendMessage, clearMessages, stopGeneration };
}
