import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import * as voiceRooms from "@/features/visionkids/services/social/voiceRooms";

export function useVoiceRoomList() {
  return useQuery({ queryKey: ["kids-social", "voice-rooms"], queryFn: voiceRooms.fetchVoiceRooms });
}

export function useVoiceRoom(roomId: string | undefined) {
  return useQuery({ queryKey: ["kids-social", "voice-room", roomId], queryFn: () => voiceRooms.fetchVoiceRoom(roomId!), enabled: !!roomId });
}

export function useCreateVoiceRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: voiceRooms.CreateVoiceRoomInput) => voiceRooms.createVoiceRoom(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-social", "voice-rooms"] }),
  });
}

export function useEndVoiceRoom() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (roomId: string) => voiceRooms.endVoiceRoom(roomId), onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-social", "voice-rooms"] }) });
}

export function useRoomMembers(roomId: string | undefined) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!roomId) return;
    const channel = kidsDb
      .channel(`kids-voice-room-members-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "kids_voice_room_members", filter: `room_id=eq.${roomId}` }, () => {
        qc.invalidateQueries({ queryKey: ["kids-social", "voice-room-members", roomId] });
      })
      .subscribe();
    return () => { kidsDb.removeChannel(channel); };
  }, [roomId, qc]);

  return useQuery({ queryKey: ["kids-social", "voice-room-members", roomId], queryFn: () => voiceRooms.fetchRoomMembers(roomId!), enabled: !!roomId });
}

export function useJoinVoiceRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (roomId: string) => voiceRooms.joinVoiceRoom(roomId),
    onSuccess: (_d, roomId) => qc.invalidateQueries({ queryKey: ["kids-social", "voice-room-members", roomId] }),
  });
}

export function useLeaveVoiceRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (roomId: string) => voiceRooms.leaveVoiceRoom(roomId),
    onSuccess: (_d, roomId) => qc.invalidateQueries({ queryKey: ["kids-social", "voice-room-members", roomId] }),
  });
}

export function useRaiseHand(roomId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (raised: boolean) => voiceRooms.raiseHand(roomId!, raised),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-social", "voice-room-members", roomId] }),
  });
}

export function useSetMemberMuted(roomId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, muted }: { userId: string; muted: boolean }) => voiceRooms.setMemberMuted(roomId!, userId, muted),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-social", "voice-room-members", roomId] }),
  });
}

export function usePromoteToModerator(roomId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => voiceRooms.promoteToModerator(roomId!, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-social", "voice-room-members", roomId] }),
  });
}

export function useBanFromRoom(roomId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => voiceRooms.banFromRoom(roomId!, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-social", "voice-room-members", roomId] }),
  });
}

export function useSetRoomRecording(roomId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (active: boolean) => voiceRooms.setRoomRecording(roomId!, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-social", "voice-room", roomId] }),
  });
}
