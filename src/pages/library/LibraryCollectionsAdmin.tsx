import { useState } from "react";
import { Plus, Trash2, Search, X, ArrowUp, ArrowDown, Layers } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/library/EmptyState";
import { SkeletonLoader } from "@/components/library/SkeletonLoader";
import { useCollectionsAdmin, useCollectionBooksAdmin } from "@/hooks/library/useCollectionsAdmin";
import { useCollectionBooks } from "@/hooks/library/useCollections";
import { fetchCatalog } from "@/services/library/catalog";
import { useLanguage } from "@/contexts/LanguageContext";
import type { LibraryCollectionType, LibraryCollectionRow } from "@/lib/types/library-marketplace";
import type { LibraryBookRow } from "@/lib/types/library-book";

const COLLECTION_TYPES: LibraryCollectionType[] = ["editors_choice", "staff_pick", "award_winner", "seasonal", "curated"];

function slugify(input: string): string {
  return input.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "collection";
}

function CollectionBooksManager({ collection }: { collection: LibraryCollectionRow }) {
  const { t } = useLanguage();
  const { books } = useCollectionBooks(collection.id);
  const { addBook, removeBook, reorder } = useCollectionBooksAdmin(collection.id);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LibraryBookRow[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const runSearch = async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    try {
      setResults(await fetchCatalog({ query: query.trim(), limit: 8 }));
    } finally {
      setIsSearching(false);
    }
  };

  const move = (index: number, direction: -1 | 1) => {
    const ids = books.map((b) => b.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    void reorder(ids);
  };

  return (
    <div className="space-y-3 border-t pt-3">
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void runSearch()}
          placeholder={t("library.collectionsAdmin.searchBooksPlaceholder")}
        />
        <Button variant="outline" size="icon" onClick={() => void runSearch()} disabled={isSearching} aria-label={t("library.aiSearch.search")}>
          <Search className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      {results.length > 0 && (
        <ul className="space-y-1">
          {results.map((book) => (
            <li key={book.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
              <span className="truncate">{book.title} — {book.author_name}</span>
              <Button size="sm" variant="outline" onClick={() => void addBook(book.id, books.length)}>{t("library.collectionsAdmin.addBook")}</Button>
            </li>
          ))}
        </ul>
      )}
      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t("library.collectionsAdmin.currentBooks")} ({books.length})</p>
        <ul className="space-y-1">
          {books.map((book, index) => (
            <li key={book.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
              <span className="truncate">{book.title}</span>
              <div className="flex shrink-0 gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7" disabled={index === 0} onClick={() => move(index, -1)} aria-label={t("library.collectionsAdmin.moveUp")}><ArrowUp className="h-3.5 w-3.5" aria-hidden="true" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" disabled={index === books.length - 1} onClick={() => move(index, 1)} aria-label={t("library.collectionsAdmin.moveDown")}><ArrowDown className="h-3.5 w-3.5" aria-hidden="true" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => void removeBook(book.id)} aria-label={t("library.researchAssistant.remove")}><X className="h-3.5 w-3.5" aria-hidden="true" /></Button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function LibraryCollectionsAdmin() {
  const { t } = useLanguage();
  const { collections, isLoading, create, update, remove } = useCollectionsAdmin();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<LibraryCollectionType>("curated");
  const [description, setDescription] = useState("");

  const handleCreate = async () => {
    if (!title.trim()) return;
    await create({ title: title.trim(), slug: slugify(title), collection_type: type, description: description.trim() || null, is_active: true });
    setTitle("");
    setDescription("");
    setOpen(false);
  };

  return (
    <Layout>
      <LibraryLayout
        title={t("library.collectionsAdmin.title")}
        breadcrumb={[{ label: t("library.collectionsAdmin.title") }]}
        headerActions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" aria-hidden="true" /> {t("library.collectionsAdmin.create")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("library.collectionsAdmin.createTitle")}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="collection-title">{t("library.collectionsAdmin.titleLabel")}</Label>
                  <Input id="collection-title" value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="collection-type">{t("library.collectionsAdmin.typeLabel")}</Label>
                  <Select value={type} onValueChange={(v) => setType(v as LibraryCollectionType)}>
                    <SelectTrigger id="collection-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COLLECTION_TYPES.map((ct) => <SelectItem key={ct} value={ct}>{t(`library.collectionsAdmin.type.${ct}`)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="collection-description">{t("library.collectionsAdmin.descriptionLabel")}</Label>
                  <Input id="collection-description" value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => void handleCreate()}>{t("library.collectionsAdmin.create")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      >
        {isLoading ? (
          <SkeletonLoader variant="list" count={3} />
        ) : collections.length === 0 ? (
          <EmptyState icon={<Layers className="h-10 w-10" />} title={t("library.collectionsAdmin.empty")} />
        ) : (
          <div className="space-y-3">
            {collections.map((collection) => (
              <Card key={collection.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <button className="text-start font-semibold hover:underline" onClick={() => setExpandedId(expandedId === collection.id ? null : collection.id)}>
                      {collection.title}
                    </button>
                    <div className="mt-1 flex gap-1.5">
                      <Badge variant="outline">{t(`library.collectionsAdmin.type.${collection.collection_type}`)}</Badge>
                      {!collection.is_active && <Badge variant="secondary">{t("library.collectionsAdmin.inactive")}</Badge>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <Switch checked={collection.is_active} onCheckedChange={(checked) => void update(collection.id, { is_active: checked })} />
                      <span className="text-xs text-muted-foreground">{t("library.collectionsAdmin.active")}</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => void remove(collection.id)} aria-label={t("library.reviews.delete")}><Trash2 className="h-4 w-4" aria-hidden="true" /></Button>
                  </div>
                </div>
                {expandedId === collection.id && <CollectionBooksManager collection={collection} />}
              </Card>
            ))}
          </div>
        )}
      </LibraryLayout>
    </Layout>
  );
}
