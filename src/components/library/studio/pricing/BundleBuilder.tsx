import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchAuthorBundles, createBundle, setBundleActive } from "@/services/library/pricing";
import { fetchStudioBooks } from "@/services/library/studio";

interface BundleBuilderProps {
  authorId: string;
  /** Preselects the current book being edited into a new bundle. */
  currentBookId?: string;
}

export function BundleBuilder({ authorId, currentBookId }: BundleBuilderProps) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [priceUsd, setPriceUsd] = useState("");
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>(currentBookId ? [currentBookId] : []);
  const [isCreating, setIsCreating] = useState(false);

  const { data: bundles = [], isLoading } = useQuery({ queryKey: queryKeys.library.studio.bundles(authorId), queryFn: () => fetchAuthorBundles(authorId) });
  const { data: myBooks = [] } = useQuery({ queryKey: queryKeys.library.studio.books(authorId), queryFn: () => fetchStudioBooks(authorId) });
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: queryKeys.library.studio.bundles(authorId) });

  const toggleBook = (bookId: string) => {
    setSelectedBookIds((prev) => (prev.includes(bookId) ? prev.filter((id) => id !== bookId) : [...prev, bookId]));
  };

  const handleCreate = async () => {
    if (!title.trim() || selectedBookIds.length < 2) return;
    setIsCreating(true);
    try {
      await createBundle({ author_id: authorId, title: title.trim(), price_usd: priceUsd ? Number(priceUsd) : undefined, bookIds: selectedBookIds });
      setTitle("");
      setPriceUsd("");
      setSelectedBookIds([]);
      invalidate();
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">{t("library.studio.pricing.bundles")}</h3>

      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
      ) : bundles.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("library.studio.pricing.bundlesEmpty")}</p>
      ) : (
        <ul className="space-y-1.5">
          {bundles.map((bundle) => (
            <li key={bundle.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
              <div>
                <p className="font-medium">{bundle.title}</p>
                <p className="text-xs text-muted-foreground">{bundle.bookIds?.length ?? 0} {t("library.studio.pricing.booksIncluded")} — ${bundle.price_usd?.toFixed(2)}</p>
              </div>
              <Badge variant={bundle.is_active ? "default" : "outline"} className="cursor-pointer" onClick={() => void setBundleActive(bundle.id, !bundle.is_active).then(invalidate)}>
                {bundle.is_active ? t("library.studio.pricing.active") : t("library.studio.pricing.inactive")}
              </Badge>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2 rounded-md border p-2">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("library.studio.pricing.bundleTitle")} />
        <Input type="number" min="0" step="0.01" value={priceUsd} onChange={(e) => setPriceUsd(e.target.value)} placeholder={t("library.studio.pricing.priceUsd")} />
        <div className="flex flex-wrap gap-1.5">
          {myBooks.map((book) => (
            <Badge key={book.id} variant={selectedBookIds.includes(book.id) ? "default" : "outline"} className="cursor-pointer" onClick={() => toggleBook(book.id)}>
              {book.title}
            </Badge>
          ))}
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void handleCreate()} disabled={isCreating || !title.trim() || selectedBookIds.length < 2}>
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          {t("library.studio.pricing.createBundle")}
        </Button>
      </div>
    </div>
  );
}
