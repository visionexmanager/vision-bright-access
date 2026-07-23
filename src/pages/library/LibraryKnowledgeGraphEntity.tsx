import { useNavigate, useParams, Link } from "react-router-dom";
import { Network, BookOpen, Headphones, GraduationCap, Waypoints } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { SkeletonLoader } from "@/components/library/SkeletonLoader";
import { EmptyState } from "@/components/library/EmptyState";
import { Button } from "@/components/ui/button";
import { KnowledgeGraphRadial } from "@/components/library/knowledgeGraph/KnowledgeGraphRadial";
import { KgEntitySearchBox } from "@/components/library/knowledgeGraph/KgEntitySearchBox";
import { KG_ENTITY_TYPE_COLORS } from "@/components/library/knowledgeGraph/entityTypeStyles";
import { useKgEntity } from "@/hooks/library/useKgEntity";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";

export default function LibraryKnowledgeGraphEntity() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const { entity, connectedEntities, books, contentLinks, isLoading } = useKgEntity(slug);

  useDocumentHead({ title: entity ? `${entity.name} — ${t("library.knowledgeGraph.title")}` : t("library.knowledgeGraph.title") });

  const goToEntity = (nextSlug: string) => navigate(`/library/knowledge-graph/${nextSlug}`);

  return (
    <Layout>
      <LibraryLayout
        title={entity?.name ?? t("library.knowledgeGraph.title")}
        breadcrumb={[{ label: t("library.knowledgeGraph.title"), to: "/library/knowledge-graph" }, ...(entity ? [{ label: entity.name }] : [])]}
      >
        <div className="space-y-6">
          <KgEntitySearchBox onSelect={goToEntity} />

          {isLoading ? (
            <SkeletonLoader variant="detail" />
          ) : !entity ? (
            <EmptyState
              icon={<Network className="h-10 w-10" />}
              title={t("library.knowledgeGraph.entityNotFound")}
              description={t("library.knowledgeGraph.searchHint")}
            />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${KG_ENTITY_TYPE_COLORS[entity.entity_type].badge}`}>
                  {t(`library.knowledgeGraph.entityType.${entity.entity_type}`)}
                </span>
                {entity.description && <p className="text-sm text-muted-foreground">{entity.description}</p>}
                <Button asChild size="sm" variant="outline" className="ms-auto gap-1.5">
                  <Link to={`/library/knowledge-map/${entity.id}`}>
                    <Waypoints className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.knowledgeGraph.viewMap")}
                  </Link>
                </Button>
              </div>

              {connectedEntities.length === 0 ? (
                <EmptyState icon={<Network className="h-10 w-10" />} title={t("library.knowledgeGraph.noConnections")} />
              ) : (
                <div className="rounded-2xl border p-6">
                  <KnowledgeGraphRadial center={entity} connections={connectedEntities} onNavigate={goToEntity} />
                </div>
              )}

              <section aria-labelledby="kg-books-heading">
                <h2 id="kg-books-heading" className="mb-3 text-lg font-semibold">{t("library.knowledgeGraph.booksHeading")}</h2>
                {books.length === 0 ? (
                  <EmptyState icon={<BookOpen className="h-8 w-8" />} title={t("library.knowledgeGraph.noBooks")} className="py-8" />
                ) : (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5" role="list">
                    {books.map((book) => (
                      <Link key={book.id} to={`/library/books/${book.slug}`} role="listitem" className="group block">
                        <div className="aspect-[2/3] overflow-hidden rounded-lg bg-muted">
                          {book.cover_image_url && (
                            <img src={book.cover_image_url} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                          )}
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-sm font-medium">{book.title}</p>
                        <p className="text-xs text-muted-foreground">{book.author_name}</p>
                      </Link>
                    ))}
                  </div>
                )}
              </section>

              <section aria-labelledby="kg-content-heading">
                <h2 id="kg-content-heading" className="mb-3 text-lg font-semibold">{t("library.knowledgeGraph.linkedContent")}</h2>
                {contentLinks.length === 0 ? (
                  <EmptyState icon={<Headphones className="h-8 w-8" />} title={t("library.knowledgeGraph.noLinkedContent")} className="py-8" />
                ) : (
                  <ul className="flex flex-wrap gap-2" role="list">
                    {contentLinks.map((link) => (
                      <li key={`${link.contentType}-${link.contentId}`}>
                        <Link
                          to={link.contentType === "audiobook" ? `/library/audiobooks/${link.contentId}` : `/academy/courses/${link.contentId}`}
                          className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm hover:bg-muted"
                        >
                          {link.contentType === "audiobook" ? <Headphones className="h-3.5 w-3.5" aria-hidden="true" /> : <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />}
                          {t(`library.knowledgeGraph.contentType.${link.contentType}`)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </LibraryLayout>
    </Layout>
  );
}
