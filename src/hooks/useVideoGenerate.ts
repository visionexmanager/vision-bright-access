import { useState, useRef, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { callVideoStudio } from "@/lib/api/edgeFunctions";
import { VX_JOBS_KEY } from "@/hooks/useVideoJobs";
import type {
  VideoGenerateForm,
  VideoJobStatus,
} from "@/lib/types/video-studio";

export type GenerationPhase =
  | "idle" | "submitting" | "preparing" | "generating"
  | "rendering" | "optimizing" | "uploading" | "completed" | "failed";

export interface VideoGenerationState {
  phase:         GenerationPhase;
  progress:      number;
  jobId:         string | null;
  errorMessage:  string | null;
  elapsedSec:    number;
  estimatedSec:  number | null;
}

const INITIAL_STATE: VideoGenerationState = {
  phase:        "idle",
  progress:     0,
  jobId:        null,
  errorMessage: null,
  elapsedSec:   0,
  estimatedSec: null,
};

// Map DB status → phase
const STATUS_PHASE_MAP: Record<VideoJobStatus, GenerationPhase> = {
  queued:     "preparing",
  preparing:  "preparing",
  generating: "generating",
  rendering:  "rendering",
  optimizing: "optimizing",
  uploading:  "uploading",
  completed:  "completed",
  failed:     "failed",
  cancelled:  "idle",
};

export function useVideoGenerate() {
  const qc           = useQueryClient();
  const [state, setState] = useState<VideoGenerationState>(INITIAL_STATE);

  const abortRef    = useRef<AbortController | null>(null);
  const pollRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const stopPolling = useCallback(() => {
    if (pollRef.current)  { clearInterval(pollRef.current);  pollRef.current  = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  // Elapsed-time ticker
  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setState((s) => ({
        ...s,
        elapsedSec: Math.floor((Date.now() - startTimeRef.current) / 1000),
      }));
    }, 1000);
  }, []);

  // Poll the edge function for status
  const startPolling = useCallback((jobId: string) => {
    const poll = async () => {
      try {
        const res = await callVideoStudio({ action: "poll", job_id: jobId });
        if (!res.ok) {
          setState((s) => ({
            ...s,
            phase:        "failed",
            errorMessage: res.error ?? "Generation failed",
          }));
          stopPolling();
          return;
        }

        const phase    = STATUS_PHASE_MAP[res.status as VideoJobStatus] ?? "generating";
        const progress = res.progress ?? 50;

        setState((s) => ({ ...s, phase, progress }));

        if (phase === "completed") {
          stopPolling();
          qc.invalidateQueries({ queryKey: VX_JOBS_KEY });
          toast({ title: "Video ready!", description: "Your video has been generated." });
        } else if (phase === "failed") {
          stopPolling();
          qc.invalidateQueries({ queryKey: VX_JOBS_KEY });
        }
      } catch {
        // Transient network error — keep polling
      }
    };

    pollRef.current = setInterval(poll, 4000);
    poll(); // immediate first poll
  }, [qc, stopPolling]);

  const generate = useCallback(async (form: VideoGenerateForm) => {
    // Cancel any in-flight request
    abortRef.current?.abort();
    stopPolling();

    const ac = new AbortController();
    abortRef.current = ac;

    setState({ ...INITIAL_STATE, phase: "submitting", progress: 3 });
    startTimer();

    try {
      const res = await callVideoStudio(
        {
          action:          "generate",
          title:           form.title || undefined,
          prompt:          form.prompt,
          negative_prompt: form.negativePrompt || undefined,
          style:           form.style,
          duration_sec:    form.durationSec,
          aspect_ratio:    form.aspectRatio,
          resolution:      form.resolution,
          fps:             form.fps,
          camera_motion:   form.cameraMotion,
          creativity:      form.creativity,
          seed:            form.seed ? Number(form.seed) : undefined,
          provider:        form.provider,
          provider_model:  form.providerModel,
          project_id:      form.projectId || undefined,
          template_id:     form.templateId || undefined,
          audio_asset_id:  form.audioAssetId || undefined,
          audio_mode:      form.audioMode,
        },
        ac.signal
      );

      if (!res.ok) {
        setState((s) => ({
          ...s,
          phase:        "failed",
          errorMessage: res.error ?? "Failed to start generation",
        }));
        stopPolling();
        return;
      }

      const jobId = res.job_id!;
      setState((s) => ({ ...s, phase: "preparing", progress: 8, jobId }));
      qc.invalidateQueries({ queryKey: VX_JOBS_KEY });
      startPolling(jobId);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setState((s) => ({
        ...s,
        phase:        "failed",
        errorMessage: err instanceof Error ? err.message : "Unknown error",
      }));
      stopPolling();
    }
  }, [startTimer, startPolling, stopPolling, qc]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    stopPolling();
    setState(INITIAL_STATE);
  }, [stopPolling]);

  // Cleanup on unmount
  useEffect(() => () => {
    abortRef.current?.abort();
    stopPolling();
  }, [stopPolling]);

  return { state, generate, reset };
}
