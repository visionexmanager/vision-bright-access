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

const POLL_INTERVAL_MS = 4_000;
// Luma jobs normally finish in ~1–3 min. Stop chasing a job that has clearly
// stalled instead of polling the edge function forever in a background tab.
const POLL_TIMEOUT_MS  = 15 * 60_000;

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
  const pollRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  // True only while a job is genuinely in flight — guards against results from
  // a poll that resolves after the user cancelled or started a new generation.
  const pollingRef  = useRef(false);
  const jobIdRef    = useRef<string | null>(null);

  const stopPolling = useCallback(() => {
    pollingRef.current = false;
    if (pollRef.current)  { clearTimeout(pollRef.current);   pollRef.current  = null; }
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

  // Poll the edge function for status.
  // Scheduled with a chained timeout rather than setInterval so a slow poll can
  // never overlap the next one and pile up requests against the edge function.
  const startPolling = useCallback((jobId: string) => {
    pollingRef.current = true;
    const deadline = Date.now() + POLL_TIMEOUT_MS;

    const poll = async (): Promise<void> => {
      if (!pollingRef.current) return;

      try {
        const res = await callVideoStudio({ action: "poll", job_id: jobId });
        // The user may have cancelled or restarted while this was in flight.
        if (!pollingRef.current) return;

        if (!res.ok) {
          setState((s) => ({
            ...s,
            phase:        "failed",
            errorMessage: res.error ?? "Generation failed",
          }));
          stopPolling();
          qc.invalidateQueries({ queryKey: VX_JOBS_KEY });
          return;
        }

        if (res.status === "cancelled") {
          stopPolling();
          qc.invalidateQueries({ queryKey: VX_JOBS_KEY });
          setState(INITIAL_STATE);
          return;
        }

        const phase    = STATUS_PHASE_MAP[res.status as VideoJobStatus] ?? "generating";
        const progress = res.progress ?? 50;

        if (phase === "completed") {
          setState((s) => ({ ...s, phase, progress: 100 }));
          stopPolling();
          qc.invalidateQueries({ queryKey: VX_JOBS_KEY });
          toast({ title: "Video ready!", description: "Your video has been generated." });
          return;
        }

        if (phase === "failed") {
          // The edge function reports the provider's reason on a 200 response,
          // so surface it instead of a bare "Failed".
          setState((s) => ({
            ...s,
            phase,
            errorMessage: res.error ?? "The provider could not generate this video.",
          }));
          stopPolling();
          qc.invalidateQueries({ queryKey: VX_JOBS_KEY });
          return;
        }

        setState((s) => ({ ...s, phase, progress }));
      } catch {
        // Transient network error — keep polling
      }

      if (!pollingRef.current) return;

      if (Date.now() >= deadline) {
        setState((s) => ({
          ...s,
          phase:        "failed",
          errorMessage: "Generation timed out. Check the library later — the job may still finish.",
        }));
        stopPolling();
        qc.invalidateQueries({ queryKey: VX_JOBS_KEY });
        return;
      }

      pollRef.current = setTimeout(() => { void poll(); }, POLL_INTERVAL_MS);
    };

    void poll(); // immediate first poll
  }, [qc, stopPolling]);

  const generate = useCallback(async (form: VideoGenerateForm) => {
    // Cancel any in-flight request
    abortRef.current?.abort();
    stopPolling();

    const ac = new AbortController();
    abortRef.current = ac;
    jobIdRef.current = null;

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
          jobId:        res.job_id ?? null,
          errorMessage: res.error ?? "Failed to start generation",
        }));
        stopPolling();
        if (res.job_id) qc.invalidateQueries({ queryKey: VX_JOBS_KEY });
        return;
      }

      if (!res.job_id) {
        setState((s) => ({
          ...s,
          phase:        "failed",
          errorMessage: "The server accepted the request but returned no job id.",
        }));
        stopPolling();
        return;
      }

      const jobId = res.job_id;
      jobIdRef.current = jobId;
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
    // "Cancel generation" and "Generate another" share this handler, but only an
    // in-flight job should be cancelled server-side — otherwise a finished job
    // would be marked cancelled just because the user started a new one.
    const inFlightJobId = pollingRef.current ? jobIdRef.current : null;

    abortRef.current?.abort();
    stopPolling();
    jobIdRef.current = null;
    setState(INITIAL_STATE);

    if (inFlightJobId) {
      void callVideoStudio({ action: "cancel", job_id: inFlightJobId })
        .then(() => {
          qc.invalidateQueries({ queryKey: VX_JOBS_KEY });
          toast({ title: "Generation cancelled" });
        })
        .catch(() => {
          toast({
            title:       "Could not cancel on the server",
            description: "The job may still be running. Check the library.",
            variant:     "destructive",
          });
        });
    }
  }, [stopPolling, qc]);

  // Cleanup on unmount — stop polling but leave the job running so it keeps
  // generating while the user is on another page.
  useEffect(() => () => {
    abortRef.current?.abort();
    stopPolling();
  }, [stopPolling]);

  return { state, generate, reset };
}
