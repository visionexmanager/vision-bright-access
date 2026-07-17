// ─── useCareerMessages — the signed-in user's career DMs (Phase 1 backend) ────

import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchMyCareerMessages, sendCareerMessage, markCareerMessageRead } from "@/services/career/messages";
import { fetchDisplayNames } from "@/services/career/profile";

export function useCareerMessages() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.career.messages(user?.id ?? ""),
    queryFn: () => fetchMyCareerMessages(user!.id),
    enabled: !!user,
  });

  const messages = data ?? [];

  const counterpartIds = useMemo(() => {
    if (!user) return [];
    return messages.map((m) => (m.sender_id === user.id ? m.recipient_id : m.sender_id));
  }, [messages, user]);

  const { data: names } = useQuery({
    queryKey: ["career", "message-names", counterpartIds.join(",")],
    queryFn: () => fetchDisplayNames(counterpartIds),
    enabled: counterpartIds.length > 0,
  });

  const getCounterpartName = (message: { sender_id: string; recipient_id: string }) => {
    if (!user) return "";
    const otherId = message.sender_id === user.id ? message.recipient_id : message.sender_id;
    return names?.[otherId] || "";
  };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.career.messages(user?.id ?? "") });

  const { mutateAsync: send, isPending: isSending } = useMutation({
    mutationFn: (args: { recipientId: string; body: string }) => sendCareerMessage(user!.id, args.recipientId, args.body),
    onSuccess: invalidate,
  });

  const { mutateAsync: markRead } = useMutation({
    mutationFn: (messageId: string) => markCareerMessageRead(messageId),
    onSuccess: invalidate,
  });

  return { messages, getCounterpartName, isLoading, error: error ? (error as Error).message : null, refetch, send, isSending, markRead };
}
