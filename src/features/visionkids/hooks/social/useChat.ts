import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import * as chat from "@/features/visionkids/services/social/chat";

export function useMyConversations() {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = kidsDb
      .channel("kids-conversations-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "kids_conversations" }, () => {
        qc.invalidateQueries({ queryKey: ["kids-social", "conversations"] });
      })
      .subscribe();
    return () => { kidsDb.removeChannel(channel); };
  }, [qc]);

  return useQuery({ queryKey: ["kids-social", "conversations"], queryFn: chat.fetchMyConversations });
}

export function useStartConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (otherUserId: string) => chat.startConversation(otherUserId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-social", "conversations"] }),
  });
}

export function useMessages(conversationId: string | undefined) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!conversationId) return;
    const channel = kidsDb
      .channel(`kids-messages-${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "kids_messages", filter: `conversation_id=eq.${conversationId}` }, () => {
        qc.invalidateQueries({ queryKey: ["kids-social", "messages", conversationId] });
      })
      .subscribe();
    return () => { kidsDb.removeChannel(channel); };
  }, [conversationId, qc]);

  return useQuery({
    queryKey: ["kids-social", "messages", conversationId],
    queryFn: () => chat.fetchMessages(conversationId!),
    enabled: !!conversationId,
  });
}

export function useSendMessage(conversationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => chat.sendMessage(conversationId!, text),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kids-social", "messages", conversationId] });
      qc.invalidateQueries({ queryKey: ["kids-social", "conversations"] });
    },
  });
}

export function useMarkConversationRead(conversationId: string | undefined, myUserId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => chat.markConversationRead(conversationId!, myUserId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-social", "messages", conversationId] }),
  });
}
