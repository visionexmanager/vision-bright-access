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

type JobListener = (job: ConversionJob) => void;

class JobQueue {
  private jobs: Map<string, ConversionJob> = new Map();
  private listeners: Set<JobListener> = new Set();
  private activeWorkers = 0;
  private readonly MAX_WORKERS = 2;
  private readonly EXPIRY_MS = 24 * 60 * 60 * 1000;
  private readonly MAX_RETRIES = 2;

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
    this.notify(job);
    this.processNext(params.file, id);
    return job;
  }

  cancel(id: string) {
    const job = this.jobs.get(id);
    if (job && job.status === "queued") {
      this.update(id, { status: "cancelled" });
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
    const startMs = Date.now();

    try {
      const result = await runConversion({
        file,
        moduleType: job.moduleType,
        targetFormat: job.targetFormat,
        options: job.options,
        onProgress: (pct) => this.update(jobId, { progress: pct }),
      });

      if (result.success) {
        this.update(jobId, {
          status: "completed",
          progress: 100,
          resultUrl: result.resultUrl,
          resultSize: result.resultSize,
          processingMs: Date.now() - startMs,
        });
      } else {
        const retried = job.retryCount ?? 0;
        if (retried < this.MAX_RETRIES && !result.error?.includes("server processing")) {
          this.update(jobId, { status: "queued", retryCount: retried + 1, progress: 0 });
          await new Promise((r) => setTimeout(r, 1500 * (retried + 1)));
          this.activeWorkers--;
          this.processNext(file, jobId);
          return;
        }
        this.update(jobId, {
          status: "failed",
          errorMessage: result.error,
          processingMs: Date.now() - startMs,
        });
      }
    } catch (err) {
      this.update(jobId, {
        status: "failed",
        errorMessage: err instanceof Error ? err.message : "Unexpected error",
        processingMs: Date.now() - startMs,
      });
    } finally {
      this.activeWorkers--;
    }
  }
}

export const jobQueue = new JobQueue();
