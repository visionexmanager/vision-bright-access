// ─── File Studio — Structured Pipeline Logging ────────────────────────────────
// One consistent log line shape per stage, so the browser console shows a
// readable trail for every conversion instead of scattered ad-hoc logs.

export type PipelineStage =
  | "upload_started"
  | "upload_finished"
  | "conversion_started"
  | "conversion_progress"
  | "conversion_finished"
  | "download_url_generated"
  | "cleanup_completed"
  | "error";

const STAGE_LABEL: Record<PipelineStage, string> = {
  upload_started: "Upload Started",
  upload_finished: "Upload Finished",
  conversion_started: "Conversion Started",
  conversion_progress: "Conversion Progress",
  conversion_finished: "Conversion Finished",
  download_url_generated: "Download URL Generated",
  cleanup_completed: "Cleanup Completed",
  error: "Error",
};

export function fsLog(
  jobId: string,
  stage: PipelineStage,
  detail?: Record<string, unknown> | string
): void {
  const prefix = `[FileStudio][${jobId.slice(0, 8)}] ${STAGE_LABEL[stage]}`;
  if (stage === "error") {
    console.error(prefix, detail ?? "");
  } else {
    console.log(prefix, detail ?? "");
  }
}
