import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, PlayCircle, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useReplays, useMyContinueWatching } from "@/features/visionkids/hooks/events/useReplay";

export default function ReplayLibrary() {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const { data: replays = [], isLoading } = useReplays(search || undefined);
  const { data: continueWatching = [] } = useMyContinueWatching();

  useDocumentHead({ title: `${t("kids.events.nav.replays")} — VisionKids`, description: t("kids.events.meta.description"), canonicalPath: "/kids/events/replays" });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link to="/kids/events" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {t("kids.events.heroTitle")}
      </Link>

      <h1 className="flex items-center gap-2 font-heading text-3xl font-extrabold"><PlayCircle className="h-7 w-7 text-kids-green" aria-hidden="true" /> {t("kids.events.nav.replays")}</h1>

      <div className="relative mt-4">
        <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("kids.events.replays.searchPlaceholder")} className="ps-9" />
      </div>

      {continueWatching.length > 0 && (
        <>
          <h2 className="mt-6 font-heading text-lg font-bold">{t("kids.events.replays.continueWatching")}</h2>
          <div className="mt-2 flex gap-3 overflow-x-auto pb-2">
            {continueWatching.map((c) => c.replay?.event && (
              <Link key={c.replay_id} to={`/kids/events/replays/${c.replay_id}`} className="flex w-40 shrink-0 flex-col gap-1 rounded-xl border-2 border-border bg-card p-2">
                <span className="text-2xl" aria-hidden="true">{c.replay.event.emoji}</span>
                <p className="truncate text-xs font-semibold">{c.replay.event.title}</p>
              </Link>
            ))}
          </div>
        </>
      )}

      <h2 className="mt-6 font-heading text-lg font-bold">{t("kids.events.replays.allReplays")}</h2>
      {isLoading ? (
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : replays.length === 0 ? (
        <p className="mt-6 text-center text-muted-foreground">{t("kids.events.replays.empty")}</p>
      ) : (
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {replays.map((r) => r.event && (
            <Link key={r.id} to={`/kids/events/replays/${r.id}`} className="flex flex-col gap-1 rounded-2xl border-2 border-border bg-card p-3 hover:border-kids-primary/50">
              <span className="text-3xl" aria-hidden="true">{r.event.emoji}</span>
              <p className="truncate text-sm font-semibold">{r.event.title}</p>
              <p className="text-xs text-muted-foreground">{r.view_count} {t("kids.events.replays.views")}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
