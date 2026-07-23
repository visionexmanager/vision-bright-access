/**
 * useLibraryAiHistory — merges chat-session summaries (fetchChatSessions,
 * already user+book scoped) with library_ai_activity_log rows (summary/
 * translation/explain-selection), sorted newest-first, for the AI
 * sidebar's History tab.
 */

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchChatSessions } from "@/services/library/aiChat";
import { fetchAiActivityLog } from "@/services/library/aiActivityLog";
import type { LibraryAiHistoryItem } from "@/lib/types/library-ai";

export function useLibraryAiHistory(bookId: string | undefined) {
  const { user } = useAuth();
  const uid = user?.id;

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.library.aiActivityLog(uid ?? "", bookId ?? ""),
    queryFn: async (): Promise<LibraryAiHistoryItem[]> => {
      const [sessions, activity] = await Promise.all([
        fetchChatSessions(bookId!),
        fetchAiActivityLog(uid!, bookId),
      ]);

      const chatItems: LibraryAiHistoryItem[] = sessions.map((s) => ({
        id: s.session_id,
        type: "chat",
        title: "Chat",
        snippet: s.last_message,
        createdAt: s.last_message_at,
        sessionId: s.session_id,
      }));

      const activityItems: LibraryAiHistoryItem[] = activity.map((a) => ({
        id: a.id,
        type: a.activity_type,
        title: a.title,
        snippet: a.snippet,
        createdAt: a.created_at,
      }));

      return [...chatItems, ...activityItems].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },
    enabled: !!uid && !!bookId,
  });

  return { items: data ?? [], isLoading };
}
