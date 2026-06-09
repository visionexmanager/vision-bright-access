/**
 * useAIChat — General-purpose AI chat hook.
 *
 * Uses aiService.streamChat() (AI Service Layer) +
 * useSSEStream (shared SSE parser) — no direct fetch allowed here.
 */
import { useState, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSSEStream } from "@/lib/api/useSSEStream";
import { aiService } from "@/services/ai/aiService";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export type RateLimitInfo = {
  isRateLimited: boolean;
  cooldownSeconds: number;
};

export function useAIChat() {
  const [messages, setMessages]     = useState<Message[]>([]);
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo>({
    isRateLimited: false,
    cooldownSeconds: 0,
  });
  const abortRef          = useRef<AbortController | null>(null);
  const cooldownTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const { lang }          = useLanguage();
  const { pathname }      = useLocation();

  const { consumeStream, isStreaming } = useSSEStream();

  const sendMessage = useCallback(
    async (
      input: string,
      productContext?: { productName?: string; currentStep?: string }
    ) => {
      const userMsg: Message = {
        id:      crypto.randomUUID(),
        role:    "user",
        content: input,
      };

      setMessages((prev) => [...prev, userMsg]);

      const controller  = new AbortController();
      abortRef.current  = controller;
      const assistantId = crypto.randomUUID();

      const apiMessages = [...messages, userMsg].map((m) => ({
        role:    m.role as "user" | "assistant",
        content: m.content,
      }));

      try {
        const response = await aiService.streamChat(
          apiMessages,
          {
            currentPage: pathname,
            language:    lang,
            ...(productContext || {}),
          },
          controller.signal
        );

        await consumeStream(response, {
          onToken: (_token, accumulated) => {
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last?.id === assistantId) {
                return prev.map((m) =>
                  m.id === assistantId ? { ...m, content: accumulated } : m
                );
              }
              return [...prev, { id: assistantId, role: "assistant", content: accumulated }];
            });
          },
          onError: (err, isRateLimit) => {
            if (isRateLimit) startCooldown();
            setMessages((prev) => [
              ...prev,
              { id: assistantId, role: "assistant", content: `⚠️ ${err.message}` },
            ]);
          },
        });
      } catch (e: unknown) {
        if (e instanceof Error && e.name === "AbortError") return;
        const msg = e instanceof Error ? e.message : "Something went wrong.";
        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: "assistant", content: `⚠️ ${msg}` },
        ]);
      } finally {
        abortRef.current = null;
      }
    },
    [messages, lang, pathname, consumeStream]
  );

  const startCooldown = useCallback(() => {
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
  }, []);

  const clearMessages = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
  }, []);

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return {
    messages,
    isLoading: isStreaming,
    rateLimitInfo,
    sendMessage,
    clearMessages,
    stopGeneration,
  };
}
