import { useState } from "react";
import { Plus, ExternalLink } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useResources, useCreateResource } from "@/features/visionkids/hooks/enterprise/useEnterprise";
import { useCurrentOrg } from "@/features/visionkids/hooks/enterprise/useCurrentOrg";
import { EnterpriseHeader, NoOrgPrompt } from "@/features/visionkids/components/enterprise/EnterpriseHeader";
import type { ResourceType } from "@/features/visionkids/types/enterprise.types";

const TYPES: (ResourceType | "all")[] = ["all", "book", "file", "video", "activity", "exam", "link"];
const TYPE_EMOJI: Record<string, string> = { book: "📚", file: "📄", video: "🎬", activity: "🎨", exam: "📝", link: "🔗" };

export default function ResourceCenter() {
  const { t } = useLanguage();
  const { orgId, isStaff } = useCurrentOrg();
  const [type, setType] = useState<ResourceType | "all">("all");
  const { data: resources = [], isLoading } = useResources(orgId ?? undefined, type);
  const create = useCreateResource();

  const [showForm, setShowForm] = useState(false);
  const [newType, setNewType] = useState<ResourceType>("file");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");

  useDocumentHead({
    title: `${t("kids.enterprise.nav.resources")} — VisionKids`,
    description: t("kids.enterprise.resources.subtitle"),
    canonicalPath: "/kids/enterprise/resources",
  });

  async function add() {
    if (!orgId || !title.trim()) return;
    await create.mutateAsync({ orgId, type: newType, title: title.trim(), url: url.trim() || undefined, emoji: TYPE_EMOJI[newType] ?? "📄" }).catch(() => {});
    setShowForm(false); setTitle(""); setUrl("");
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <EnterpriseHeader emoji="📚" title={t("kids.enterprise.nav.resources")} subtitle={t("kids.enterprise.resources.subtitle")} />

      {!orgId ? (
        <NoOrgPrompt />
      ) : (
        <>
          <div className="mt-5 flex flex-wrap gap-2">
            {TYPES.map((ty) => (
              <button key={ty} type="button" onClick={() => setType(ty)} aria-current={type === ty ? "true" : undefined}
                className={`rounded-full border-2 px-3 py-1 text-sm font-semibold transition-colors ${type === ty ? "border-kids-primary bg-kids-primary/10 text-kids-primary" : "border-border hover:border-kids-primary/50"}`}>
                {t(`kids.enterprise.resourceType.${ty}`)}
              </button>
            ))}
          </div>

          {isStaff && (
            <div className="mt-3">
              <button type="button" onClick={() => setShowForm((v) => !v)} className="inline-flex items-center gap-1.5 rounded-full bg-kids-primary px-4 py-2 text-sm font-bold text-white hover:opacity-90">
                <Plus className="h-4 w-4" aria-hidden="true" /> {t("kids.enterprise.resources.new")}
              </button>
              {showForm && (
                <div className="mt-3 flex flex-wrap gap-2 rounded-2xl border-2 border-border bg-card p-4">
                  <select value={newType} onChange={(e) => setNewType(e.target.value as ResourceType)} className="rounded-xl border-2 border-border bg-background px-3 py-2 text-sm">
                    {TYPES.filter((x) => x !== "all").map((ty) => <option key={ty} value={ty}>{t(`kids.enterprise.resourceType.${ty}`)}</option>)}
                  </select>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("kids.enterprise.resources.title")} className="min-w-0 flex-1 rounded-xl border-2 border-border bg-background px-3 py-2 text-sm" />
                  <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t("kids.enterprise.resources.url")} className="min-w-0 flex-1 rounded-xl border-2 border-border bg-background px-3 py-2 text-sm" />
                  <button type="button" onClick={add} disabled={!title.trim() || create.isPending} className="rounded-full bg-kids-primary px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50">{t("kids.enterprise.resources.add")}</button>
                </div>
              )}
            </div>
          )}

          {isLoading ? (
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />)}</div>
          ) : resources.length === 0 ? (
            <p className="mt-8 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.enterprise.resources.empty")}</p>
          ) : (
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {resources.map((r) => (
                <div key={r.id} className="flex flex-col gap-1 rounded-2xl border-2 border-border bg-card p-4">
                  <span className="text-2xl" aria-hidden="true">{r.emoji}</span>
                  <p className="font-heading text-sm font-bold leading-tight">{r.title}</p>
                  {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
                  {r.url && <a href={r.url} target="_blank" rel="noopener noreferrer" className="mt-auto inline-flex items-center gap-1 pt-1 text-xs font-semibold text-kids-primary hover:underline"><ExternalLink className="h-3 w-3" aria-hidden="true" /> {t("kids.enterprise.resources.open")}</a>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
