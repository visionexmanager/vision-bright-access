import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, Loader2, BookOpen, Network, Bookmark, Clock, X } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/library/EmptyState";
import { VoiceSearchButton } from "@/components/library/marketplace/VoiceSearchButton";
import { KG_ENTITY_TYPE_COLORS } from "@/components/library/knowledgeGraph/entityTypeStyles";
import { useAiSearch, useSavedSearches, useSearchHistory } from "@/hooks/library/useAiSearch";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";

export default function LibraryAiSearch() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { query, isSearching, intent, synonyms, books, entities, search } = useAiSearch();
  const { savedSearches, save, remove } = useSavedSearches();
  const { history } = useSearchHistory();
  const [input, setInput] = useState("");

  useDocumentHead({ title: t("library.aiSearch.title") });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void search(input);
  };

  const hasResults = books.length > 0 || entities.length > 0;

  return (
    <Layout>
      <LibraryLayout title={t("library.aiSearch.title")} breadcrumb={[{ label: t("library.aiSearch.title") }]}>
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <div className="space-y-4">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder={t("library.aiSearch.placeholder")} className="flex-1" />
              <VoiceSearchButton onResult={(transcript) => { setInput(transcript); void search(transcript); }} />
              <Button type="submit" disabled={isSearching || !input.trim()} className="gap-1.5">
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
                {t("library.aiSearch.search")}
              </Button>
            </form>

            {query && (
              <div className="flex flex-wrap items-center gap-2">
                {intent && <Badge variant="secondary">{t(`library.aiSearch.intent.${intent}`)}</Badge>}
                {user && (
                  <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => void save(query, query)}>
                    <Bookmark className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.aiSearch.saveSearch")}
                  </Button>
                )}
              </div>
            )}

            {synonyms.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">{t("library.aiSearch.relatedTerms")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {synonyms.map((s) => (
                    <Button key={s} type="button" variant="outline" size="sm" onClick={() => { setInput(s); void search(s); }}>{s}</Button>
                  ))}
                </div>
              </div>
            )}

            {query && !isSearching && !hasResults && (
              <EmptyState icon={<Sparkles className="h-8 w-8" />} title={t("library.aiSearch.noResults")} className="py-8" />
            )}

            {books.length > 0 && (
              <section>
                <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><BookOpen className="h-4 w-4" aria-hidden="true" /> {t("library.aiSearch.books")}</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {books.map((book) => (
                    <Link key={book.id} to={`/library/books/${book.slug}`}>
                      <Card className="flex items-center gap-3 p-3 hover:shadow-md">
                        {book.cover_image_url && <img src={book.cover_image_url} alt="" className="h-16 w-11 rounded object-cover" />}
                        <div>
                          <p className="line-clamp-1 text-sm font-medium">{book.title}</p>
                          <p className="text-xs text-muted-foreground">{book.author_name}</p>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {entities.length > 0 && (
              <section>
                <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Network className="h-4 w-4" aria-hidden="true" /> {t("library.aiSearch.topics")}</h2>
                <div className="flex flex-wrap gap-1.5">
                  {entities.map((entity) => (
                    <Link key={entity.id} to={`/library/knowledge-graph/${entity.slug}`} className={`rounded-full px-2.5 py-1 text-xs font-medium ${KG_ENTITY_TYPE_COLORS[entity.entity_type]?.badge}`}>
                      {entity.name}
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>

          <div className="space-y-6">
            <div>
              <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Bookmark className="h-4 w-4" aria-hidden="true" /> {t("library.aiSearch.savedSearches")}</h2>
              {savedSearches.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("library.aiSearch.noSavedSearches")}</p>
              ) : (
                <ul className="space-y-1">
                  {savedSearches.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-1 text-sm">
                      <button type="button" className="truncate text-start hover:underline" onClick={() => { setInput(s.query); void search(s.query); }}>{s.name}</button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => void remove(s.id)} aria-label={t("library.reviews.delete")}>
                        <X className="h-3 w-3" aria-hidden="true" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {history.length > 0 && (
              <div>
                <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Clock className="h-4 w-4" aria-hidden="true" /> {t("library.aiSearch.recentSearches")}</h2>
                <ul className="space-y-1">
                  {history.map((h) => (
                    <li key={h.id}>
                      <button type="button" className="truncate text-start text-sm hover:underline" onClick={() => { setInput(h.query); void search(h.query); }}>{h.query}</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </LibraryLayout>
    </Layout>
  );
}
