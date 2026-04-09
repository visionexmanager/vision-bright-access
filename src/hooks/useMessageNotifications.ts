import { useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

let permissionGranted = false;

export function requestNotificationPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    permissionGranted = true;
    return;
  }
  if (Notification.permission !== "denied") {
    Notification.requestPermission().then((p) => {
      permissionGranted = p === "granted";
    });
  }
}

export function showBrowserNotification(title: string, body: string, onClick?: () => void) {
  if (!permissionGranted || document.hasFocus()) return;
  try {
    const n = new Notification(title, {
      body,
      icon: "/favicon.ico",
      tag: "visionex-msg",
    });
    if (onClick) n.onclick = () => { window.focus(); onClick(); };
    setTimeout(() => n.close(), 6000);
  } catch { /* silent */ }
}

export function useMessageNotifications() {
  const { user } = useAuth();

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("msg-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages" },
        async (payload) => {
          const msg = payload.new as any;
          if (msg.sender_id === user.id) return;

          // Verify this message is in a conversation the user is part of
          const { data: conv } = await supabase
            .from("conversations")
            .select("participant_1, participant_2")
            .eq("id", msg.conversation_id)
            .single();

          if (!conv) return;
          if (conv.participant_1 !== user.id && conv.participant_2 !== user.id) return;

          // Get sender name
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name")
            .eq("user_id", msg.sender_id)
            .maybeSingle();

          const senderName = profile?.display_name || "Someone";
          showBrowserNotification(
            `💬 ${senderName}`,
            msg.content?.substring(0, 100) || "New message",
            () => { window.location.href = "/messages"; }
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);
}
