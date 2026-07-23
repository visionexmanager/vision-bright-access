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
import { useQueryClient } from "@tanstack/react-query";

export function useFileStudio() {
  const { user } = useAuth();
  const { totalPoints } = usePoints();
  const queryClient = useQueryClient();
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

  useEffect(() => {
    if (!user) return;
    void (supabase as any).rpc("refund_stale_file_conversions").then(
      ({ data, error }: { data: number | null; error: { message: string } | null }) => {
        if (error) {
          console.error("[FileStudio] stale refund check failed:", error.message);
        } else if (Number(data) > 0) {
          toast.info(`${data} interrupted conversion charge${data === 1 ? "" : "s"} refunded.`);
          void queryClient.invalidateQueries({ queryKey: ["points-total", user.id] });
          void queryClient.invalidateQueries({ queryKey: ["points-history", user.id] });
        }
      },
    );
  }, [queryClient, user]);

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

      // Check the cached balance for immediate feedback. The database repeats
      // this check under a wallet lock before charging.
      const cost = calculateVxCost(moduleType, targetFormat, fileSizeMb(file));
      if (user && totalPoints < cost) {
        toast.error(`Insufficient VX. Need ${cost.toLocaleString()} VX, you have ${totalPoints.toLocaleString()} VX.`);
        return null;
      }

      if (!user) return null;
      const jobId = crypto.randomUUID();
      const { data: chargedAmount, error: chargeError } = await (supabase as any).rpc("charge_file_conversion", {
        _job_id: jobId,
        _module_type: moduleType,
        _target_format: targetFormat,
        _file_size_bytes: file.size,
      });
      if (chargeError) {
        toast.error(chargeError.message || "Unable to charge VX for this conversion.");
        return null;
      }
      void queryClient.invalidateQueries({ queryKey: ["points-total", user.id] });
      void queryClient.invalidateQueries({ queryKey: ["points-history", user.id] });

      const job = jobQueue.enqueue({
        id: jobId,
        file,
        moduleType,
        targetFormat,
        options,
        userId: user?.id ?? null,
        priority,
      });

      const unsub = jobQueue.subscribe((updated) => {
        if (updated.id !== job.id || !["failed", "completed", "cancelled"].includes(updated.status)) return;
        const succeeded = updated.status === "completed";
        void (supabase as any).rpc("settle_file_conversion", {
          _job_id: job.id,
          _succeeded: succeeded,
        }).then(({ error }: { error: { message: string } | null }) => {
          if (error) {
            console.error("[FileStudio] settlement failed:", error.message);
          } else if (!succeeded) {
            toast.info(`${Number(chargedAmount ?? cost).toLocaleString()} VX refunded.`);
          }
          void queryClient.invalidateQueries({ queryKey: ["points-total", user.id] });
          void queryClient.invalidateQueries({ queryKey: ["points-history", user.id] });
        });
        unsub();
      });

      toast.success(`Job queued: ${file.name} → ${targetFormat.toUpperCase()}`);
      return job;
    },
    [user, totalPoints, plan, priority, queryClient]
  );

  const cancelJob = useCallback((id: string) => {
    jobQueue.cancel(id);
  }, []);

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
