import { useCallback, useRef, useState } from "react";

// Simulates an async AI call with a realistic "thinking" delay.
// The compute function stays entirely local/mock — swap for a real
// OpenAI/Claude/custom-model request later without touching any caller.
export function useAiSimulation<T>(compute: () => T, delayMs = 1400) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<T | null>(null);
  const requestId = useRef(0);

  const run = useCallback(() => {
    const id = ++requestId.current;
    setLoading(true);
    window.setTimeout(() => {
      if (requestId.current !== id) return; // a newer request superseded this one
      setResult(compute());
      setLoading(false);
    }, delayMs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delayMs]);

  const reset = useCallback(() => {
    requestId.current++;
    setResult(null);
    setLoading(false);
  }, []);

  return { loading, result, run, reset };
}
