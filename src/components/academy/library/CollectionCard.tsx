import { Library } from "lucide-react";
import type { AcademyResourceCollectionRow } from "@/lib/types/academy-library";

interface CollectionCardProps {
  collection: AcademyResourceCollectionRow;
  onClick?: () => void;
}

export function CollectionCard({ collection, onClick }: CollectionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-start w-full p-5 rounded-2xl border border-border bg-muted/30 hover:border-primary hover:bg-primary/5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="p-2.5 bg-primary/10 text-primary rounded-xl inline-flex mb-3" aria-hidden="true">
        <Library className="w-5 h-5" />
      </div>
      <h3 className="font-bold text-foreground text-sm mb-1">{collection.title}</h3>
      {collection.description && <p className="text-xs text-muted-foreground line-clamp-2">{collection.description}</p>}
      <p className="text-xs text-muted-foreground mt-2">{collection.resource_ids.length} مورد</p>
    </button>
  );
}
