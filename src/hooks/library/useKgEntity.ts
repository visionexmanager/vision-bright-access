import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/queryKeys";
import {
  fetchEntityBySlug, fetchConnectedEntities, fetchBooksForEntity, searchEntities,
  fetchContentLinksForEntity,
} from "@/services/library/knowledgeGraph";

/** One knowledge-graph entity's detail view (doubles as the "Concept
 *  Explorer": definition, related books/courses, historical context via
 *  connected historical_event entities, visual graph, and recommended
 *  reading) — itself, the entities it's connected to, the books that
 *  mention it, and any linked non-book content (audiobooks/Academy
 *  courses) — everything the visual navigator needs to render one "hop"
 *  and let the viewer click onward. */
export function useKgEntity(slug: string | undefined) {
  const { data: entity, isLoading: isLoadingEntity } = useQuery({
    queryKey: queryKeys.library.kgEntity(slug ?? ""),
    queryFn: () => fetchEntityBySlug(slug!),
    enabled: !!slug,
  });

  const { data: connectedEntities = [], isLoading: isLoadingConnections } = useQuery({
    queryKey: queryKeys.library.kgConnectedEntities(entity?.id ?? ""),
    queryFn: () => fetchConnectedEntities(entity!.id),
    enabled: !!entity,
  });

  const { data: books = [], isLoading: isLoadingBooks } = useQuery({
    queryKey: queryKeys.library.kgBooksForEntity(entity?.id ?? ""),
    queryFn: () => fetchBooksForEntity(entity!.id),
    enabled: !!entity,
  });

  const { data: contentLinks = [] } = useQuery({
    queryKey: queryKeys.library.kgContentLinks(entity?.id ?? ""),
    queryFn: () => fetchContentLinksForEntity(entity!.id),
    enabled: !!entity,
  });

  return {
    entity: entity ?? null,
    connectedEntities,
    books,
    contentLinks,
    isLoading: isLoadingEntity || isLoadingConnections || isLoadingBooks,
  };
}

export function useEntitySearch(query: string) {
  const { data: results = [], isLoading } = useQuery({
    queryKey: queryKeys.library.kgEntitySearch(query),
    queryFn: () => searchEntities(query),
    enabled: query.trim().length >= 2,
  });
  return { results, isLoading };
}
