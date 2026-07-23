/**
 * useLibraryAiAssistant — action-triggered (not a useQuery, since each call
 * is a distinct user action with its own inputs), wraps
 * services/library/aiAssistant.ts. Keeps the last result/error so the panel
 * can render whichever mode was last run.
 */

import { useCallback, useState } from "react";
import { toast } from "@/hooks/use-toast";
import { runLibraryAiAssistant, type LibraryAiRequest, type LibraryAiResult } from "@/services/library/aiAssistant";
import { useAiReadingPreferences } from "@/hooks/library/useAiReadingPreferences";

export function useLibraryAiAssistant() {
  const { readingMode } = useAiReadingPreferences();
  const [result, setResult] = useState<LibraryAiResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (req: LibraryAiRequest) => {
    setIsRunning(true);
    setError(null);
    try {
      const res = await runLibraryAiAssistant({ readingMode, ...req });
      setResult(res);
      return res;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      toast({ title: "AI assistant couldn't complete this request", description: message, variant: "destructive" });
      return null;
    } finally {
      setIsRunning(false);
    }
  }, [readingMode]);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { run, reset, result, isRunning, error };
}
