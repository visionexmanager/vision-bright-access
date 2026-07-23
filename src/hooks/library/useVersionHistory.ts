/**
 * useVersionHistory — a chapter's saved/autosave version list plus restore.
 * Autosave writing itself lives in useChapterEditor.ts (it needs direct
 * access to the live Tiptap instance); this hook is for the History panel
 * that lists and restores past versions.
 */

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchVersions, restoreVersion } from "@/services/library/versions";
import type { LibraryBookVersionRow } from "@/lib/types/library-studio";

export function useVersionHistory(chapterId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: versions = [], isLoading } = useQuery({
    queryKey: queryKeys.library.studio.versions(chapterId ?? ""),
    queryFn: () => fetchVersions(chapterId!),
    enabled: !!chapterId,
  });

  const restore = useCallback(
    async (version: LibraryBookVersionRow) => {
      if (!user) return;
      try {
        await restoreVersion(version, user.id);
        if (chapterId) void queryClient.invalidateQueries({ queryKey: queryKeys.library.studio.versions(chapterId) });
        toast({ title: "Version restored" });
      } catch (err) {
        toast({ title: "Couldn't restore this version", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      }
    },
    [user, chapterId, queryClient]
  );

  const savedVersions = versions.filter((v) => !v.is_autosave);
  const autosaveVersions = versions.filter((v) => v.is_autosave);

  return { versions, savedVersions, autosaveVersions, isLoading, restore };
}
