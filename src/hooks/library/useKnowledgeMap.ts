import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchKnowledgeMap } from "@/services/library/knowledgeGraph";

export function useKnowledgeMap(rootEntityId: string | undefined, maxDepth = 2) {
  const { data: nodes = [], isLoading } = useQuery({
    queryKey: queryKeys.library.knowledgeMap(rootEntityId ?? ""),
    queryFn: () => fetchKnowledgeMap(rootEntityId!, maxDepth),
    enabled: !!rootEntityId,
  });

  const byDepth = new Map<number, typeof nodes>();
  for (const node of nodes) {
    const list = byDepth.get(node.depth) ?? [];
    list.push(node);
    byDepth.set(node.depth, list);
  }

  return { nodes, byDepth, isLoading };
}
