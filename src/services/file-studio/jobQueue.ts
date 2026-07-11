// ─── File Studio — In-Memory Job Queue ───────────────────────────────────────
// Manages async conversion jobs with status, progress, retry logic, and expiry.
// Persisted to Supabase in Phase 12 (table: file_conversion_jobs).

import type {
  ConversionJob,
  ModuleType,
  AnyFormat,
  ConversionOptions,
  JobPriority,
} from "@/lib/types/fileStudio";
import { runConversion, fileSizeMb } from "./engine";
import { calculateVxCost } from "./pricing";
import { fsLog } from "./logger";
import { classifyError, isRetryable } from "./errors";

type JobListener = (job: ConversionJob) => void;

class JobQueue {
  private jobs: Map<string, ConversionJob> = new Map();
  private listeners: Set<JobListener> = new Set();
  private activeWorkers = 0;
  private readonly MAX_WORKERS = 2;
  private readonly EXPIRY_MS = 24 * 60 * 60 * 1000;
  private readonly MAX_RETRIES = 2;
  // jobId -> true once the user cancels; checked before a result is applied
  // so an in-flight browser computation can't silently resurrect a cancelled job.
  private cancelledJobs: Set<string> = new Set();
  // Blob object URLs created for completed jobs, revoked on expiry/removal
  // to avoid leaking memory for a page session that runs many conversions.
  private objectUrls: Map<string, string> = new Map();

  subscribe(fn: JobListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(job: ConversionJob) {
    this.listeners.forEach((fn) => fn({ ...job }));
  }

  getJobs(): ConversionJob[] {
    return [...this.jobs.values()].sort(
      (a, b) =>
        (a.priority === "priority" ? 0 : 1) - (b.priority === "priority" ? 0 : 1) ||
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }

  getJob(id: string): ConversionJob | undefined {
    return this.jobs.get(id);
  }

  /**
   * Refuse a duplicate submission: same file (name+size), same target format,
   * already queued/processing. Prevents accidental double-runs from a fast
   * double-click without blocking a legitimate re-run after failure/cancel.
   */
  hasActiveDuplicate(file: File, targetFormat: AnyFormat): boolean {
    for (const job of this.jobs.values()) {
      if (
        (job.status === "queued" || job.status === "processing") &&
        job.inputFileName === file.name &&
        job.inputFileSize === file.size &&
        job.targetFormat === targetFormat
      ) {
        return true;
      }
    }
    return false;
  }

  enqueue(params: {
    file: File;
    moduleType: ModuleType;
    targetFormat: AnyFormat;
    options: ConversionOptions;
    userId: string | null;
    priority: JobPriority;
  }): ConversionJob {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const vxCost = calculateVxCost(
      params.moduleType,
      params.targetFormat,
      fileSizeMb(params.file)
    );

    const job: ConversionJob = {
      id,
      userId: params.userId,
      moduleType: params.moduleType,
      inputFileName: params.file.name,
      inputFileSize: params.file.size,
      inputFormat: params.file.name.split(".").pop()?.toLowerCase() ?? "",
      targetFormat: params.targetFormat,
      options: params.options,
      status: "queued",
      priority: params.priority,
      progress: 0,
      vxCost,
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(Date.now() + this.EXPIRY_MS).toISOString(),
      retryCount: 0,
    };

    this.jobs.set(id, job);
    fsLog(id, "upload_started", { file: params.file.name, sizeMb: fileSizeMb(params.file).toFixed(2) });
    fsLog(id, "upload_finished", { file: params.file.name });
    this.notify(job);
    this.processNext(params.file, id);
    return job;
  }

  cancel(id: string) {
    const job = this.jobs.get(id);
    if (!job) return;
    this.cancelledJobs.add(id);
    if (job.status === "queued" || job.status === "processing") {
      this.update(id, { status: "cancelled" });
      fsLog(id, "error", "Cancelled by user");
    }
  }

  /** Revoke the job's blob URL (if any) and drop it from the queue. */
  remove(id: string) {
    this.revokeResultUrl(id);
    this.jobs.delete(id);
    this.cancelledJobs.delete(id);
  }

  /** Sweep expired jobs, revoking their blob URLs so memory doesn't leak. */
  sweepExpired() {
    const now = Date.now();
    for (const job of this.jobs.values()) {
      if (new Date(job.expiresAt).getTime() <= now) {
        this.remove(job.id);
      }
    }
  }

  private revokeResultUrl(id: string) {
    const url = this.objectUrls.get(id);
    if (url) {
      URL.revokeObjectURL(url);
      this.objectUrls.delete(id);
      fsLog(id, "cleanup_completed", { url: "revoked" });
    }
  }

  private update(id: string, patch: Partial<ConversionJob>) {
    const job = this.jobs.get(id);
    if (!job) return;
    const updated = { ...job, ...patch, updatedAt: new Date().toISOString() };
    this.jobs.set(id, updated);
    this.notify(updated);
  }

  private async processNext(file: File, jobId: string) {
    if (this.activeWorkers >= this.MAX_WORKERS) return;
    const job = this.jobs.get(jobId);
    if (!job || job.status !== "queued") return;

    this.activeWorkers++;
    this.update(jobId, { status: "processing", progress: 0 });
    fsLog(jobId, "conversion_started", { moduleType: job.moduleType, targetFormat: job.targetFormat });
    const startMs = Date.now();

    try {
      const result = await runConversion({
        file,
        moduleType: job.moduleType,
        targetFormat: job.targetFormat,
        options: job.options,
        onProgress: (pct) => {
          fsLog(jobId, "conversion_progress", { pct });
          this.update(jobId, { progress: pct });
        },
      });

      // The job may have been cancelled while the browser was still computing —
      // don't resurrect it with a late result.
      if (this.cancelledJobs.has(jobId)) return;

      // Never treat an empty output as success — a 0-byte "result" is a failure.
      if (result.success && (!result.resultSize || result.resultSize <= 0)) {
        fsLog(jobId, "error", "Conversion reported success but produced an empty file");
        this.update(jobId, {
          status: "failed",
          errorMessage: "Conversion produced an empty file — treating as failed.",
          processingMs: Date.now() - startMs,
        });
        return;
      }

      if (result.success) {
        fsLog(jobId, "conversion_finished", { processingMs: Date.now() - startMs, resultSize: result.resultSize });
        if (result.resultUrl) {
          this.objectUrls.set(jobId, result.resultUrl);
          fsLog(jobId, "download_url_generated", { resultUrl: "created" });
        }
        this.update(jobId, {
          status: "completed",
          progress: 100,
          resultUrl: result.resultUrl,
          resultSize: result.resultSize,
          processingMs: Date.now() - startMs,
        });
      } else {
        const { reason, message } = classifyError(result.error ?? "Unknown internal error");
        const retried = job.retryCount ?? 0;
        if (retried < this.MAX_RETRIES && isRetryable(reason)) {
          fsLog(jobId, "error", { reason, message, willRetry: true });
          this.update(jobId, { status: "queued", retryCount: retried + 1, progress: 0 });
          await new Promise((r) => setTimeout(r, 1500 * (retried + 1)));
          this.activeWorkers--;
          this.processNext(file, jobId);
          return;
        }
        fsLog(jobId, "error", { reason, message, willRetry: false });
        this.update(jobId, {
          status: "failed",
          errorMessage: `${reason}: ${message}`,
          processingMs: Date.now() - startMs,
        });
      }
    } catch (err) {
      if (this.cancelledJobs.has(jobId)) return;
      const { reason, message } = classifyError(err);
      fsLog(jobId, "error", { reason, message, unhandled: true });
      this.update(jobId, {
        status: "failed",
        errorMessage: `${reason}: ${message}`,
        processingMs: Date.now() - startMs,
      });
    } finally {
      this.activeWorkers--;
    }
  }
}

export const jobQueue = new JobQueue();
