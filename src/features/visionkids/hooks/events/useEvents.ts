import { useQuery, useMutation } from "@tanstack/react-query";
import * as events from "@/features/visionkids/services/events/events";
import type { EventType } from "@/features/visionkids/types/events.types";

export function useEvents(eventType?: EventType, filters: events.EventFilters = {}) {
  return useQuery({
    queryKey: ["kids-events", "list", eventType ?? "all", filters],
    queryFn: () => events.fetchEvents(eventType, filters),
  });
}

export function useEventBySlug(slug: string | undefined) {
  return useQuery({ queryKey: ["kids-events", "detail", slug], queryFn: () => events.fetchEventBySlug(slug!), enabled: !!slug });
}

export function useEventById(id: string | undefined) {
  return useQuery({ queryKey: ["kids-events", "byId", id], queryFn: () => events.fetchEventById(id!), enabled: !!id });
}

export function useEventsByIds(ids: string[]) {
  return useQuery({
    queryKey: ["kids-events", "byIds", [...ids].sort()],
    queryFn: () => events.fetchEventsByIds(ids),
    enabled: ids.length > 0,
  });
}

export function useEventsInRange(fromIso: string, toIso: string, filters: events.EventFilters = {}) {
  return useQuery({
    queryKey: ["kids-events", "range", fromIso, toIso, filters],
    queryFn: () => events.fetchEventsInRange(fromIso, toIso, filters),
  });
}

export function useUpcomingEvents(limit = 6) {
  return useQuery({ queryKey: ["kids-events", "upcoming", limit], queryFn: () => events.fetchUpcomingEvents(limit) });
}

export function useIncrementEventReaction() {
  return useMutation({ mutationFn: ({ eventId, emoji }: { eventId: string; emoji: string }) => events.incrementEventReaction(eventId, emoji) });
}
