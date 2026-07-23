import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as amsService from "@/services/ai-media-studio/amsService";
import { supabase } from "@/integrations/supabase/client";
import type { AssetFilters, UploadItem } from "@/lib/types/ai-media-studio";

export const AMS_ASSETS_KEY = ["ams", "assets"] as const;

export function useAMSAssets(initialFilters: AssetFilters = {}) {
  const qc = useQueryClient();
  const [filters, setFilters] = useState<AssetFilters>(initialFilters);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const abortControllers = useRef<Map<string, AbortController>>(new Map());

  const query = useQuery({
    queryKey: [...AMS_ASSETS_KEY, filters],
    queryFn: () => amsService.listAssets(filters),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => amsService.deleteAsset(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: AMS_ASSETS_KEY });
      toast.success("Asset deleted");
    },
    onError: () => toast.error("Failed to delete asset"),
  });

  const updateFilters = useCallback((patch: Partial<AssetFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
  }, []);

  const patchUpload = useCallback((id: string, patch: Partial<UploadItem>) => {
    setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  }, []);

  const uploadFiles = useCallback(
    async (files: File[], projectId?: string) => {
      const items: UploadItem[] = files.map((file) => ({
        id: crypto.randomUUID(),
        file,
        status: "pending",
        progress: 0,
      }));
      setUploads((prev) => [...prev, ...items]);

      for (const item of items) {
        const controller = new AbortController();
        abortControllers.current.set(item.id, controller);

        patchUpload(item.id, { status: "uploading" });

        try {
          const assetType = resolveAssetType(item.file.type);
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user) throw new Error("Not authenticated");

          const safeName = sanitizeFilename(item.file.name);
          const storagePath = `${user.id}/${crypto.randomUUID()}-${safeName}`;
          await amsService.uploadAssetFile(
            item.file,
            storagePath,
            controller.signal,
            (progress) => patchUpload(item.id, { progress })
          );

          let record;
          try {
            record = await amsService.createAssetRecord({
              project_id: projectId,
              filename: safeName,
              original_name: item.file.name,
              asset_type: assetType,
              mime_type: item.file.type || undefined,
              size_bytes: item.file.size,
              storage_path: storagePath,
            });
          } catch (error) {
            await amsService.removeUploadedAsset(storagePath).catch(() => undefined);
            throw error;
          }

          patchUpload(item.id, { status: "done", progress: 100, assetId: record.id });
          toast.success(`"${item.file.name}" uploaded`);
          qc.invalidateQueries({ queryKey: AMS_ASSETS_KEY });
          amsService.recalculateStorage().catch(() => {});
        } catch (err) {
          const isCancelled = controller.signal.aborted || (err instanceof DOMException && err.name === "AbortError");
          patchUpload(item.id, {
            status: isCancelled ? "cancelled" : "error",
            error: isCancelled ? undefined : (err as Error).message,
          });
          if (!isCancelled) toast.error(`Failed to upload "${item.file.name}"`);
        } finally {
          abortControllers.current.delete(item.id);
        }
      }
    },
    [patchUpload, qc]
  );

  const cancelUpload = useCallback(
    (id: string) => {
      abortControllers.current.get(id)?.abort();
      patchUpload(id, { status: "cancelled" });
    },
    [patchUpload]
  );

  const retryUpload = useCallback(
    (id: string) => {
      const item = uploads.find((u) => u.id === id);
      if (item) uploadFiles([item.file]);
    },
    [uploads, uploadFiles]
  );

  const clearCompletedUploads = useCallback(() => {
    setUploads((prev) => prev.filter((u) => u.status === "uploading" || u.status === "pending"));
  }, []);

  return {
    assets: query.data ?? [],
    isLoading: query.isLoading,
    filters,
    updateFilters,
    deleteAsset: deleteMutation.mutate,
    uploads,
    uploadFiles,
    cancelUpload,
    retryUpload,
    clearCompletedUploads,
  };
}

function resolveAssetType(mimeType: string) {
  if (mimeType.startsWith("audio/")) return "audio" as const;
  if (mimeType.startsWith("video/")) return "video" as const;
  if (mimeType.startsWith("image/")) return "image" as const;
  if (mimeType.includes("pdf") || mimeType.includes("document") || mimeType.includes("text"))
    return "document" as const;
  return "other" as const;
}

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").toLowerCase();
}
