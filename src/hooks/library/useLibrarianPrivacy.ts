import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import {
  fetchDataRequests, exportMemory, deleteMemoryCategory, deleteAllMemory, pauseMemory, resumeMemory, downloadMemoryExport,
  type LibraryPrivacyCategory,
} from "@/services/library/librarianPrivacy";
import { useLibrarianPreferences } from "@/hooks/library/useLibrarianPreferences";

export function useLibrarianPrivacy() {
  const { user } = useAuth();
  const uid = user?.id ?? "";
  const queryClient = useQueryClient();
  const { memoryPaused } = useLibrarianPreferences();
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTogglingPause, setIsTogglingPause] = useState(false);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: queryKeys.library.librarianDataRequests(uid),
    queryFn: () => fetchDataRequests(uid),
    enabled: !!user,
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: queryKeys.library.librarianDataRequests(uid) });

  const doExport = async () => {
    setIsExporting(true);
    try {
      const bundle = await exportMemory();
      downloadMemoryExport(bundle);
      invalidate();
      toast({ title: "Export ready", description: "Your data has been downloaded." });
    } catch (err) {
      toast({ title: "Export failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const doDeleteCategory = async (category: LibraryPrivacyCategory) => {
    setIsDeleting(true);
    try {
      await deleteMemoryCategory(category);
      invalidate();
      toast({ title: "Data deleted" });
    } catch (err) {
      toast({ title: "Couldn't delete data", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const doDeleteAll = async () => {
    setIsDeleting(true);
    try {
      await deleteAllMemory();
      invalidate();
      toast({ title: "All memory deleted" });
    } catch (err) {
      toast({ title: "Couldn't delete data", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const togglePause = async () => {
    setIsTogglingPause(true);
    try {
      if (memoryPaused) await resumeMemory();
      else await pauseMemory();
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.aiPreferences(uid) });
      invalidate();
    } catch (err) {
      toast({ title: "Couldn't update memory setting", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setIsTogglingPause(false);
    }
  };

  return { requests, isLoading, memoryPaused, isExporting, isDeleting, isTogglingPause, doExport, doDeleteCategory, doDeleteAll, togglePause };
}
