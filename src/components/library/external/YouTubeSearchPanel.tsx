import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Loader2, Search, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  YouTubeRequestError, searchYouTube,
  type ExternalContentItem, type YouTubeOrder, type YouTubeResourceType, type YouTubeSearchRequest,
} from "@/services/library/externalContent";

/** The reader's languages (the app's twenty) and a short list of regions; names come from the browser, in the reader's language. */
const LANGUAGES = ["ar", "bn", "de", "en", "es", "fa", "fr", "hi", "id", "it", "ja", "ko", "nl", "pl", "pt", "ru", "tr", "ur", "vi", "zh"] as const;
const REGIONS = ["US", "GB", "CA", "AU", "IN", "PK", "BD", "ID", "VN", "JP", "KR", "CN", "TR", "IR", "SA", "AE", "EG", "JO", "LB", "DE", "FR", "ES", "IT", "NL", "PL", "PT", "BR", "RU"] as const;

function displayName(kind: "language" | "region", code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: kind }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** What a reader is told for each failure. Nothing here comes from the provider. */
export function youtubeMessageKey(error: unknown): string {
  const code = error instanceof YouTubeRequestError ? error.code : "youtube_failed";
  if (code === "youtube_not_configured" || code === "youtube_unavailable") return "library.youtube.notConfigured";
  if (code === "youtube_quota_exceeded" || code === "youtube_rate_limited" || code === "daily_limit") return "library.youtube.quota";
  return "library.youtube.failed";
}

interface Props {
  /** One result, drawn by the page so YouTube results save, add to a project and preview exactly like every other source. */
  renderCard: (item: ExternalContentItem, ref?: (el: HTMLHeadingElement | null) => void) => ReactNode;
}

/**
 * YouTube search: videos, channels and playlists through the official Data API,
 * with the filters that API really has. Nothing is fetched until the reader
 * searches, and every further page is an explicit "Load more" — each one costs
 * quota. The filters that exist only for videos are switched off, and cleared,
 * when another kind of result is chosen, so an invalid request cannot be built.
 */
export function YouTubeSearchPanel({ renderCard }: Props) {
  const { t, lang } = useLanguage();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<YouTubeResourceType>("video");
  const [order, setOrder] = useState<YouTubeOrder>("relevance");
  const [language, setLanguage] = useState<string>(() => ((LANGUAGES as readonly string[]).includes(lang) ? lang : ""));
  const [region, setRegion] = useState("");
  const [captions, setCaptions] = useState(false);
  const [hd, setHd] = useState(false);

  const [items, setItems] = useState<ExternalContentItem[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "loadingMore" | "done" | "error">("idle");
  const [error, setError] = useState<unknown>(null);
  const lastRequest = useRef<{ request: YouTubeSearchRequest; append: boolean } | null>(null);
  const headings = useRef<Array<HTMLHeadingElement | null>>([]);
  const focusFrom = useRef<number | null>(null);
  const ids = { query: useId(), type: useId(), order: useId(), language: useId(), region: useId() };

  const videoOnly = type === "video";

  const run = async (request: YouTubeSearchRequest, append: boolean) => {
    lastRequest.current = { request, append };
    setStatus(append ? "loadingMore" : "loading");
    setError(null);
    try {
      const page = await searchYouTube(request);
      if (append) {
        focusFrom.current = items.length;
        const seen = new Set(items.map((i) => i.id));
        setItems([...items, ...page.items.filter((i) => !seen.has(i.id))]);
      } else {
        headings.current = [];
        focusFrom.current = null;
        setItems(page.items);
      }
      setNextToken(page.nextPageToken);
      setStatus("done");
    } catch (err) {
      setError(err);
      setStatus("error");
    }
  };

  const current = (pageToken?: string): YouTubeSearchRequest => ({
    query: query.trim(), type, order, language: language || undefined, region: region || undefined,
    ...(videoOnly ? { captions: captions || undefined, hd: hd || undefined } : {}), pageToken,
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (query.trim().length < 2) return;
    void run(current(), false);
  };

  const changeType = (next: YouTubeResourceType) => {
    setType(next);
    // The video-only filters and sort do not exist for the other kinds: clear them rather than send them.
    if (next !== "video") { setCaptions(false); setHd(false); if (order === "viewCount") setOrder("relevance"); }
  };

  // After "Load more", focus moves to the first new result so the list grows under the reader's place.
  useEffect(() => {
    if (focusFrom.current !== null) {
      headings.current[focusFrom.current]?.focus();
      focusFrom.current = null;
    }
  }, [items]);

  const langOptions = useMemo(() => LANGUAGES.map((code) => ({ code, name: displayName("language", code, lang) })), [lang]);
  const regionOptions = useMemo(() => REGIONS.map((code) => ({ code, name: displayName("region", code, lang) })), [lang]);
  const busy = status === "loading" || status === "loadingMore";

  const summary = status === "loading"
    ? t("library.openSources.searching")
    : status === "done"
      ? items.length === 0 ? t("library.youtube.noResults") : t("library.youtube.results").replace("{count}", String(items.length))
      : "";

  return (
    <div className="space-y-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Youtube className="h-5 w-5 text-red-600" aria-hidden="true" />
        {t("library.youtube.name")}
      </h2>

      <form role="search" aria-label={t("library.youtube.search")} onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-4">
          <label htmlFor={ids.query} className="mb-1.5 block text-sm font-medium">{t("library.openSources.searchLabel")}</label>
          <Input id={ids.query} value={query} onChange={(e) => setQuery(e.target.value)} maxLength={100} minLength={2} required dir="auto"
            placeholder={t("library.openSources.searchPlaceholder")} />
        </div>

        <div>
          <label htmlFor={ids.type} className="mb-1.5 block text-sm font-medium">{t("library.openSources.typeLabel")}</label>
          <select id={ids.type} value={type} onChange={(e) => changeType(e.target.value as YouTubeResourceType)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="video">{t("library.youtube.type.video")}</option>
            <option value="channel">{t("library.youtube.type.channel")}</option>
            <option value="playlist">{t("library.youtube.type.playlist")}</option>
          </select>
        </div>

        <div>
          <label htmlFor={ids.order} className="mb-1.5 block text-sm font-medium">{t("library.youtube.order.label")}</label>
          <select id={ids.order} value={order} onChange={(e) => setOrder(e.target.value as YouTubeOrder)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="relevance">{t("library.youtube.order.relevance")}</option>
            <option value="date">{t("library.youtube.order.date")}</option>
            <option value="viewCount" disabled={!videoOnly}>{t("library.youtube.order.viewCount")}</option>
          </select>
        </div>

        <div>
          <label htmlFor={ids.language} className="mb-1.5 block text-sm font-medium">{t("library.youtube.language")}</label>
          <select id={ids.language} value={language} onChange={(e) => setLanguage(e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="">{t("library.youtube.any")}</option>
            {langOptions.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor={ids.region} className="mb-1.5 block text-sm font-medium">{t("library.youtube.region")}</label>
          <select id={ids.region} value={region} onChange={(e) => setRegion(e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="">{t("library.youtube.any")}</option>
            {regionOptions.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
          </select>
        </div>

        <fieldset className="flex flex-wrap items-center gap-4 sm:col-span-2 lg:col-span-3" disabled={!videoOnly}>
          <legend className="sr-only">{t("library.youtube.type.video")}</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={captions} onChange={(e) => setCaptions(e.target.checked)} className="h-4 w-4" />
            {t("library.youtube.captions")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={hd} onChange={(e) => setHd(e.target.checked)} className="h-4 w-4" />
            {t("library.youtube.hd")}
          </label>
        </fieldset>

        <div className="flex items-end">
          <Button type="submit" disabled={busy} className="gap-1.5">
            {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}
            {t("library.youtube.search")}
          </Button>
        </div>
      </form>

      <p role="status" aria-live="polite" className="min-h-5 text-sm">{summary}</p>

      {status === "error" && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md border p-3 text-sm">
          <span>{t(youtubeMessageKey(error))}</span>
          {youtubeMessageKey(error) !== "library.youtube.notConfigured" && lastRequest.current && (
            <Button type="button" size="sm" variant="outline" onClick={() => void run(lastRequest.current!.request, lastRequest.current!.append)}>
              {t("library.youtube.tryAgain")}
            </Button>
          )}
        </div>
      )}

      {items.length > 0 && (
        <section aria-label={t("library.openSources.resultsHeading")}>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item, index) => (
              <li key={item.id}>{renderCard(item, (el) => { headings.current[index] = el; })}</li>
            ))}
          </ul>
          {nextToken && (
            <div className="mt-4 flex justify-center">
              <Button variant="outline" disabled={busy} onClick={() => void run(current(nextToken), true)} className="gap-1.5">
                {status === "loadingMore" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {t("library.youtube.loadMore")}
              </Button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
