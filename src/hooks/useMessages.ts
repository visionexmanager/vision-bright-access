import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export interface Conversation {
  id: string;
  participant_1: string;
  participant_2: string;
  last_message_text: string | null;
  last_message_at: string | null;
  created_at: string;
  other_user?: { display_name: string | null; avatar_url: string | null };
}

export interface DirectMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export function useConversations() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("conversations")
      .select("*")
      .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
      .order("last_message_at", { ascending: false, nullsFirst: false });

    if (!data) { setLoading(false); return; }

    // Fetch other user profiles
    const otherIds = data.map(c =>
      c.participant_1 === user.id ? c.participant_2 : c.participant_1
    );
    const uniqueIds = [...new Set(otherIds)];

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url")
      .in("user_id", uniqueIds);

    const profileMap = new Map(
      (profiles || []).map(p => [p.user_id, p])
    );

    const enriched: Conversation[] = data.map(c => {
      const otherId = c.participant_1 === user.id ? c.participant_2 : c.participant_1;
      return { ...c, other_user: profileMap.get(otherId) || null };
    });

    setConversations(enriched);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Realtime subscription for conversations
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("conversations-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => {
        fetchConversations();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchConversations]);

  return { conversations, loading, refetch: fetchConversations };
}

export function useDirectMessages(conversationId: string | null) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMessages = useCallback(async () => {
    if (!conversationId) { setMessages([]); setLoading(false); return; }
    const { data } = await supabase
      .from("direct_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    setMessages(data || []);
    setLoading(false);
  }, [conversationId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Realtime for new messages
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`dm-${conversationId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "direct_messages",
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as DirectMessage]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  // Mark messages as read
  useEffect(() => {
    if (!conversationId || !user) return;
    supabase
      .from("direct_messages")
      .update({ is_read: true })
      .eq("conversation_id", conversationId)
      .neq("sender_id", user.id)
      .eq("is_read", false)
      .then();
  }, [conversationId, user, messages]);

  const sendMessage = useCallback(async (content: string) => {
    if (!user || !conversationId || !content.trim()) return;
    await supabase.from("direct_messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: content.trim(),
    });
  }, [user, conversationId]);

  return { messages, loading, sendMessage };
}

export function useUnreadCount() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!user) return;
    // Get all conversation IDs where user is a participant
    const { data: convs } = await supabase
      .from("conversations")
      .select("id")
      .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`);
    if (!convs || convs.length === 0) { setCount(0); return; }

    const ids = convs.map(c => c.id);
    const { count: unread } = await supabase
      .from("direct_messages")
      .select("id", { count: "exact", head: true })
      .in("conversation_id", ids)
      .neq("sender_id", user.id)
      .eq("is_read", false);
    setCount(unread || 0);
  }, [user]);

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 15_000);
    return () => clearInterval(interval);
  }, [fetchCount]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("unread-count")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, () => {
        fetchCount();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchCount]);

  return count;
}

export async function findOrCreateConversation(userId: string, otherUserId: string) {
  // Sort to maintain unique constraint
  const [p1, p2] = [userId, otherUserId].sort();

  // Check existing
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("participant_1", p1)
    .eq("participant_2", p2)
    .maybeSingle();

  if (existing) return existing.id;

  const { data, error } = await supabase
    .from("conversations")
    .insert({ participant_1: p1, participant_2: p2 })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}
