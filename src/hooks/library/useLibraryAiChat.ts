/**
 * useLibraryAiChat — "chat with the book." Wraps useSSEStream() (reused
 * unmodified from the site-wide streaming infra) + sendLibraryChatMessage.
 *
 * Phase 8: the session_id now persists per-book in localStorage (previously
 * regenerated on every mount, so refreshing the reader silently started a
 * blank conversation even though the full history was sitting in
 * library_ai_chat_sessions) — "New conversation" is the only thing that now
 * rotates it. That persistence is what makes the added Realtime subscription
 * meaningful: if the same signed-in user has this book's chat open in a
 * second tab/device, both share the same session_id, so a postgres_changes
 * INSERT on library_ai_chat_sessions (filtered to this session_id) lets the
 * idle tab pick up the other tab's new turns without a manual refetch — RLS
 * on the table already scopes what a subscriber can receive to their own
 * rows. Refetch is skipped while THIS tab is actively streaming, so it never
 * clobbers a response still being typed out locally.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useSSEStream } from "@/lib/api/useSSEStream";
import { supabase } from "@/integrations/supabase/client";
import { sendLibraryChatMessage, fetchChatHistory } from "@/services/library/aiChat";
import { useAiReadingPreferences } from "@/hooks/library/useAiReadingPreferences";
import type { LibraryChatMessage, LibraryCitation } from "@/lib/types/library-ai";

function sessionStorageKey(bookId: string): string {
  return `library:ai-chat-session:${bookId}`;
}

function loadOrCreateSessionId(bookId: string): string {
  try {
    const existing = localStorage.getItem(sessionStorageKey(bookId));
    if (existing) return existing;
  } catch {
    // localStorage unavailable — falls through to an in-memory-only session id.
  }
  const fresh = crypto.randomUUID();
  try {
    localStorage.setItem(sessionStorageKey(bookId), fresh);
  } catch {
    // Best-effort only — conversation still works for this tab's lifetime.
  }
  return fresh;
}

export function useLibraryAiChat(bookId: string | undefined, chapterId?: string) {
  const { readingMode } = useAiReadingPreferences();
  const { isStreaming, error, consumeStream, abort } = useSSEStream();
  const [sessionId, setSessionId] = useState(() => (bookId ? loadOrCreateSessionId(bookId) : crypto.randomUUID()));
  const [messages, setMessages] = useState<LibraryChatMessage[]>([]);
  const [citations, setCitations] = useState<LibraryCitation[]>([]);
  const isStreamingRef = useRef(isStreaming);
  isStreamingRef.current = isStreaming;

  useEffect(() => {
    if (!bookId) return;
    setSessionId(loadOrCreateSessionId(bookId));
  }, [bookId]);

  useEffect(() => {
    if (!bookId) return;
    void fetchChatHistory(bookId, sessionId).then(setMessages).catch(() => setMessages([]));
  }, [bookId, sessionId]);

  // Cross-tab/device live sync — see header note.
  useEffect(() => {
    if (!bookId) return;
    const channel = supabase
      .channel(`library-ai-chat-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "library_ai_chat_sessions", filter: `session_id=eq.${sessionId}` },
        () => {
          if (isStreamingRef.current) return;
          void fetchChatHistory(bookId, sessionId).then(setMessages).catch(() => {});
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [bookId, sessionId]);

  const startNewConversation = useCallback(() => {
    const fresh = crypto.randomUUID();
    if (bookId) {
      try {
        localStorage.setItem(sessionStorageKey(bookId), fresh);
      } catch {
        // Best-effort only.
      }
    }
    setSessionId(fresh);
    setMessages([]);
    setCitations([]);
  }, [bookId]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!bookId || !text.trim()) return;
      const userMessage: LibraryChatMessage = { role: "user", content: text };
      setMessages((prev) => [...prev, userMessage, { role: "assistant", content: "" }]);
      setCitations([]);

      try {
        const { response, getCitations } = await sendLibraryChatMessage(bookId, sessionId, text, chapterId, readingMode);
        setCitations(getCitations());
        await consumeStream(response, {
          onToken: (_token, accumulated) => {
            setMessages((prev) => {
              const next = [...prev];
              next[next.length - 1] = { role: "assistant", content: accumulated };
              return next;
            });
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
    [bookId, sessionId, chapterId, readingMode, consumeStream]
  );

  return { messages, sendMessage, isStreaming, error, citations, sessionId, startNewConversation, abort };
}
