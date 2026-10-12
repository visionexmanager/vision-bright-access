import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { fetchShelf } from "@/features/visionkids/services/ops/approvedResources";
import { APPROVED_SOURCES, addressAllowed, sourceById } from "@/features/visionkids/data/approvedSources";

/**
 * Resources an administrator approved, each for an age range and a subject.
 * Renders nothing when there are none (no account, source switched off, or
 * nothing approved), so it never shows an empty shelf. Every link is checked
 * again here against its source's hosts before it is rendered, and opens on the
 * provider's own site: nothing is embedded or run inside VisionKids.
 */
export function ApprovedResourcesShelf() {
  const { t } = useLanguage();
  const { data = [] } = useQuery({ queryKey: ["kids", "approved-shelf"], queryFn: fetchShelf, staleTime: 5 * 60_000, retry: false });
  const rows = data.filter((r) => {
    const source = sourceById(r.source);
    return source && APPROVED_SOURCES.includes(source) && addressAllowed(source, r.url);
  });
  if (rows.length === 0) return null;

  return (
    <section className="px-4 py-8 sm:px-6" aria-labelledby="kids-shelf-heading">
      <div className="mx-auto max-w-6xl">
        <h2 id="kids-shelf-heading" className="font-heading text-2xl font-bold">{t("kids.sources.title")}</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-col rounded-2xl border-2 border-border bg-card p-4">
              <a href={r.url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-start gap-1.5 font-heading font-bold leading-tight underline-offset-4 hover:underline">
                <span>{r.title}</span>
                <ExternalLink className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="sr-only">{t("kids.sources.opens")}</span>
              </a>
              {r.summary && <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{r.summary}</p>}
              <p className="mt-auto pt-2 text-xs text-muted-foreground">
                {t("kids.sources.ages")} {r.age_min}–{r.age_max} · {r.attribution} · {r.license_name}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
