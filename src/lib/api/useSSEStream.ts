/**
 * useSSEStream — Shared SSE (Server-Sent Events) streaming hook.
 *
 * Replaces the duplicated SSE parsing logic found in:
 *   - src/pages/Academy.tsx (sendMessage function)
 *   - src/hooks/useAIChat.ts (sendMessage function)
 *
 * Handles:
 *   - OpenAI-style SSE format: `data: {...}\ndata: [DONE]`
 *   - Progressive token accumulation
 *   - AbortController for cancellation
 *   - Rate limit (429) detection with cooldown timer
 *   - Proper cleanup on unmount
 *
 * Usage:
 *   const { send, content, isStreaming, error, abort } = useSSEStream();
 *
 *   await send(responsePromise, {
 *     onToken: (token) => { ... },
 *     onDone:  (fullText) => { ... },
 *     onError: (err) => { ... },
 *   });
 */

import { useState, useRef, useCallback } from "react";

export interface SSEStreamCallbacks {
  onToken:  (token: string, accumulated: string) => void;
  onDone?:  (fullText: string) => void;
  onError?: (err: Error, isRateLimit: boolean) => void;
}

export interface SSEStreamState {
  isStreaming: boolean;
  error: string | null;
  rateLimitCooldown: number;  // seconds remaining (0 = not rate-limited)
}

export interface UseSSEStreamReturn extends SSEStreamState {
  /**
   * Consume a `Response` that has already been initiated (stream: true).
   * Parses the SSE body and fires callbacks.
   */
  consumeStream: (response: Response, callbacks: SSEStreamCallbacks) => Promise<void>;
  abort: () => void;
  clearError: () => void;
}

const RATE_LIMIT_COOLDOWN = 30; // seconds

export function useSSEStream(): UseSSEStreamReturn {
  const [isStreaming, setIsStreaming]         = useState(false);
  const [error, setError]                     = useState<string | null>(null);
  const [rateLimitCooldown, setRateLimitCooldown] = useState(0);

  const abortRef          = useRef<AbortController | null>(null);
  const cooldownTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Cooldown timer helper ────────────────────────────────────────────────
  const startCooldown = useCallback(() => {
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    let remaining = RATE_LIMIT_COOLDOWN;
    setRateLimitCooldown(remaining);

    cooldownTimerRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(cooldownTimerRef.current!);
        cooldownTimerRef.current = null;
        setRateLimitCooldown(0);
      } else {
        setRateLimitCooldown(remaining);
      }
    }, 1000);
  }, []);

  // ── Core SSE parser ──────────────────────────────────────────────────────
  const consumeStream = useCallback(
    async (response: Response, { onToken, onDone, onError }: SSEStreamCallbacks) => {
      if (!response.body) {
        const err = new Error("No response body");
        onError?.(err, false);
        return;
      }

      setIsStreaming(true);
      setError(null);

      const reader  = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = "";
      let accumulated = "";
      let done      = false;

      try {
        while (!done) {
          const { done: streamDone, value } = await reader.read();
          if (streamDone) break;

          buffer += decoder.decode(value, { stream: true });

          // Process complete lines
          let newlineIdx: number;
          while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
            let line = buffer.slice(0, newlineIdx);
            buffer   = buffer.slice(newlineIdx + 1);

            // Normalize CRLF
            if (line.endsWith("\r")) line = line.slice(0, -1);

            // Skip comment / blank lines
            if (!line || line.startsWith(":")) continue;

            // Must start with "data: "
            if (!line.startsWith("data: ")) continue;

            const payload = line.slice(6).trim();
            if (payload === "[DONE]") { done = true; break; }

            try {
              const parsed  = JSON.parse(payload);
              const content = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (content) {
                accumulated += content;
                onToken(content, accumulated);
              }
            } catch {
              // Partial JSON — put it back and wait for more data
              buffer = line + "\n" + buffer;
              break;
            }
          }
        }

        // Flush remaining buffer
        if (buffer.trim()) {
          for (let raw of buffer.split("\n")) {
            if (!raw || raw.startsWith(":")) continue;
            if (raw.endsWith("\r")) raw = raw.slice(0, -1);
            if (!raw.startsWith("data: ")) continue;
            const payload = raw.slice(6).trim();
            if (payload === "[DONE]") continue;
            try {
              const parsed  = JSON.parse(payload);
              const content = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (content) {
                accumulated += content;
                onToken(content, accumulated);
              }
            } catch { /* ignore */ }
          }
        }

        onDone?.(accumulated);
      } catch (e: unknown) {
        const err = e instanceof Error ? e : new Error("Stream error");

        // Don't report abort errors
        if (err.name === "AbortError") {
          setIsStreaming(false);
          return;
        }

        const isRateLimit =
          err.message.includes("429") ||
          err.message.toLowerCase().includes("rate limit");

        setError(err.message);
        if (isRateLimit) startCooldown();
        onError?.(err, isRateLimit);
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [startCooldown]
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    isStreaming,
    error,
    rateLimitCooldown,
    consumeStream,
    abort,
    clearError,
  };
}

// ── Standalone SSE parser (non-hook, for service layer) ───────────────────────

/**
 * Pure async SSE consumer — for use in service files (not React components).
 * Does not use any React state.
 */
export async function parseSSEResponse(
  response: Response,
  onToken: (token: string, accumulated: string) => void,
  signal?: AbortSignal
): Promise<string> {
  if (!response.body) throw new Error("No response body");

  const reader  = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer    = "";
  let accumulated = "";

  try {
    while (true) {
      if (signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let newlineIdx: number;
      while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, newlineIdx);
        buffer   = buffer.slice(newlineIdx + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line || line.startsWith(":") || !line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (payload === "[DONE]") return accumulated;
        try {
          const parsed  = JSON.parse(payload);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) {
            accumulated += content;
            onToken(content, accumulated);
          }
        } catch {
          buffer = line + "\n" + buffer;
          break;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return accumulated;
}
