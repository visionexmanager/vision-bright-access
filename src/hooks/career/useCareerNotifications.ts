// ─── useCareerNotifications — career-scoped notifications (Phase 1 backend) ───

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchCareerNotifications, markCareerNotificationRead, markAllCareerNotificationsRead } from "@/services/career/notifications";

export function useCareerNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.career.notifications(user?.id ?? ""),
    queryFn: () => fetchCareerNotifications(user!.id),
    enabled: !!user,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.career.notifications(user?.id ?? "") });

  const { mutateAsync: markRead } = useMutation({
    mutationFn: (notificationId: string) => markCareerNotificationRead(notificationId),
    onSuccess: invalidate,
  });

  const { mutateAsync: markAllRead } = useMutation({
    mutationFn: () => markAllCareerNotificationsRead(user!.id),
    onSuccess: invalidate,
  });

  const notifications = data ?? [];
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return { notifications, unreadCount, isLoading, error: error ? (error as Error).message : null, markRead, markAllRead };
}
