import { useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { callSpeechTranscribe } from "@/lib/api/edgeFunctions";

export type TranscribeStep = "idle" | "reading" | "transcribing" | "completed" | "failed";

interface TranscribeResult {
  jobId: string;
  transcriptText: string;
  detectedLanguage: string | null;
  durationSec: number | null;
  filename: string;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // result is "data:<mime>;base64,<data>" — strip the prefix
      const commaIdx = result.indexOf(",");
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read audio file"));
    reader.readAsDataURL(file);
  });
}

export function useSpeechTranscribe() {
  const qc = useQueryClient();
  const [step, setStep] = useState<TranscribeStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TranscribeResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const transcribe = useCallback(async (file: File, languageHint?: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setError(null);
    setResult(null);
    setStep("reading");

    try {
      const audio_base64 = await fileToBase64(file);
      if (controller.signal.aborted) return;

      setStep("transcribing");
      const res = await callSpeechTranscribe(
        {
          audio_base64,
          mime_type: file.type || "audio/webm",
          filename: file.name,
          language_hint: languageHint,
        },
        controller.signal
      );
      if (controller.signal.aborted) return;

      setResult({
        jobId: res.job_id,
        transcriptText: res.transcript_text,
        detectedLanguage: res.detected_language,
        durationSec: res.duration_sec,
        filename: file.name,
      });
      setStep("completed");
      qc.invalidateQueries({ queryKey: ["ams", "storage"] });
      toast.success("Transcription complete");
    } catch (err) {
      if (controller.signal.aborted) {
        setStep("idle");
        return;
      }
      const msg = err instanceof Error ? err.message : "Transcription failed";
      setError(msg);
      setStep("failed");
      toast.error(msg);
    }
  }, [qc]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setStep("idle");
    setError(null);
  }, []);

  const reset = useCallback(() => {
    setStep("idle");
    setError(null);
    setResult(null);
  }, []);

  const isTranscribing = step === "reading" || step === "transcribing";

  return { transcribe, cancel, reset, step, error, result, isTranscribing };
}
