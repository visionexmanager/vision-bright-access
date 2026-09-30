import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Loader2, Search } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExternalContentCard } from "@/components/library/external/ExternalContentCard";
import { ExternalContentPreviewDialog } from "@/components/library/external/ExternalContentPreviewDialog";
import { YouTubeSearchPanel } from "@/components/library/external/YouTubeSearchPanel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "@/hooks/use-toast";
import { useResearchProjects } from "@/hooks/library/useResearchProjects";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { addProjectItem } from "@/services/library/researchProjects";
import {
  CONTENT_CATEGORIES, citationFor, SaveExternalItemError, fetchExternalProviders, fetchSavedExternalItems, saveExternalItem, searchExternalContent, unsaveExternalItem,
  type ContentCategory, type ExternalContentItem, type ProviderRun, type ProviderSummary,
} from "@/services/library/externalContent";

const PER_PROVIDER = 6;

/**
 * Open Sources — free images, audio, video, books, documents and open data
 * from public libraries, museums and archives, searched through one box.
 * Results are links and players, never copies: each says where it comes
 * from, what licence it carries, and how to credit it.
 */
export default function LibraryOpenSources() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const { projects } = useResearchProjects();
  useDocumentHead({ title: t("library.openSources.title") });
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [category, setCategory] = useState<ContentCategory | "">(() => {
    const c = params.get("type");
    return c && (CONTENT_CATEGORIES as readonly string[]).includes(c) ? c as ContentCategory : "";
  });
  const [items, setItems] = useState<ExternalContentItem[]>([]);
  const [runs, setRuns] = useState<ProviderRun[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "loadingMore" | "done" | "error">("idle");
  const [preview, setPreview] = useState<ExternalContentItem | null>(null);
  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  // My Library: what the reader has kept, and the one save/remove in flight.
  const [view, setView] = useState<"search" | "saved">(() => (params.get("view") === "saved" ? "saved" : "search"));
  const [source, setSource] = useState<"all" | "youtube">(() => (params.get("source") === "youtube" ? "youtube" : "all"));
  const sourceId = useId();
  const [saved, setSaved] = useState<ExternalContentItem[]>([]);
  const [savedLoaded, setSavedLoaded] = useState(false);
  const [pendingSave, setPendingSave] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState("");
  // Research projects: the chosen one, what has gone into it this visit, and the one add in flight.
  const [projectId, setProjectId] = useState("");
  const [inProject, setInProject] = useState<ReadonlySet<string>>(new Set());
  const [addingToProject, setAddingToProject] = useState<string | null>(null);
  const projectSelectId = useId();
  const savedHeadingId = useId();
  // Where focus goes when the card a reader just removed disappears from the saved list.
  const savedHeadings = useRef<Array<HTMLHeadingElement | null>>([]);
  const emptySavedRef = useRef<HTMLParagraphElement | null>(null);
  const pendingFocus = useRef<number | null>(null);
  const firstNewRef = useRef<HTMLHeadingElement | null>(null);
  const focusIndex = useRef<number | null>(null);
  const queryId = useId();
  const typeId = useId();
  const resultsHeadingId = useId();

  useEffect(() => {
    fetchSavedExternalItems().then((rows) => { setSaved(rows); setSavedLoaded(true); }).catch(() => setSavedLoaded(true));
  }, []);

  useEffect(() => {
    fetchExternalProviders().then((r) => setProviders(r.providers)).catch(() => setProviders([]));
  }, []);

  const run = async (nextPage: number, q: string, c: ContentCategory | "") => {
    setStatus(nextPage === 1 ? "loading" : "loadingMore");
    try {
      const result = await searchExternalContent({
        query: q, categories: c ? [c] : [], language: lang, page: nextPage, limit: PER_PROVIDER,
      });
      if (nextPage === 1) {
        setItems(result.items);
        focusIndex.current = null;
      } else {
        focusIndex.current = items.length;
        const seen = new Set(items.map((i) => i.id));
        setItems([...items, ...result.items.filter((i) => !seen.has(i.id))]);
      }
      setRuns(result.providers);
      setPage(nextPage);
      setHasMore(result.providers.some((p) => p.count >= PER_PROVIDER));
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };

  // After "Load more", move focus to the first new result so keyboard and
  // screen-reader users continue where the list grew.
  useEffect(() => {
    if (focusIndex.current !== null && firstNewRef.current) {
      firstNewRef.current.focus();
      focusIndex.current = null;
    }
  }, [items]);

  useEffect(() => {
    if (pendingFocus.current === null || view !== "saved") return;
    const target = Math.min(pendingFocus.current, saved.length - 1);
    pendingFocus.current = null;
    if (target < 0) emptySavedRef.current?.focus();
    else savedHeadings.current[target]?.focus();
  }, [saved, view]);

  useEffect(() => {
    const q = params.get("q");
    if (q && q.trim().length >= 2) void run(1, q.trim(), category);
    // Only the query in the URL on first load starts a search by itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;
    setView("search");
    setSaveMessage("");
    setParams(category ? { q, type: category } : { q }, { replace: true });
    void run(1, q, category);
  };

  const savedIds = new Set(saved.map((i) => i.id));

  /** Clears the live region and sets it a moment later, so an identical message is announced again. */
  const announce = (text: string) => {
    setSaveMessage("");
    window.setTimeout(() => setSaveMessage(text), 60);
  };

  /** One button for both directions; the outcome is announced in words, never by colour alone. */
  const toggleSave = async (item: ExternalContentItem) => {
    if (pendingSave) return;
    setPendingSave(item.id);
    try {
      if (savedIds.has(item.id)) {
        await unsaveExternalItem(item.id);
        if (view === "saved") pendingFocus.current = saved.findIndex((r) => r.id === item.id);
        setSaved((rows) => rows.filter((r) => r.id !== item.id));
        announce(t("library.openSources.removedStatus").replace("{title}", item.title));
      } else {
        await saveExternalItem(item);
        setSaved((rows) => [item, ...rows.filter((r) => r.id !== item.id)]);
        announce(t("library.openSources.savedStatus").replace("{title}", item.title));
      }
    } catch (err) {
      announce(t(err instanceof SaveExternalItemError && err.code === "subscription_required" ? "library.openSources.saveNeedsPlan" : "library.openSources.saveFailed"));
    } finally {
      setPendingSave(null);
    }
  };

  /** The item goes into the chosen project as a reference with its citation, like the assistant's own references. */
  const addToProject = async (item: ExternalContentItem) => {
    if (!user || !projectId || addingToProject) return;
    setAddingToProject(item.id);
    try {
      await addProjectItem(projectId, user.id, { itemType: "reference", citationText: citationFor(item) });
      setInProject((prev) => new Set(prev).add(`${projectId}|${item.id}`));
      toast({ title: t("library.researchAssistant.external.addedToast") });
      announce(t("library.researchAssistant.external.addedToast"));
    } catch (err) {
      toast({ title: t("library.researchAssistant.external.addFailed"), description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      announce(t("library.researchAssistant.external.addFailed"));
    } finally {
      setAddingToProject(null);
    }
  };

  const projectActionFor = (item: ExternalContentItem) => (projects.length > 0
    ? { added: inProject.has(`${projectId}|${item.id}`), pending: addingToProject === item.id, disabled: !projectId, onAdd: (i: ExternalContentItem) => void addToProject(i) }
    : undefined);

  const changeSource = (next: "all" | "youtube") => {
    setSource(next);
    setSaveMessage("");
    const q = params.get("q");
    const type = params.get("type");
    setParams({ ...(next === "all" && q ? { q } : {}), ...(next === "all" && type ? { type } : {}), ...(next === "youtube" ? { source: "youtube" } : {}) }, { replace: true });
  };

  const renderYouTubeCard = (item: ExternalContentItem, ref?: (el: HTMLHeadingElement | null) => void) => (
    <ExternalContentCard
      ref={ref}
      item={item}
      onPreview={setPreview}
      saved={savedIds.has(item.id)}
      savePending={pendingSave === item.id}
      onToggleSave={(i) => void toggleSave(i)}
      saveKeys={{ save: "library.youtube.addToLibrary", saved: "library.youtube.inLibrary" }}
      projectAction={projectActionFor(item)}
    />
  );

  const showView = (next: "search" | "saved") => {
    setView(next);
    setSaveMessage("");
    const q = params.get("q");
    const type = params.get("type");
    setParams({ ...(q ? { q } : {}), ...(type ? { type } : {}), ...(source === "youtube" ? { source: "youtube" } : {}), ...(next === "saved" ? { view: "saved" } : {}) }, { replace: true });
  };

  const nameOf = (id: string) => providers.find((p) => p.id === id)?.name ?? id;
  const failed = runs.filter((r) => !["ok", "empty", "skipped"].includes(r.state)).map((r) => nameOf(r.provider));
  const answered = runs.filter((r) => r.count > 0).length;
  const ready = providers.filter((p) => p.status === "ready");
  const busy = status === "loading" || status === "loadingMore";

  const summary = status === "loading"
    ? t("library.openSources.searching")
    : status === "error"
      ? t("library.openSources.error")
      : status === "done"
        ? items.length === 0
          ? t("library.openSources.noResults")
          : t("library.openSources.resultsSummary").replace("{count}", String(items.length)).replace("{sources}", String(answered))
        : "";

  return (
    <Layout>
      <LibraryLayout title={t("library.openSources.title")} breadcrumb={[{ label: t("library.openSources.title") }]}>
        <p className="mb-4 max-w-3xl text-sm text-muted-foreground">{t("library.openSources.intro")}</p>

        <div role="group" aria-label={t("library.openSources.title")} className="mb-4 flex gap-2">
          <Button type="button" size="sm" variant={view === "search" ? "default" : "outline"} aria-pressed={view === "search"} onClick={() => showView("search")}>
            {t("library.openSources.tab.search")}
          </Button>
          <Button type="button" size="sm" variant={view === "saved" ? "default" : "outline"} aria-pressed={view === "saved"} onClick={() => showView("saved")}>
            {t("library.openSources.tab.saved")}{savedLoaded ? ` (${saved.length})` : ""}
          </Button>
        </div>
        <p role="status" aria-live="polite" className="mb-2 min-h-5 text-sm">{saveMessage}</p>

        {projects.length > 0 ? (
          <div className="mb-4 max-w-sm">
            <label htmlFor={projectSelectId} className="mb-1.5 block text-sm font-medium">{t("library.researchAssistant.external.chooseProject")}</label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger id={projectSelectId}><SelectValue placeholder={t("library.openSources.projectPlaceholder")} /></SelectTrigger>
              <SelectContent>
                {projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <p className="mb-4 text-sm text-muted-foreground">
            <Link to="/library/research-projects" className="underline underline-offset-2">{t("library.researchAssistant.external.noProjects")}</Link>
          </p>
        )}

        {view === "saved" && (
          <section aria-labelledby={savedHeadingId} className="mb-8">
            <h2 id={savedHeadingId} className="sr-only">{t("library.openSources.tab.saved")}</h2>
            {savedLoaded && saved.length === 0 ? (
              <p ref={emptySavedRef} tabIndex={-1} className="text-sm text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">{t("library.openSources.savedEmpty")}</p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {saved.map((item, index) => (
                  <li key={item.id}>
                    <ExternalContentCard ref={(el) => { savedHeadings.current[index] = el; }} item={item} onPreview={setPreview} saved savePending={pendingSave === item.id} onToggleSave={(i) => void toggleSave(i)} projectAction={projectActionFor(item)} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}


        {view === "search" && (
          <div className="mb-4 max-w-xs">
            <label htmlFor={sourceId} className="mb-1.5 block text-sm font-medium">{t("library.openSources.sourceLabel")}</label>
            <select id={sourceId} value={source} onChange={(e) => changeSource(e.target.value as "all" | "youtube")}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="all">{t("library.openSources.sourceAll")}</option>
              <option value="youtube">{t("library.youtube.name")}</option>
            </select>
          </div>
        )}

        {view === "search" && source === "youtube" && <YouTubeSearchPanel renderCard={renderYouTubeCard} />}

        {view === "search" && source === "all" && (<>
        <form role="search" onSubmit={submit} className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor={queryId} className="mb-1.5 block text-sm font-medium">{t("library.openSources.searchLabel")}</label>
            <Input
              id={queryId}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("library.openSources.searchPlaceholder")}
              maxLength={200}
              minLength={2}
              required
              dir="auto"
              autoComplete="off"
            />
          </div>
          <div className="sm:w-48">
            <label htmlFor={typeId} className="mb-1.5 block text-sm font-medium">{t("library.openSources.typeLabel")}</label>
            <select
              id={typeId}
              value={category}
              onChange={(e) => setCategory(e.target.value as ContentCategory | "")}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">{t("library.openSources.category.all")}</option>
              {CONTENT_CATEGORIES.map((c) => <option key={c} value={c}>{t(`library.openSources.category.${c}`)}</option>)}
            </select>
          </div>
          <Button type="submit" disabled={busy} className="gap-1.5">
            {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}
            {t("library.openSources.searchButton")}
          </Button>
        </form>

        <p role="status" aria-live="polite" className="mb-2 min-h-5 text-sm">{summary}</p>
        {status === "done" && failed.length > 0 && (
          <p className="mb-4 text-xs text-muted-foreground">{t("library.openSources.unavailable").replace("{sources}", failed.join(", "))}</p>
        )}

        {items.length > 0 && (
          <section aria-labelledby={resultsHeadingId}>
            <h2 id={resultsHeadingId} className="sr-only">{t("library.openSources.resultsHeading")}</h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item, i) => (
                <li key={item.id}>
                  <ExternalContentCard
                    item={item}
                    onPreview={setPreview}
                    saved={savedIds.has(item.id)}
                    savePending={pendingSave === item.id}
                    onToggleSave={(i) => void toggleSave(i)}
                    projectAction={projectActionFor(item)}
                    ref={focusIndex.current === i ? firstNewRef : undefined}
                  />
                </li>
              ))}
            </ul>
            {hasMore && (
              <div className="mt-4 flex justify-center">
                <Button variant="outline" disabled={busy} onClick={() => void run(page + 1, query.trim(), category)} className="gap-1.5">
                  {status === "loadingMore" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  {t("library.openSources.loadMore")}
                </Button>
              </div>
            )}
          </section>
        )}

        </>)}

        {ready.length > 0 && (
          <details className="mt-8 rounded-lg border p-4 text-sm">
            <summary className="cursor-pointer font-medium">{t("library.openSources.aboutSources")}</summary>
            <p className="mt-2 text-muted-foreground">{t("library.openSources.aboutSourcesIntro")}</p>
            <ul className="mt-3 grid gap-1 sm:grid-cols-2">
              {ready.map((p) => (
                <li key={p.id}>
                  <a href={p.homepage} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                    {p.name}
                    <span className="sr-only"> ({t("library.researchAssistant.external.opensInNewTab")})</span>
                  </a>
                  <span className="text-muted-foreground"> — {p.categories.map((c) => t(`library.openSources.category.${c}`)).join(", ")}</span>
                </li>
              ))}
            </ul>
          </details>
        )}

        <ExternalContentPreviewDialog item={preview} onClose={() => setPreview(null)} />
      </LibraryLayout>
    </Layout>
  );
}
