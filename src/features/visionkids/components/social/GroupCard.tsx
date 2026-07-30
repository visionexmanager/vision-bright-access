import { Link } from "react-router-dom";
import { Users } from "lucide-react";
import type { KidsSocialGroup } from "@/features/visionkids/types/social.types";

export function GroupCard({ group }: { group: KidsSocialGroup }) {
  return (
    <Link
      to={`/kids/social/clubs/detail/${group.slug}`}
      className="flex flex-col gap-2 rounded-2xl border-2 border-border bg-card p-4 transition-colors hover:border-kids-primary/50"
    >
      <div className="flex items-center gap-2">
        <span className="text-2xl" aria-hidden="true">{group.emoji}</span>
        <p className="font-heading font-bold">{group.name}</p>
      </div>
      {group.description && <p className="line-clamp-2 text-sm text-muted-foreground">{group.description}</p>}
      <p className="flex items-center gap-1 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" aria-hidden="true" /> {group.max_members}</p>
    </Link>
  );
}
