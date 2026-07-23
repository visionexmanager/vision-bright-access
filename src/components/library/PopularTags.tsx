import { Link } from "react-router-dom";
import { Tag } from "lucide-react";
import { usePopularTags } from "@/hooks/library/usePopularTags";
import { useLanguage } from "@/contexts/LanguageContext";

export function PopularTags() {
  const { t } = useLanguage();
  const { tags, isLoading } = usePopularTags();

  if (isLoading || tags.length === 0) return null;

  return (
    <section aria-labelledby="popular-tags-heading">
      <h2 id="popular-tags-heading" className="mb-3 text-sm font-semibold">{t("library.explorer.popularTags")}</h2>
      <div className="flex flex-wrap gap-2" role="list">
        {tags.map((tag) => (
          <Link
            key={tag.tag_id}
            to={`/library/books?tag=${tag.slug}`}
            role="listitem"
            className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Tag className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
            {tag.name}
            <span className="text-muted-foreground">({tag.usage_count})</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
