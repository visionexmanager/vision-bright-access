import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import * as vs from "@/services/ai-media-studio/voiceStudioService";
import { analyzeAudioFile } from "@/lib/utils/audioAnalysis";
import { VS_PROFILES_KEY } from "./useVoiceProfiles";
import { DATASET_CONSTRAINTS } from "@/lib/types/voice-studio";
import type { VoiceUploadItem } from "@/lib/types/voice-studio";

const KEY = (profileId: string) => ["vs", "datasets", profileId] as const;

export function useVoiceDatasets(profileId: string) {
  const qc = useQueryClient();
  const [uploads, setUploads] = useState<VoiceUploadItem[]>([]);
  const abortRefs = useRef<Map<string, AbortController>>(new Map());

  const query = useQuery({
    queryKey: KEY(profileId),
    queryFn: () => vs.listDatasets(profileId),
    enabled: !!profileId,
  });

  // ── Mutation: delete dataset ───────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: ({ id, storagePath }: { id: string; storagePath: string }) =>
      vs.deleteDataset(id, storagePath),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: KEY(profileId) });
      await vs.syncProfileStats(profileId);
      qc.invalidateQueries({ queryKey: VS_PROFILES_KEY });
      toast.success("Sample deleted");
    },
    onError: () => toast.error("Failed to delete sample"),
  });

  // ── Upload queue ───────────────────────────────────────────────────────────
  const patchUpload = useCallback((id: string, patch: Partial<VoiceUploadItem>) => {
    setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  }, []);

  const uploadFiles = useCallback(async (files: File[]) => {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) { toast.error("Not authenticated"); return; }

    const validFiles = files.filter((f) => {
      const ext = `.${f.name.split(".").pop()?.toLowerCase()}`;
      if (!DATASET_CONSTRAINTS.ACCEPTED_EXTENSIONS.includes(ext as ".wav")) {
        toast.error(`${f.name}: unsupported format`);
        return false;
      }
      if (f.size > DATASET_CONSTRAINTS.MAX_FILE_SIZE_BYTES) {
        toast.error(`${f.name}: file too large (max 50 MB)`);
        return false;
      }
      return true;
    });

    if (!validFiles.length) return;

    // Check duplicate filenames against existing datasets
    const existing = query.data ?? [];
    const existingNames = new Set(existing.map((d) => d.filename));
    const deduped = validFiles.filter((f) => {
      if (existingNames.has(f.name)) {
        toast.warning(`${f.name}: already uploaded`);
        return false;
      }
      return true;
    });

    const items: VoiceUploadItem[] = deduped.map((file) => ({
      id:        crypto.randomUUID(),
      file,
      profileId,
      status:    "pending",
      progress:  0,
    }));

    setUploads((prev) => [...prev, ...items]);

    for (const item of items) {
      const controller = new AbortController();
      abortRefs.current.set(item.id, controller);

      try {
        // Step 1: analyze audio
        patchUpload(item.id, { status: "analyzing", progress: 5 });
        const analysis = await analyzeAudioFile(item.file);

        if (!analysis.isValid) {
          patchUpload(item.id, {
            status:   "error",
            error:    analysis.issues[0] ?? "Invalid audio",
            analysis,
          });
          continue;
        }

        patchUpload(item.id, { status: "uploading", progress: 15, analysis });

        // Step 2: upload to storage
        if (controller.signal.aborted) continue;

        const storagePath = await vs.uploadDatasetFile(
          userId,
          profileId,
          item.file,
          (pct) => patchUpload(item.id, { progress: 15 + Math.round(pct * 0.7) })
        );

        if (controller.signal.aborted) continue;

        // Step 3: create DB record
        const dataset = await vs.createDatasetRecord(
          profileId,
          item.file.name,
          storagePath,
          item.file.type || "audio/wav",
          item.file.size,
          {
            duration_sec:  analysis.durationSec,
            sample_rate:   analysis.sampleRate,
            channels:      analysis.channels,
            quality_score: analysis.qualityScore,
            noise_level:   analysis.noiseLevel,
            clarity_score: analysis.clarityScore,
            snr_db:        analysis.estimatedSnrDb,
            is_valid:      analysis.isValid,
          }
        );

        // Step 4: accept if valid
        await vs.updateDatasetStatus(dataset.id, "accepted");
        await vs.syncProfileStats(profileId);

        patchUpload(item.id, { status: "done", progress: 100, datasetId: dataset.id });

        qc.invalidateQueries({ queryKey: KEY(profileId) });
        qc.invalidateQueries({ queryKey: VS_PROFILES_KEY });

      } catch (err) {
        if (controller.signal.aborted) continue;
        const msg = err instanceof Error ? err.message : "Upload failed";
        patchUpload(item.id, { status: "error", error: msg });
        toast.error(`${item.file.name}: ${msg}`);
      } finally {
        abortRefs.current.delete(item.id);
      }
    }
  }, [profileId, query.data, qc, patchUpload]);

  const cancelUpload = useCallback((id: string) => {
    abortRefs.current.get(id)?.abort();
    abortRefs.current.delete(id);
    patchUpload(id, { status: "cancelled" });
  }, [patchUpload]);

  const retryUpload = useCallback((id: string) => {
    const item = uploads.find((u) => u.id === id);
    if (item) uploadFiles([item.file]);
    setUploads((prev) => prev.filter((u) => u.id !== id));
  }, [uploads, uploadFiles]);

  const clearCompleted = useCallback(() => {
    setUploads((prev) => prev.filter((u) => u.status !== "done" && u.status !== "cancelled"));
  }, []);

  return {
    datasets:      query.data ?? [],
    isLoading:     query.isLoading,
    uploads,
    uploadFiles,
    cancelUpload,
    retryUpload,
    clearCompleted,
    deleteDataset: deleteMutation.mutate,
  };
}
