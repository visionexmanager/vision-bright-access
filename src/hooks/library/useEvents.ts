import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import {
  fetchUpcomingEvents, createEvent, cancelEvent, rsvpToEvent, fetchMyRsvp, fetchRsvpCount, startEventVoiceRoom,
  type LibraryEventInput, type LibraryEventRsvpStatus,
} from "@/services/library/events";

export function useEvents(clubId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: events = [], isLoading } = useQuery({
    queryKey: queryKeys.library.libraryEvents(clubId ?? "platform"),
    queryFn: () => fetchUpcomingEvents(clubId),
  });

  const create = async (input: LibraryEventInput) => {
    if (!user) return null;
    try {
      const event = await createEvent(user.id, input);
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.libraryEvents(clubId ?? "platform") });
      toast({ title: "Event created" });
      return event;
    } catch (err) {
      toast({ title: "Couldn't create event", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      return null;
    }
  };

  const cancel = async (eventId: string) => {
    await cancelEvent(eventId);
    void queryClient.invalidateQueries({ queryKey: queryKeys.library.libraryEvents(clubId ?? "platform") });
  };

  return { events, isLoading, create, cancel };
}

export function useEventRsvp(eventId: string | undefined) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: myStatus } = useQuery({
    queryKey: queryKeys.library.myEventRsvp(eventId ?? "", user?.id ?? ""),
    queryFn: () => fetchMyRsvp(eventId!, user!.id),
    enabled: !!eventId && !!user,
  });

  const { data: goingCount = 0 } = useQuery({
    queryKey: queryKeys.library.eventRsvps(eventId ?? ""),
    queryFn: () => fetchRsvpCount(eventId!),
    enabled: !!eventId,
  });

  const rsvp = async (status: LibraryEventRsvpStatus) => {
    if (!eventId || !user) return;
    try {
      await rsvpToEvent(eventId, status);
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.myEventRsvp(eventId, user.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.eventRsvps(eventId) });
    } catch (err) {
      toast({ title: "Couldn't RSVP", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const joinLiveRoom = async () => {
    if (!eventId) return;
    try {
      const roomId = await startEventVoiceRoom(eventId);
      navigate(`/community/voice-room/${roomId}`);
    } catch (err) {
      toast({ title: "Couldn't start the live room", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  return { myStatus: myStatus ?? null, goingCount, rsvp, joinLiveRoom };
}
