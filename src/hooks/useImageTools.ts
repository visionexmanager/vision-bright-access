import { useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { callImageToolsGenerate, type ImageToolMode } from "@/lib/api/edgeFunctions";

export type ImageToolStep = "idle" | "uploading" | "queued" | "processing" | "completed" | "failed";

export interface ImageToolResult {
  jobId: string;
  imageUrl: string;
  mode: ImageToolMode;
}

const POLL_INTERVAL_MS = 2500;
const MAX_POLLS = 60; // ~2.5 minutes

export function useImageTools() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [step, setStep] = useState<ImageToolStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImageToolResult | null>(null);
  const cancelledRef = useRef(false);

  const run = useCallback(async (mode: ImageToolMode, file: File, prompt?: string) => {
    if (!user) {
      setError("Sign in to use Image Studio tools.");
      setStep("failed");
      return;
    }
    cancelledRef.current = false;
    setError(null);
    setResult(null);
    setStep("uploading");

    try {
      // Real upload to Supabase Storage — not simulated. Replicate fetches
      // the image directly from this public URL.
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("image-tool-inputs")
        .upload(path, file, { contentType: file.type || "image/png", upsert: false });
      if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

      const { data: pub } = supabase.storage.from("image-tool-inputs").getPublicUrl(path);
      if (cancelledRef.current) return;

      setStep("queued");
      const genRes = await callImageToolsGenerate({ action: "generate", mode, image_url: pub.publicUrl, prompt });
      if (!genRes.ok || !genRes.job_id) {
        throw new Error(genRes.error ?? "Failed to start image job");
      }
      if (cancelledRef.current) return;

      setStep("processing");
      for (let i = 0; i < MAX_POLLS; i++) {
        if (cancelledRef.current) return;
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        if (cancelledRef.current) return;

        const poll = await callImageToolsGenerate({ action: "poll", job_id: genRes.job_id });
        if (poll.status === "completed" && poll.image_url) {
          setResult({ jobId: genRes.job_id, imageUrl: poll.image_url, mode });
          setStep("completed");
          qc.invalidateQueries({ queryKey: ["ams", "assets"] });
          toast.success("Image ready");
          return;
        }
        if (poll.status === "failed") {
          throw new Error(poll.error ?? "Image processing failed");
        }
        // still processing — keep polling
      }
      throw new Error("Image processing timed out. It may still finish — check your Asset Library shortly.");
    } catch (err) {
      if (cancelledRef.current) return;
      const msg = err instanceof Error ? err.message : "Image tool failed";
      setError(msg);
      setStep("failed");
      toast.error(msg);
    }
  }, [user, qc]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    setStep("idle");
    setError(null);
  }, []);

  const reset = useCallback(() => {
    cancelledRef.current = true;
    setStep("idle");
    setError(null);
    setResult(null);
  }, []);

  const isRunning = step === "uploading" || step === "queued" || step === "processing";

  return { run, cancel, reset, step, error, result, isRunning };
}
