import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import { buildKnowledgeGraphForBook, fetchEntitiesForBook } from "@/services/library/knowledgeGraph";

export function useBuildKnowledgeGraph(bookId: string | undefined) {
  const queryClient = useQueryClient();
  const [isBuilding, setIsBuilding] = useState(false);

  const build = useCallback(async () => {
    if (!bookId) return;
    setIsBuilding(true);
    try {
      const { entitiesAdded, relationsAdded } = await buildKnowledgeGraphForBook(bookId);
      toast({ title: "Knowledge graph updated", description: `${entitiesAdded} entities, ${relationsAdded} relations.` });
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.kgEntitiesForBook(bookId) });
    } catch (err) {
      toast({ title: "Couldn't build knowledge graph", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setIsBuilding(false);
    }
  }, [bookId, queryClient]);

  return { build, isBuilding };
}

/** Entities already linked to a book (for a "This book connects to…" list on
 *  the Book Details page). */
export function useEntitiesForBook(bookId: string | undefined) {
  const { data: entities = [], isLoading } = useQuery({
    queryKey: queryKeys.library.kgEntitiesForBook(bookId ?? ""),
    queryFn: () => fetchEntitiesForBook(bookId!),
    enabled: !!bookId,
  });
  return { entities, isLoading };
}
