/**
 * useAIChat — General-purpose AI chat hook.
 *
 * Uses aiService.streamChat() (AI Service Layer) +
 * useSSEStream (shared SSE parser) — no direct fetch allowed here.
 */
import { useState, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSSEStream } from "@/lib/api/useSSEStream";
import { aiService } from "@/services/ai/aiService";
import {
  buildCompanionPageContext,
  clearServerCompanionMemory,
  loadCompanionMemory,
  runCompanionTool,
  saveCompanionMemory,
  setCompanionMemoryEnabled,
  type CompanionMemory,
} from "@/lib/ai/companion";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export type RateLimitInfo = {
  isRateLimited: boolean;
  cooldownSeconds: number;
};

const MAX_MESSAGES = 80;

function appendMessage(prev: Message[], msg: Message): Message[] {
  const next = [...prev, msg];
  return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
}

export function useAIChat(options?: { assistantId?: string }) {
  const assistantId = options?.assistantId;
  const [messages, setMessages]     = useState<Message[]>([]);
  const [memory, setMemory] = useState<CompanionMemory>(() => loadCompanionMemory());
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo>({
    isRateLimited: false,
    cooldownSeconds: 0,
  });
  const abortRef          = useRef<AbortController | null>(null);
  const cooldownTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const { lang }          = useLanguage();
  const { pathname }      = useLocation();
  const navigate          = useNavigate();

  const { consumeStream, isStreaming } = useSSEStream();

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

      setMessages((prev) => appendMessage(prev, userMsg));

      const controller  = new AbortController();
      abortRef.current  = controller;
      const responseId = crypto.randomUUID();

      const apiMessages = [...messages, userMsg].map((m) => ({
        role:    m.role as "user" | "assistant",
        content: m.content,
      }));

      try {
        const pageContext = buildCompanionPageContext();
        const toolResult = runCompanionTool(input, pageContext);

        if (toolResult.handled) {
          if (toolResult.navigateTo) navigate(toolResult.navigateTo);
          setMessages((prev) => appendMessage(prev, {
            id: crypto.randomUUID(),
            role: "assistant",
            content: toolResult.message || "تم.",
          }));
          setMemory(loadCompanionMemory());
          return;
        }

        const response = await aiService.streamChat(
          apiMessages,
          {
            currentPage: pathname,
            language:    lang,
            pageContext,
            companionMemoryEnabled: memory.enabled,
            companionMemory: memory.enabled ? memory.notes : [],
            companionCapabilities: [
              "navigate_sections",
              "summarize_current_page",
              "compare_known_products",
              "remember_user_preferences_when_explicitly_asked",
            ],
            ...(toolResult.context || {}),
            ...(assistantId ? { assistantId } : {}),
            ...(productContext || {}),
          },
          controller.signal
        );

        let completedReply = "";
        await consumeStream(response, {
          onToken: (_token, accumulated) => {
            completedReply = accumulated;
          },
          onError: (err, isRateLimit) => {
            if (isRateLimit) startCooldown();
            setMessages((prev) => appendMessage(prev, {
              id: crypto.randomUUID(), role: "assistant", content: `⚠️ ${err.message}`,
            }));
          },
        });
        if (completedReply.trim()) {
          setMessages((prev) => appendMessage(prev, {
            id: responseId, role: "assistant", content: completedReply,
          }));
        }
      } catch (e: unknown) {
        if (e instanceof Error && e.name === "AbortError") return;
        const msg = e instanceof Error ? e.message : "Something went wrong.";
        setMessages((prev) => appendMessage(prev, {
          id: crypto.randomUUID(), role: "assistant", content: `⚠️ ${msg}`,
        }));
      } finally {
        abortRef.current = null;
      }
    },
    [messages, lang, pathname, consumeStream, assistantId, startCooldown, memory.enabled, memory.notes, navigate]
  );

  const clearMessages = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
  }, []);

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const toggleMemory = useCallback(() => {
    setMemory((current) => setCompanionMemoryEnabled(!current.enabled));
  }, []);

  const clearMemory = useCallback(() => {
    const next = { enabled: memory.enabled, notes: [] };
    saveCompanionMemory(next);
    void clearServerCompanionMemory();
    setMemory(next);
  }, [memory.enabled]);

  return {
    messages,
    isLoading: isStreaming,
    rateLimitInfo,
    memory,
    toggleMemory,
    clearMemory,
    sendMessage,
    clearMessages,
    stopGeneration,
  };
}
