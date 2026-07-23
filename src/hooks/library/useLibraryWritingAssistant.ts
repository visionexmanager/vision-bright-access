/**
 * useLibraryWritingAssistant — action-triggered (mirrors
 * useLibraryAiAssistant.ts's exact shape), wraps
 * services/library/writingAssistant.ts. One instance per
 * WritingAssistantPanel — each mode tab calls `run` with its own inputs.
 */

import { useCallback, useState } from "react";
import { toast } from "@/hooks/use-toast";
import { runLibraryWritingAssistant, type LibraryWritingAiRequest, type LibraryWritingAiResult } from "@/services/library/writingAssistant";

export function useLibraryWritingAssistant() {
  const [result, setResult] = useState<LibraryWritingAiResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (req: LibraryWritingAiRequest) => {
    setIsRunning(true);
    setError(null);
    try {
      const res = await runLibraryWritingAssistant(req);
      setResult(res);
      return res;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      toast({ title: "Writing assistant couldn't complete this request", description: message, variant: "destructive" });
      return null;
    } finally {
      setIsRunning(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { run, reset, result, isRunning, error };
}
