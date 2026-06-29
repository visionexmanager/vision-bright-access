import { useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { callImageGenerate } from "@/lib/api/edgeFunctions";
import type { ImageGenerateRequest, ImageGenerateResponse } from "@/lib/api/edgeFunctions";

export type ImageGenerationStep =
  | "idle" | "queued" | "processing" | "completed" | "failed";

export interface GeneratedImage {
  jobId:         string;
  assetId:       string | null;
  imageUrl:      string;
  revisedPrompt: string;
  width:         number;
  height:        number;
  model:         string;
  size:          string;
  quality:       string;
  style:         string;
  prompt:        string;
  createdAt:     string;
}

export function useImageGenerate() {
  const qc = useQueryClient();
  const [step, setStep]         = useState<ImageGenerationStep>("idle");
  const [error, setError]       = useState<string | null>(null);
  const [image, setImage]       = useState<GeneratedImage | null>(null);
  const [progress, setProgress] = useState(0);
  const abortRef                = useRef<AbortController | null>(null);
  const progressRef             = useRef<ReturnType<typeof setInterval> | null>(null);

  const generate = useCallback(async (params: ImageGenerateRequest) => {
    abortRef.current?.abort();
    if (progressRef.current) clearInterval(progressRef.current);

    const controller = new AbortController();
    abortRef.current = controller;

    setError(null);
    setImage(null);
    setStep("queued");
    setProgress(5);

    await new Promise((r) => setTimeout(r, 300));
    if (controller.signal.aborted) return;

    setStep("processing");

    progressRef.current = setInterval(() => {
      setProgress((p) => (p < 80 ? p + Math.random() * 6 : p));
    }, 800);

    try {
      const result = await callImageGenerate(params, controller.signal);

      if (progressRef.current) clearInterval(progressRef.current);
      if (controller.signal.aborted) return;

      if (!result.ok) {
        setError(result.error ?? "Image generation failed");
        setStep("failed");
        setProgress(0);
        toast.error(result.error ?? "Image generation failed");
        return;
      }

      setProgress(100);
      setStep("completed");
      setImage({
        jobId:         result.job_id,
        assetId:       result.asset_id,
        imageUrl:      result.image_url,
        revisedPrompt: result.revised_prompt,
        width:         result.width,
        height:        result.height,
        model:         result.model,
        size:          result.size,
        quality:       result.quality,
        style:         result.style,
        prompt:        params.prompt,
        createdAt:     new Date().toISOString(),
      });

      qc.invalidateQueries({ queryKey: ["ams", "assets"] });
      toast.success("Image generated successfully");
    } catch (err) {
      if (progressRef.current) clearInterval(progressRef.current);
      if (controller.signal.aborted) {
        setStep("idle");
        return;
      }
      const msg = err instanceof Error ? err.message : "Image generation failed";
      setError(msg);
      setStep("failed");
      setProgress(0);
      toast.error(msg);
    }
  }, [qc]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    if (progressRef.current) clearInterval(progressRef.current);
    setStep("idle");
    setProgress(0);
    setError(null);
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    if (progressRef.current) clearInterval(progressRef.current);
    setStep("idle");
    setError(null);
    setImage(null);
    setProgress(0);
  }, []);

  return {
    generate,
    cancel,
    reset,
    step,
    progress,
    error,
    image,
    isGenerating: step === "queued" || step === "processing",
  };
}
