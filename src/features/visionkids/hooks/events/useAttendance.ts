import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as attendance from "@/features/visionkids/services/events/attendance";

export function useMyAttendanceForEvent(eventId: string | undefined) {
  return useQuery({ queryKey: ["kids-events", "my-attendance", eventId], queryFn: () => attendance.fetchMyAttendanceForEvent(eventId!), enabled: !!eventId });
}

export function useAttendanceCount(eventId: string | undefined) {
  return useQuery({ queryKey: ["kids-events", "attendance-count", eventId], queryFn: () => attendance.fetchAttendanceCount(eventId!), enabled: !!eventId });
}

export function useCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => attendance.checkIn(eventId),
    onSuccess: (_d, eventId) => {
      qc.invalidateQueries({ queryKey: ["kids-events", "my-attendance", eventId] });
      qc.invalidateQueries({ queryKey: ["kids-events", "attendance-count", eventId] });
      qc.invalidateQueries({ queryKey: ["kids", "achievements"] });
    },
  });
}

export function useCheckOut() {
  return useMutation({ mutationFn: ({ attendanceId, durationSeconds }: { attendanceId: string; durationSeconds: number }) => attendance.checkOut(attendanceId, durationSeconds) });
}
