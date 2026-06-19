/**
 * useAcademyChat — Academy-specific AI chat hook.
 *
 * Replaces the inline sendMessage / SSE logic in Academy.tsx.
 *
 * Features:
 *   - Loads last 50 messages from DB on mount
 *   - Sends to academy-chat edge function with user JWT
 *   - Streams response via useSSEStream (no duplicate parser)
 *   - Persists message pairs to DB after stream completes
 *   - Awards XP per message sent
 *   - Supports clearing chat (DB + local state)
 *
 * Usage:
 *   const { messages, send, isStreaming, clearChat, error } = useAcademyChat(profile, sessionId);
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useSSEStream } from "@/lib/api/useSSEStream";
import { callAcademyChat } from "@/lib/api/edgeFunctions";
import {
  getRecentChatHistory,
  saveChatMessagePair,
  clearChatSession,
  awardAcademyXP,
} from "@/services/academy/academyService";
import { queryKeys } from "@/lib/api/queryKeys";
import type { ChatMessage, StudentProfile } from "@/lib/types";

export interface UseAcademyChatReturn {
  messages:    ChatMessage[];
  isStreaming: boolean;
  isLoadingHistory: boolean;
  error:       string | null;
  rateLimitCooldown: number;
  send:        (text: string) => Promise<void>;
  clearChat:   () => Promise<void>;
  abortStream: () => void;
}

export function useAcademyChat(
  profile: StudentProfile | null,
  sessionId: string
): UseAcademyChatReturn {
  const { user }       = useAuth();
  const queryClient    = useQueryClient();
  const { consumeStream, isStreaming, error, rateLimitCooldown, abort } = useSSEStream();

  const [messages, setMessages]             = useState<ChatMessage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  // Track pending user message text for DB save after stream ends
  const pendingUserMsg = useRef<string>("");

  // ── Load history from DB on mount ────────────────────────────────────────
  useEffect(() => {
    if (!user) { setIsLoadingHistory(false); return; }

    getRecentChatHistory(user.id)
      .then((rows) => {
        setMessages(
          rows.map((r) => ({
            id:      r.id,
            role:    r.role,
            content: r.content,
          }))
        );
      })
      .catch(console.warn)
      .finally(() => setIsLoadingHistory(false));
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Send message ──────────────────────────────────────────────────────────
  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming || !profile || !user) return;

      const userMsg: ChatMessage = {
        id:      crypto.randomUUID(),
        role:    "user",
        content: text.trim(),
      };
      const assistantId = crypto.randomUUID();
      pendingUserMsg.current = text.trim();

      // Optimistic: add user message immediately
      setMessages((prev) => [...prev, userMsg]);

      // Prepare messages array for API (no id, just role+content)
      const apiMessages = [...messages, userMsg].map((m) => ({
        role:    m.role as "user" | "assistant",
        content: m.content,
      }));

      let accumulatedText = "";

      try {
        const controller = new AbortController();
        const response   = await callAcademyChat(
          { messages: apiMessages, studentProfile: profile },
          controller.signal
        );

        await consumeStream(response, {
          onToken: (_token, accumulated) => {
            accumulatedText = accumulated;
          },

          onDone: async (fullText) => {
            const finalText = fullText || accumulatedText;
            if (finalText.trim()) {
              setMessages((prev) => [
                ...prev,
                { id: assistantId, role: "assistant", content: finalText },
              ]);
            }

            // Persist to DB (non-blocking)
            saveChatMessagePair({
              userId:           user.id,
              sessionId,
              userContent:      pendingUserMsg.current,
              assistantContent: finalText,
            }).catch(console.warn);

            // Award XP
            awardAcademyXP(user.id, "academy_message_sent").then((ok) => {
              if (ok) {
                queryClient.invalidateQueries({ queryKey: queryKeys.points.total(user.id) });
                queryClient.invalidateQueries({ queryKey: queryKeys.academy.profile(user.id) });
              }
            });
          },

          onError: (err) => {
            setMessages((prev) => [
              ...prev,
              {
                id:      assistantId,
                role:    "assistant",
                content: `⚠️ ${err.message || "حدث خطأ، حاول مرة أخرى."}`,
              },
            ]);
          },
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "حدث خطأ";
        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: "assistant", content: `⚠️ ${msg}` },
        ]);
      }
    },
    [messages, profile, user, isStreaming, sessionId, consumeStream, queryClient]
  );

  // ── Clear chat ────────────────────────────────────────────────────────────
  const clearChat = useCallback(async () => {
    abort();
    setMessages([]);
    if (user) {
      await clearChatSession(user.id, sessionId).catch(console.warn);
    }
  }, [user, sessionId, abort]);

  return {
    messages,
    isStreaming,
    isLoadingHistory,
    error,
    rateLimitCooldown,
    send,
    clearChat,
    abortStream: abort,
  };
}
