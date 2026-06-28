import { useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { callSpeechGenerate } from "@/lib/api/edgeFunctions";
import type { GeneratedAudio, GenerationStep, SpeechVoice, SpeechEmotion, OutputFormat, SpeechModel } from "@/lib/types/speech-studio";

interface GenerateParams {
  text: string;
  voice: SpeechVoice;
  language: string;
  emotion: SpeechEmotion;
  speed: number;
  pitch: number;
  outputFormat: OutputFormat;
  model: SpeechModel;
  projectId?: string;
  presetId?: string;
  presetName?: string;
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

export function useSpeechGenerate() {
  const qc = useQueryClient();
  const [step, setStep]         = useState<GenerationStep>("idle");
  const [error, setError]       = useState<string | null>(null);
  const [audio, setAudio]       = useState<GeneratedAudio | null>(null);
  const [progress, setProgress] = useState(0); // 0-100 visual
  const abortRef                = useRef<AbortController | null>(null);

  // Revoke previous Blob URL when a new one is created
  const prevBlobUrl = useRef<string | null>(null);

  const generate = useCallback(async (params: GenerateParams) => {
    // Abort any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // Revoke old blob URL
    if (prevBlobUrl.current) {
      URL.revokeObjectURL(prevBlobUrl.current);
      prevBlobUrl.current = null;
    }

    setError(null);
    setAudio(null);
    setStep("queued");
    setProgress(5);

    // Brief "queued" visual, then switch to processing
    await new Promise((r) => setTimeout(r, 400));
    if (controller.signal.aborted) return;

    setStep("processing");

    // Animate progress bar during generation
    const progressInterval = setInterval(() => {
      setProgress((p) => (p < 85 ? p + Math.random() * 8 : p));
    }, 600);

    try {
      const result = await callSpeechGenerate(
        {
          text:               params.text.trim(),
          voice_id:           params.voice.id,
          provider_voice_id:  params.voice.provider_voice_id,
          voice_name:         params.voice.name,
          provider:           params.voice.provider,
          model:              params.model,
          language:           params.language,
          emotion:            params.emotion,
          speed:              params.speed,
          pitch:              params.pitch,
          output_format:      params.outputFormat,
          project_id:         params.projectId,
          preset_id:          params.presetId,
          preset_name:        params.presetName,
        },
        controller.signal
      );

      clearInterval(progressInterval);
      if (controller.signal.aborted) return;

      setStep("finalizing");
      setProgress(95);

      // Decode base64 → Blob → Blob URL
      const blob = base64ToBlob(result.audio_base64, result.mime_type);
      const blobUrl = URL.createObjectURL(blob);
      prevBlobUrl.current = blobUrl;

      const generatedAudio: GeneratedAudio = {
        jobId:       result.job_id,
        assetId:     result.asset_id,
        blobUrl,
        mimeType:    result.mime_type,
        durationSec: result.duration_sec,
        sizeBytes:   result.size_bytes,
        outputFormat: result.output_format as OutputFormat,
        voiceId:     params.voice.id,
        voiceName:   params.voice.name,
        text:        params.text,
        createdAt:   new Date().toISOString(),
      };

      setAudio(generatedAudio);
      setStep("completed");
      setProgress(100);

      // Invalidate history and storage caches
      qc.invalidateQueries({ queryKey: ["ams", "speech-history"] });
      qc.invalidateQueries({ queryKey: ["ams", "storage"] });
      qc.invalidateQueries({ queryKey: ["ams", "voice-recent"] });

      toast.success("Audio generated successfully");
    } catch (err) {
      clearInterval(progressInterval);
      if (controller.signal.aborted) {
        setStep("idle");
        return;
      }
      const msg = err instanceof Error ? err.message : "Generation failed";
      setError(msg);
      setStep("failed");
      setProgress(0);
      toast.error(msg);
    }
  }, [qc]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setStep("idle");
    setProgress(0);
    setError(null);
    toast.info("Generation cancelled");
  }, []);

  const reset = useCallback(() => {
    if (prevBlobUrl.current) {
      URL.revokeObjectURL(prevBlobUrl.current);
      prevBlobUrl.current = null;
    }
    setStep("idle");
    setError(null);
    setAudio(null);
    setProgress(0);
  }, []);

  const isGenerating = step === "queued" || step === "processing" || step === "finalizing";

  return {
    generate,
    cancel,
    reset,
    step,
    progress,
    error,
    audio,
    isGenerating,
  };
}
