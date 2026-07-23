import { useParams, Link } from "react-router-dom";
import { Waypoints, Lock, Unlock } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { SkeletonLoader } from "@/components/library/SkeletonLoader";
import { EmptyState } from "@/components/library/EmptyState";
import { Badge } from "@/components/ui/badge";
import { KG_ENTITY_TYPE_COLORS } from "@/components/library/knowledgeGraph/entityTypeStyles";
import { useKnowledgeMap } from "@/hooks/library/useKnowledgeMap";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { cn } from "@/lib/utils";

export default function LibraryKnowledgeMap() {
  const { entityId } = useParams<{ entityId: string }>();
  const { t } = useLanguage();
  const { byDepth, isLoading } = useKnowledgeMap(entityId);

  const rootName = [...byDepth.values()].flat().find((n) => n.depth === 0)?.name;

  useDocumentHead({ title: rootName ? `${rootName} — ${t("library.knowledgeMap.title")}` : t("library.knowledgeMap.title") });

  const depths = [...byDepth.keys()].sort((a, b) => a - b);

  return (
    <Layout>
      <LibraryLayout
        title={rootName ?? t("library.knowledgeMap.title")}
        breadcrumb={[{ label: t("library.knowledgeGraph.title"), to: "/library/knowledge-graph" }, { label: t("library.knowledgeMap.title") }]}
      >
        {isLoading ? (
          <SkeletonLoader variant="list" count={3} />
        ) : depths.length === 0 ? (
          <EmptyState icon={<Waypoints className="h-8 w-8" />} title={t("library.knowledgeMap.empty")} className="py-12" />
        ) : (
          <div className="space-y-8">
            {depths.map((depth) => (
              <div key={depth}>
                <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{t("library.knowledgeMap.levelLabel").replace("{depth}", String(depth))}</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {(byDepth.get(depth) ?? []).map((node) => (
                    <Link
                      key={node.entity_id}
                      to={node.slug ? `/library/knowledge-graph/${node.slug}` : "#"}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-lg border p-3 transition-colors hover:bg-muted",
                        !node.is_unlocked && "opacity-60",
                      )}
                    >
                      <div>
                        <p className="font-medium">{node.name}</p>
                        <Badge variant="secondary" className={cn("mt-1 text-xs", KG_ENTITY_TYPE_COLORS[node.entity_type]?.badge)}>
                          {t(`library.knowledgeGraph.entityType.${node.entity_type}`)}
                        </Badge>
                      </div>
                      {node.is_unlocked ? (
                        <Unlock className="h-4 w-4 shrink-0 text-primary" aria-label={t("library.knowledgeMap.unlocked")} />
                      ) : (
                        <Lock className="h-4 w-4 shrink-0 text-muted-foreground" aria-label={t("library.knowledgeMap.locked")} />
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </LibraryLayout>
    </Layout>
  );
}
