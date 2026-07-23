import { BookRail } from "@/components/library/BookRail";
import { useCollections, useCollectionBooks } from "@/hooks/library/useCollections";
import type { LibraryCollectionType, LibraryCollectionRow } from "@/lib/types/library-marketplace";

interface CollectionRailProps {
  type: LibraryCollectionType;
  isOnShelf?: (bookId: string) => boolean;
  onToggleShelf?: (bookId: string) => void;
}

/** Renders one BookRail per active collection of the given type (a curator
 *  can run several seasonal/curated collections at once, so this isn't
 *  always exactly one rail). Collections with no books yet render nothing —
 *  an empty curated rail on the home page would just be noise. */
export function CollectionRail({ type, isOnShelf, onToggleShelf }: CollectionRailProps) {
  const { collections, isLoading } = useCollections(type);
  if (isLoading || collections.length === 0) return null;

  return (
    <>
      {collections.map((collection) => (
        <CollectionBooksRail key={collection.id} collection={collection} isOnShelf={isOnShelf} onToggleShelf={onToggleShelf} />
      ))}
    </>
  );
}

function CollectionBooksRail({
  collection, isOnShelf, onToggleShelf,
}: { collection: LibraryCollectionRow; isOnShelf?: (bookId: string) => boolean; onToggleShelf?: (bookId: string) => void }) {
  const { books, isLoading } = useCollectionBooks(collection.id);
  if (!isLoading && books.length === 0) return null;

  return (
    <BookRail
      title={collection.title}
      books={books}
      isLoading={isLoading}
      viewAllHref={`/library/collections/${collection.slug}`}
      isOnShelf={isOnShelf}
      onToggleShelf={onToggleShelf}
      emptyTitle=""
    />
  );
}
