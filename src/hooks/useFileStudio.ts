// ─── useFileStudio — React hook for File Studio state ────────────────────────

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePoints } from "@/hooks/usePoints";
import { jobQueue } from "@/services/file-studio/jobQueue";
import {
  detectModuleType,
  getSupportedOutputFormats,
  validateFileSize,
} from "@/services/file-studio/engine";
import { calculateVxCost } from "@/services/file-studio/pricing";
import { fileSizeMb } from "@/services/file-studio/engine";
import { PLAN_FREE, PLAN_VX } from "@/lib/types/fileStudio";
import type {
  ConversionJob,
  ModuleType,
  AnyFormat,
  ConversionOptions,
} from "@/lib/types/fileStudio";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useFileStudio() {
  const { user } = useAuth();
  const { totalPoints } = usePoints();
  const [jobs, setJobs] = useState<ConversionJob[]>([]);

  // Determine user plan based on points balance
  const plan = totalPoints >= 10_000 ? PLAN_VX : PLAN_FREE;
  const priority = plan.priority;

  // Subscribe to job queue updates
  useEffect(() => {
    const unsub = jobQueue.subscribe(() => {
      setJobs(jobQueue.getJobs());
    });
    setJobs(jobQueue.getJobs());
    return unsub;
  }, []);

  // Periodically release expired jobs' blob URLs so a long-lived tab doesn't
  // accumulate memory across many conversions.
  useEffect(() => {
    const interval = setInterval(() => jobQueue.sweepExpired(), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const submitConversion = useCallback(
    async (
      file: File,
      targetFormat: AnyFormat,
      options: ConversionOptions
    ): Promise<ConversionJob | null> => {
      // Detect module
      const moduleType = detectModuleType(file.name);
      if (!moduleType) {
        toast.error(`Unsupported file type: .${file.name.split(".").pop()}`);
        return null;
      }

      // Prevent running more than one conversion for the same file+target at once
      if (jobQueue.hasActiveDuplicate(file, targetFormat)) {
        toast.info(`${file.name} → ${targetFormat.toUpperCase()} is already in progress.`);
        return null;
      }

      // Validate file size against plan
      const sizeError = validateFileSize(file, plan.maxFileSizeMb);
      if (sizeError) {
        toast.error(sizeError);
        return null;
      }

      // Check VX balance
      const cost = calculateVxCost(moduleType, targetFormat, fileSizeMb(file));
      if (user && totalPoints < cost) {
        toast.error(`Insufficient VX. Need ${cost.toLocaleString()} VX, you have ${totalPoints.toLocaleString()} VX.`);
        return null;
      }

      // Deduct VX (best-effort; refunded on failure via award_points).
      // Never let a billing hiccup block the conversion itself.
      if (user) {
        try {
          await supabase.rpc("award_points", {
            _points: -cost,
            _reason: `File Studio: convert ${file.name} → ${targetFormat}`,
          });
        } catch (err) {
          console.error("[FileStudio] VX deduction failed, proceeding anyway:", err);
        }
      }

      const job = jobQueue.enqueue({
        file,
        moduleType,
        targetFormat,
        options,
        userId: user?.id ?? null,
        priority,
      });

      // Refund on failure — listen for this job to settle, then always unsubscribe
      // (previously only unsubscribed on failure, leaking a listener per successful job).
      if (user) {
        const unsub = jobQueue.subscribe((updated) => {
          if (updated.id !== job.id) return;
          if (updated.status === "failed") {
            supabase.rpc("award_points", {
              _points: cost,
              _reason: `File Studio refund: ${file.name} failed`,
            }).then(({ error }) => {
              if (error) console.error("[FileStudio] VX refund failed:", error.message);
            });
            toast.info(`${cost.toLocaleString()} VX refunded — conversion failed.`);
            unsub();
          } else if (updated.status === "completed" || updated.status === "cancelled") {
            unsub();
          }
        });
      }

      toast.success(`Job queued: ${file.name} → ${targetFormat.toUpperCase()}`);
      return job;
    },
    [user, totalPoints, plan, priority]
  );

  const cancelJob = useCallback((id: string) => {
    const job = jobQueue.getJob(id);
    if (job && user) {
      // Refund VX for cancelled queued job
      supabase.rpc("award_points", {
        _points: job.vxCost,
        _reason: `File Studio refund: cancelled ${job.inputFileName}`,
      });
    }
    jobQueue.cancel(id);
  }, [user]);

  return {
    jobs,
    plan,
    totalPoints,
    submitConversion,
    cancelJob,
    detectModuleType,
    getSupportedOutputFormats,
  };
}
