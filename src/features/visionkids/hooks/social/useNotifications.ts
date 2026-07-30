import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as notifications from "@/features/visionkids/services/social/notifications";

export function useMyNotifications() {
  return useQuery({ queryKey: ["kids-social", "notifications"], queryFn: () => notifications.fetchMyNotifications() });
}

export function useUnreadNotificationCount() {
  return useQuery({ queryKey: ["kids-social", "notifications-unread"], queryFn: notifications.fetchUnreadCount, refetchInterval: 60000 });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notifications.markNotificationRead(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["kids-social", "notifications"] }); qc.invalidateQueries({ queryKey: ["kids-social", "notifications-unread"] }); },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notifications.markAllNotificationsRead,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["kids-social", "notifications"] }); qc.invalidateQueries({ queryKey: ["kids-social", "notifications-unread"] }); },
  });
}
