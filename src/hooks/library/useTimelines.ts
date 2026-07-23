import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import {
  fetchTimelines, fetchTimeline, fetchTimelineEvents, createTimeline, addTimelineEvent, deleteTimelineEvent,
  type LibraryTimelineType, type CreateTimelineInput,
} from "@/services/library/timelines";

export function useTimelines(timelineType?: LibraryTimelineType) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: timelines = [], isLoading } = useQuery({
    queryKey: queryKeys.library.timelines(timelineType ?? "all"),
    queryFn: () => fetchTimelines(timelineType),
  });

  const create = async (input: CreateTimelineInput) => {
    if (!user) return null;
    try {
      const timeline = await createTimeline(user.id, input);
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.timelines(timelineType ?? "all") });
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.timelines("all") });
      return timeline;
    } catch (err) {
      toast({ title: "Couldn't create timeline", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      return null;
    }
  };

  return { timelines, isLoading, create };
}

export function useTimeline(timelineId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: timeline } = useQuery({
    queryKey: queryKeys.library.timeline(timelineId ?? ""),
    queryFn: () => fetchTimeline(timelineId!),
    enabled: !!timelineId,
  });

  const { data: events = [], isLoading } = useQuery({
    queryKey: [...queryKeys.library.timeline(timelineId ?? ""), "events"],
    queryFn: () => fetchTimelineEvents(timelineId!),
    enabled: !!timelineId,
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: queryKeys.library.timeline(timelineId ?? "") });

  const addEvent = async (event: { event_date_or_period: string; title: string; description?: string | null }) => {
    if (!timelineId) return;
    try {
      await addTimelineEvent(timelineId, { ...event, order_index: events.length });
      invalidate();
    } catch (err) {
      toast({ title: "Couldn't add event", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const removeEvent = async (eventId: string) => {
    try {
      await deleteTimelineEvent(eventId);
      invalidate();
    } catch (err) {
      toast({ title: "Couldn't remove event", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  return { timeline, events, isLoading, addEvent, removeEvent };
}
