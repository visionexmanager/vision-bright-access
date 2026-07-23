/**
 * useLibrarianChat — cross-book persistent AI chat. Mirrors
 * useLibraryAiChat.ts's structure (useSSEStream + per-session Realtime
 * subscription) but manages a LIST of sessions (a chat-history sidebar),
 * not one localStorage-pinned session per book.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSSEStream } from "@/lib/api/useSSEStream";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/api/queryKeys";
import { sendLibrarianChatMessage, fetchLibrarianChatHistory, fetchLibrarianChatSessions } from "@/services/library/librarianChat";
import type { LibraryChatMessage } from "@/lib/types/library-ai";

export function useLibrarianChatSessions() {
  const { user } = useAuth();
  const uid = user?.id ?? "";
  const { data: sessions = [], isLoading, refetch } = useQuery({
    queryKey: queryKeys.library.librarianChatSessions(uid),
    queryFn: () => fetchLibrarianChatSessions(uid),
    enabled: !!user,
  });
  return { sessions, isLoading, refetch };
}

export function useLibrarianChat(sessionId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isStreaming, error, consumeStream, abort } = useSSEStream();
  const [messages, setMessages] = useState<LibraryChatMessage[]>([]);
  const isStreamingRef = useRef(isStreaming);
  isStreamingRef.current = isStreaming;

  useEffect(() => {
    if (!sessionId) return;
    void fetchLibrarianChatHistory(sessionId).then(setMessages).catch(() => setMessages([]));
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase
      .channel(`library-librarian-chat-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "library_ai_chat_sessions", filter: `session_id=eq.${sessionId}` },
        () => {
          if (isStreamingRef.current) return;
          void fetchLibrarianChatHistory(sessionId).then(setMessages).catch(() => {});
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!sessionId || !text.trim()) return;
      const isFirstMessage = messages.length === 0;
      setMessages((prev) => [...prev, { role: "user", content: text }, { role: "assistant", content: "" }]);

      try {
        const response = await sendLibrarianChatMessage(sessionId, text);
        await consumeStream(response, {
          onToken: (_token, accumulated) => {
            setMessages((prev) => {
              const next = [...prev];
              next[next.length - 1] = { role: "assistant", content: accumulated };
              return next;
            });
          },
          onDone: () => {
            if (isFirstMessage && user) {
              void queryClient.invalidateQueries({ queryKey: queryKeys.library.librarianChatSessions(user.id) });
            }
          },
        });
      } catch (err) {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: err instanceof Error ? err.message : String(err) };
          return next;
        });
      }
    },
    [sessionId, messages.length, consumeStream, queryClient, user]
  );

  return { messages, sendMessage, isStreaming, error, abort };
}
