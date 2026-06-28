import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { callVoiceStudio } from "@/lib/api/edgeFunctions";
import * as vs from "@/services/ai-media-studio/voiceStudioService";
import { VS_PROFILES_KEY } from "./useVoiceProfiles";

const JOB_KEY  = (profileId: string) => ["vs", "training-job", profileId] as const;
const LOGS_KEY = (jobId: string)     => ["vs", "training-logs", jobId] as const;

export function useVoiceTraining(profileId: string) {
  const qc = useQueryClient();
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const jobQuery = useQuery({
    queryKey: JOB_KEY(profileId),
    queryFn: () => vs.getLatestTrainingJob(profileId),
    enabled: !!profileId,
    refetchInterval: false, // we handle polling manually
  });

  const logsQuery = useQuery({
    queryKey: LOGS_KEY(jobQuery.data?.id ?? ""),
    queryFn: () => vs.getTrainingLogs(jobQuery.data!.id),
    enabled: !!jobQuery.data?.id,
  });

  // Poll job status while active
  const job = jobQuery.data;
  const isActive = job && !["completed", "failed", "cancelled"].includes(job.status);

  useEffect(() => {
    if (isActive) {
      pollingRef.current = setInterval(() => {
        qc.invalidateQueries({ queryKey: JOB_KEY(profileId) });
        qc.invalidateQueries({ queryKey: VS_PROFILES_KEY });
        if (job?.id) qc.invalidateQueries({ queryKey: LOGS_KEY(job.id) });
      }, 3000);
    } else {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [isActive, profileId, job?.id, qc]);

  const startMutation = useMutation({
    mutationFn: () => callVoiceStudio({ action: "start_training", profile_id: profileId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: JOB_KEY(profileId) });
      qc.invalidateQueries({ queryKey: VS_PROFILES_KEY });
      toast.success("Training started! We'll notify you when it completes.");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to start training"),
  });

  const cancelMutation = useMutation({
    mutationFn: (jobId: string) =>
      callVoiceStudio({ action: "cancel_training", profile_id: profileId, job_id: jobId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: JOB_KEY(profileId) });
      qc.invalidateQueries({ queryKey: VS_PROFILES_KEY });
      toast.info("Training cancelled");
    },
    onError: () => toast.error("Failed to cancel training"),
  });

  return {
    job:          jobQuery.data ?? null,
    logs:         logsQuery.data ?? [],
    isActive:     !!isActive,
    isLoading:    jobQuery.isLoading,
    startTraining: startMutation.mutate,
    cancelTraining: (jobId: string) => cancelMutation.mutate(jobId),
    isStarting:   startMutation.isPending,
    isCancelling: cancelMutation.isPending,
  };
}
