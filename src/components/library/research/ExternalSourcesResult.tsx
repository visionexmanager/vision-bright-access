import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Plus, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "@/hooks/use-toast";
import { useResearchProjects } from "@/hooks/library/useResearchProjects";
import { addProjectItem } from "@/services/library/researchProjects";
import type { LibraryExternalReference, LibraryExternalSourcesResult } from "@/services/library/researchAssistant";

/**
 * References from OpenAlex, Open Library and Wikipedia — records those
 * catalogues returned, never a model's answer — each one a link to the source
 * and one click from a research project, where it lands as a `reference` item
 * carrying its citation.
 */
export function ExternalSourcesResult({ result }: { result: LibraryExternalSourcesResult }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { projects } = useResearchProjects();
  const [projectId, setProjectId] = useState("");
  const [added, setAdded] = useState<ReadonlySet<string>>(new Set());
  const [adding, setAdding] = useState<string | null>(null);
  const projectLabelId = useId();

  const silent = (Object.entries(result.sources) as Array<[LibraryExternalReference["source"], string]>)
    .filter(([, status]) => status !== "ok")
    .map(([source]) => t(`library.researchAssistant.external.source.${source}`));

  const add = async (ref: LibraryExternalReference) => {
    if (!user || !projectId) return;
    setAdding(ref.url);
    try {
      await addProjectItem(projectId, user.id, { itemType: "reference", citationText: ref.citation });
      setAdded((prev) => new Set(prev).add(ref.url));
      toast({ title: t("library.researchAssistant.external.addedToast") });
    } catch (err) {
      toast({
        title: t("library.researchAssistant.external.addFailed"),
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setAdding(null);
    }
  };

  return (
    <section className="space-y-3" aria-label={t("library.researchAssistant.external.results")}>
      {silent.length > 0 && (
        <p role="status" className="text-xs text-muted-foreground">
          {t("library.researchAssistant.external.unavailable").replace("{sources}", silent.join(", "))}
        </p>
      )}

      {projects.length > 0 ? (
        <div className="max-w-sm">
          <label id={projectLabelId} className="mb-1.5 block text-sm font-medium">
            {t("library.researchAssistant.external.chooseProject")}
          </label>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger aria-labelledby={projectLabelId}><SelectValue /></SelectTrigger>
            <SelectContent>
              {projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          <Link to="/library/research-projects" className="underline underline-offset-2">
            {t("library.researchAssistant.external.noProjects")}
          </Link>
        </p>
      )}

      {result.references.length === 0 ? (
        <p role="status" className="text-sm text-muted-foreground">{t("library.researchAssistant.external.none")}</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {result.references.map((ref) => {
            const isAdded = added.has(ref.url);
            const meta = [ref.authors.slice(0, 3).join(", "), ref.year].filter(Boolean).join(" · ");
            return (
              <li key={ref.url}>
                <Card className="flex h-full flex-col gap-2 p-3">
                  <a
                    href={ref.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    dir="auto"
                    className="inline-flex items-start gap-1 text-sm font-medium hover:underline"
                  >
                    <span className="line-clamp-2">{ref.title}</span>
                    <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="sr-only">({t("library.researchAssistant.external.opensInNewTab")})</span>
                  </a>
                  {meta && <p dir="auto" className="text-xs text-muted-foreground">{meta}</p>}
                  {ref.snippet && <p dir="auto" className="line-clamp-3 text-xs">{ref.snippet}</p>}
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline">{t(`library.researchAssistant.external.source.${ref.source}`)}</Badge>
                    {ref.openAccess && ref.source !== "wikipedia" && (
                      <Badge variant="secondary">{t("library.researchAssistant.external.openAccess")}</Badge>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-auto gap-1.5 self-start"
                    disabled={!projectId || isAdded || adding === ref.url}
                    aria-label={`${isAdded ? t("library.researchAssistant.external.added") : t("library.researchAssistant.external.addToProject")}: ${ref.title}`}
                    onClick={() => void add(ref)}
                  >
                    {isAdded ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Plus className="h-3.5 w-3.5" aria-hidden="true" />}
                    {isAdded ? t("library.researchAssistant.external.added") : t("library.researchAssistant.external.addToProject")}
                  </Button>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
