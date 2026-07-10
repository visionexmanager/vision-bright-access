// ─── File Studio — Error Classification ───────────────────────────────────────
// Turns raw exceptions/DOMExceptions into the clear, specific reasons the UI
// should show instead of a bare "FAILED".

export type FailureReason =
  | "Unsupported format"
  | "File too large"
  | "Converter unavailable"
  | "Network timeout"
  | "Aborted"
  | "Storage error"
  | "Permission denied"
  | "Invalid source file"
  | "Unknown internal error";

const PATTERNS: Array<[RegExp, FailureReason]> = [
  [/requires server processing|not yet supported|not supported in browser|no module found/i, "Converter unavailable"],
  [/exceeds .* (plan )?limit|too large|quota/i, "File too large"],
  [/unsupported (file )?type|unsupported format/i, "Unsupported format"],
  [/timed? ?out|timeout/i, "Network timeout"],
  [/abort/i, "Aborted"],
  [/NotAllowedError|permission denied|not allowed/i, "Permission denied"],
  [/NotSupportedError|NotReadableError|EncodingError|decode/i, "Invalid source file"],
  [/storage|quota exceeded|blob url/i, "Storage error"],
];

export function classifyError(err: unknown): { reason: FailureReason; message: string } {
  const message =
    err instanceof DOMException ? `${err.name}: ${err.message}` :
    err instanceof Error ? err.message :
    typeof err === "string" ? err :
    "Unknown internal error";

  for (const [pattern, reason] of PATTERNS) {
    if (pattern.test(message)) return { reason, message };
  }
  return { reason: "Unknown internal error", message };
}

/** True if the failure is a transient/recoverable condition worth retrying. */
export function isRetryable(reason: FailureReason): boolean {
  return reason === "Network timeout" || reason === "Storage error";
}
