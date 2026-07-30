import { Link } from "react-router-dom";
import type { ExplorerLocation } from "@/features/visionkids/types/explorer.types";

export function LocationCard({ worldSlug, location }: { worldSlug: string; location: ExplorerLocation }) {
  return (
    <Link
      to={`/kids/explorer/world/${worldSlug}/${location.slug}`}
      className="flex flex-col items-center gap-2 rounded-2xl border-2 border-border bg-card p-4 text-center transition-colors hover:border-kids-primary/50"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-3xl">
        {location.image_url ? (
          <img src={location.image_url} alt="" className="h-16 w-16 rounded-full object-cover" loading="lazy" />
        ) : (
          <span aria-hidden="true">{location.emoji}</span>
        )}
      </div>
      <p className="font-heading text-sm font-bold">{location.name}</p>
      {location.summary && <p className="line-clamp-2 text-xs text-muted-foreground">{location.summary}</p>}
    </Link>
  );
}
