import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as svc from "@/features/visionkids/everywhere/service";
import type { UserPreferences } from "@/features/visionkids/types/everywhere.types";

export function useDevices() {
  return useQuery({ queryKey: ["kids-everywhere", "devices"], queryFn: svc.fetchDevices });
}
export function useDeviceSessions() {
  return useQuery({ queryKey: ["kids-everywhere", "sessions"], queryFn: svc.fetchSessions });
}
export function useSignOutDevice() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => svc.signOutDevice(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-everywhere", "devices"] }) });
}
export function useSignOutAllDevices() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => svc.signOutAllDevices(), onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-everywhere", "devices"] }) });
}

export function useDownloads() {
  return useQuery({ queryKey: ["kids-everywhere", "downloads"], queryFn: svc.fetchDownloads });
}
export function useRemoveDownload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, refId }: { kind: import("@/features/visionkids/types/everywhere.types").DownloadKind; refId: string }) => svc.removeDownload(kind, refId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-everywhere", "downloads"] }),
  });
}

export function usePreferences() {
  return useQuery({ queryKey: ["kids-everywhere", "preferences"], queryFn: svc.fetchPreferences });
}
export function useSavePreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: Pick<UserPreferences, "low_data" | "wifi_only" | "auto_download" | "tv_mode" | "audio_guidance">) => svc.savePreferences(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-everywhere", "preferences"] }),
  });
}
