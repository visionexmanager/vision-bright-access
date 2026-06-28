import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import {
  listVideoJobs,
  getVideoJob,
  updateVideoJob,
  getSignedVideoUrl,
} from "@/services/ai-media-studio/videoStudioService";
import { callVideoStudio } from "@/lib/api/edgeFunctions";
import type { VideoLibraryFilters, VideoJob } from "@/lib/types/video-studio";

export const VX_JOBS_KEY = ["vx", "jobs"] as const;

export function useVideoJobs(filters: VideoLibraryFilters = {}) {
  return useQuery({
    queryKey: [...VX_JOBS_KEY, filters],
    queryFn:  () => listVideoJobs(filters),
    staleTime: 10_000,
  });
}

export function useVideoJob(id: string | null) {
  return useQuery({
    queryKey: [...VX_JOBS_KEY, "detail", id],
    queryFn:  () => (id ? getVideoJob(id) : null),
    enabled:  !!id,
    staleTime: 5_000,
  });
}

export function useSignedVideoUrl(job: VideoJob | null | undefined) {
  return useQuery({
    queryKey: ["vx", "signed-url", job?.storage_path],
    queryFn:  () => (job?.storage_path ? getSignedVideoUrl(job.storage_path) : null),
    enabled:  !!job?.storage_path && !job?.video_url,
    staleTime: 3_500_000, // slightly under the 1h expiry
  });
}

export function useVideoJobMutations() {
  const qc = useQueryClient();

  const invalidate = () => qc.invalidateQueries({ queryKey: VX_JOBS_KEY });

  const rename = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      updateVideoJob(id, { title }),
    onSuccess: invalidate,
    onError: () => toast({ title: "Rename failed", variant: "destructive" }),
  });

  const toggleFavorite = useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) =>
      updateVideoJob(id, { is_favorite: value }),
    onMutate: async ({ id, value }) => {
      await qc.cancelQueries({ queryKey: VX_JOBS_KEY });
      qc.setQueriesData({ queryKey: VX_JOBS_KEY }, (old: VideoJob[] | undefined) =>
        old?.map((j) => (j.id === id ? { ...j, is_favorite: value } : j))
      );
    },
    onSettled: invalidate,
  });

  const archive = useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) =>
      updateVideoJob(id, { is_archived: value }),
    onSuccess: () => {
      invalidate();
      toast({ title: "Updated" });
    },
    onError: () => toast({ title: "Failed", variant: "destructive" }),
  });

  const cancel = useMutation({
    mutationFn: (jobId: string) =>
      callVideoStudio({ action: "cancel", job_id: jobId }),
    onSuccess: () => {
      invalidate();
      toast({ title: "Generation cancelled" });
    },
    onError: () => toast({ title: "Cancel failed", variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (jobId: string) =>
      callVideoStudio({ action: "delete", job_id: jobId }),
    onSuccess: () => {
      invalidate();
      toast({ title: "Video deleted" });
    },
    onError: () => toast({ title: "Delete failed", variant: "destructive" }),
  });

  return { rename, toggleFavorite, archive, cancel, remove };
}
