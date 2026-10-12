import { useId, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Search } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  APPROVED_SOURCES, MAX_AGE, MIN_AGE, SUBJECTS, validAgeRange,
  type ApprovalCandidate, type Subject,
} from "@/features/visionkids/data/approvedSources";
import {
  approveResource, fetchAllApproved, searchCandidates, setResourceStatus,
} from "@/features/visionkids/services/ops/approvedResources";
import { fetchFlags } from "@/features/visionkids/services/ops/admin";

/**
 * Administrator-only. Search one allow-listed source, then approve individual
 * resources with an age range and a subject. Nothing is approved by default and
 * nothing a search returns is shown to a child until it is approved here. Which
 * sources are switched on at all is the existing Feature flags page.
 */
export function ApprovedSourcesPanel() {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const searchId = useId();
  const [sourceId, setSourceId] = useState<string>(APPROVED_SOURCES[0].id);
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState<{ source: string; query: string } | null>(null);

  const flags = useQuery({ queryKey: ["kids-ops", "flags"], queryFn: fetchFlags });
  const approved = useQuery({ queryKey: ["kids-ops", "approved-resources"], queryFn: fetchAllApproved });
  const found = useQuery({
    queryKey: ["kids-ops", "source-candidates", submitted?.source, submitted?.query],
    queryFn: () => searchCandidates(submitted!.source, submitted!.query),
    enabled: submitted !== null,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["kids-ops", "approved-resources"] });
  const toggle = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "approved" | "disabled" }) => setResourceStatus(id, status),
    onSuccess: refresh,
  });

  const source = APPROVED_SOURCES.find((s) => s.id === sourceId) ?? APPROVED_SOURCES[0];
  const sourceOn = flags.data?.find((f) => f.key === source.flagKey)?.enabled === true;
  const approvedKeys = new Set((approved.data ?? []).map((r) => `${r.source}:${r.provider_item_id}`));

  function onSearch(e: FormEvent) {
    e.preventDefault();
    if (query.trim().length >= 2) setSubmitted({ source: sourceId, query: query.trim() });
  }

  return (
    <section className="mt-10" aria-labelledby="approved-sources-heading">
      <h2 id="approved-sources-heading" className="font-heading text-xl font-bold">{t("kids.ops.sources.title")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("kids.ops.sources.intro")}</p>

      <form onSubmit={onSearch} role="search" className="mt-4 flex flex-wrap items-end gap-2">
        <div className="flex gap-2" role="group" aria-label={t("kids.ops.sources.title")}>
          {APPROVED_SOURCES.map((s) => (
            <button key={s.id} type="button" onClick={() => setSourceId(s.id)} aria-pressed={sourceId === s.id}
              className={`rounded-full border-2 px-3 py-1 text-sm font-semibold ${sourceId === s.id ? "border-kids-primary bg-kids-primary/10" : "border-border"}`}>
              {s.id === "openstax" ? "OpenStax" : "Wikibooks"}
            </button>
          ))}
        </div>
        <label htmlFor={searchId} className="sr-only">{t("kids.ops.sources.search")}</label>
        <input id={searchId} value={query} onChange={(e) => setQuery(e.target.value)} maxLength={100} minLength={2}
          className="min-w-[12rem] flex-1 rounded-xl border-2 border-border bg-background px-3 py-2 text-sm" />
        <button type="submit" className="inline-flex items-center gap-1.5 rounded-full bg-kids-primary px-4 py-2 text-sm font-bold text-white">
          <Search className="h-4 w-4" aria-hidden="true" /> {t("kids.ops.sources.search")}
        </button>
      </form>

      {!sourceOn && flags.isSuccess && (
        <p role="status" className="mt-3 rounded-xl border-2 border-dashed border-border p-3 text-sm">{t("kids.ops.sources.off")}</p>
      )}

      {submitted && (
        <div className="mt-4" aria-live="polite" aria-busy={found.isFetching}>
          {found.isError ? (
            <p role="alert" className="text-sm font-semibold text-kids-pink">{t("kids.ops.sources.error")}</p>
          ) : found.data && found.data.candidates.length === 0 && found.data.refused.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("kids.ops.sources.none")}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {found.data?.candidates.map((c) => (
                <CandidateRow key={`${c.source}:${c.provider_item_id}`} candidate={c} done={approvedKeys.has(`${c.source}:${c.provider_item_id}`)} onApproved={refresh} />
              ))}
              {found.data?.refused.map((r, i) => (
                <li key={`r-${i}`} className="rounded-xl border-2 border-dashed border-border p-3 text-sm text-muted-foreground">
                  <span className="font-semibold">{r.title}</span> — {t("kids.ops.sources.refused")}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <h3 className="mt-8 font-heading text-lg font-bold">{t("kids.ops.sources.approvedHeading")}</h3>
      {(approved.data ?? []).length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{t("kids.ops.sources.none")}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {(approved.data ?? []).map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-border bg-card p-3">
              <div className="min-w-0">
                <p className="font-semibold leading-tight">{r.title}</p>
                <p className="text-xs text-muted-foreground">
                  {r.source} · {t("kids.sources.ages")} {r.age_min}–{r.age_max} · {t(`kids.ops.sources.subject.${r.subject}`)} · {r.license_name}
                  {r.status === "disabled" && <strong className="ms-2">{t("kids.ops.sources.disabledBadge")}</strong>}
                </p>
              </div>
              <button type="button" disabled={toggle.isPending}
                onClick={() => toggle.mutate({ id: r.id, status: r.status === "approved" ? "disabled" : "approved" })}
                className="rounded-full border-2 border-border px-3 py-1 text-xs font-bold">
                {r.status === "approved" ? t("kids.ops.sources.disable") : t("kids.ops.sources.enable")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CandidateRow({ candidate, done, onApproved }: { candidate: ApprovalCandidate; done: boolean; onApproved: () => void }) {
  const { t } = useLanguage();
  const id = useId();
  const [ageMin, setAgeMin] = useState(8);
  const [ageMax, setAgeMax] = useState(12);
  const [subject, setSubject] = useState<Subject>("other");
  const save = useMutation({
    mutationFn: () => approveResource(candidate, { ageMin, ageMax, subject }),
    onSuccess: onApproved,
  });
  const valid = validAgeRange(ageMin, ageMax);

  return (
    <li className="rounded-xl border-2 border-border bg-card p-3">
      <p className="font-semibold leading-tight">{candidate.title}</p>
      <p className="text-xs text-muted-foreground">{candidate.attribution} · {candidate.license_name}</p>
      {candidate.summary && <p className="mt-1 line-clamp-3 text-sm">{candidate.summary}</p>}
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-xs font-semibold" htmlFor={`${id}-from`}>{t("kids.ops.sources.ageFrom")}
          <input id={`${id}-from`} type="number" min={MIN_AGE} max={MAX_AGE} value={ageMin} onChange={(e) => setAgeMin(Number(e.target.value))}
            className="ms-1 w-16 rounded-lg border-2 border-border bg-background px-2 py-1 text-sm" />
        </label>
        <label className="text-xs font-semibold" htmlFor={`${id}-to`}>{t("kids.ops.sources.ageTo")}
          <input id={`${id}-to`} type="number" min={MIN_AGE} max={MAX_AGE} value={ageMax} onChange={(e) => setAgeMax(Number(e.target.value))}
            className="ms-1 w-16 rounded-lg border-2 border-border bg-background px-2 py-1 text-sm" />
        </label>
        <label className="text-xs font-semibold" htmlFor={`${id}-subject`}>{t("kids.ops.sources.subject")}
          <select id={`${id}-subject`} value={subject} onChange={(e) => setSubject(e.target.value as Subject)}
            className="ms-1 rounded-lg border-2 border-border bg-background px-2 py-1 text-sm">
            {SUBJECTS.map((s) => <option key={s} value={s}>{t(`kids.ops.sources.subject.${s}`)}</option>)}
          </select>
        </label>
        <a href={candidate.url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold underline">
          {candidate.url.replace(/^https:\/\//, "").slice(0, 60)}<span className="sr-only"> — {t("kids.sources.opens")}</span>
        </a>
        <button type="button" disabled={!valid || save.isPending || done || save.isSuccess}
          onClick={() => save.mutate()}
          className="inline-flex items-center gap-1 rounded-full bg-kids-green px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50">
          <Check className="h-3.5 w-3.5" aria-hidden="true" /> {t("kids.ops.content.approve")}
        </button>
      </div>
      {save.isError && <p role="alert" className="mt-2 text-xs font-semibold text-kids-pink">{t("kids.ops.sources.error")}</p>}
    </li>
  );
}
