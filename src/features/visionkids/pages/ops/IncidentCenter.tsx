import { useState } from "react";
import { Plus } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useIncidents, useCreateIncident, useUpdateIncident } from "@/features/visionkids/hooks/ops/useOps";
import { SEVERITY_COLOR, OPS_COLOR_CLASSES } from "@/features/visionkids/data/opsConfig";
import { OpsHeader, AdminGate } from "@/features/visionkids/components/ops/OpsShell";
import type { Severity, IncidentStatus } from "@/features/visionkids/types/ops.types";

const SEVERITIES: Severity[] = ["critical", "major", "minor", "info"];
const STATUSES: IncidentStatus[] = ["open", "investigating", "monitoring", "resolved"];

export default function IncidentCenter() {
  const { t } = useLanguage();
  const { data: incidents = [], isLoading } = useIncidents();
  const createIncident = useCreateIncident();
  const updateIncident = useUpdateIncident();

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<Severity>("minor");

  useDocumentHead({ title: `${t("kids.ops.nav.incidents")} — VisionKids`, description: t("kids.ops.incidents.subtitle"), canonicalPath: "/kids/ops/incidents" });

  async function create() {
    if (!title.trim()) return;
    await createIncident.mutateAsync({ title: title.trim(), description: description.trim(), severity }).catch(() => {});
    setShowForm(false); setTitle(""); setDescription("");
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <OpsHeader emoji="🚨" title={t("kids.ops.nav.incidents")} subtitle={t("kids.ops.incidents.subtitle")} />
      <AdminGate>
        <div className="mt-5">
          <button type="button" onClick={() => setShowForm((v) => !v)} className="inline-flex items-center gap-1.5 rounded-full bg-kids-primary px-4 py-2 text-sm font-bold text-white hover:opacity-90">
            <Plus className="h-4 w-4" aria-hidden="true" /> {t("kids.ops.incidents.new")}
          </button>
          {showForm && (
            <div className="mt-3 flex flex-col gap-2 rounded-2xl border-2 border-border bg-card p-4">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("kids.ops.incidents.title")} className="rounded-xl border-2 border-border bg-background px-3 py-2 text-sm" />
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder={t("kids.ops.incidents.description")} className="rounded-xl border-2 border-border bg-background px-3 py-2 text-sm" />
              <select value={severity} onChange={(e) => setSeverity(e.target.value as Severity)} className="self-start rounded-xl border-2 border-border bg-background px-3 py-2 text-sm">
                {SEVERITIES.map((s) => <option key={s} value={s}>{t(`kids.ops.severity.${s}`)}</option>)}
              </select>
              <button type="button" onClick={create} disabled={!title.trim() || createIncident.isPending} className="self-start rounded-full bg-kids-primary px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50">{t("kids.ops.incidents.create")}</button>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="mt-6 flex flex-col gap-2" aria-busy="true">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />)}</div>
        ) : incidents.length === 0 ? (
          <p className="mt-8 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.ops.incidents.empty")}</p>
        ) : (
          <ul className="mt-6 flex flex-col gap-2">
            {incidents.map((i) => (
              <li key={i.id} className="rounded-2xl border-2 border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-heading font-bold leading-tight">{i.title}</p>
                    {i.description && <p className="text-sm text-muted-foreground">{i.description}</p>}
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${OPS_COLOR_CLASSES[SEVERITY_COLOR[i.severity]]}`}>{t(`kids.ops.severity.${i.severity}`)}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {STATUSES.map((s) => (
                    <button key={s} type="button" onClick={() => updateIncident.mutate({ id: i.id, status: s })} aria-pressed={i.status === s}
                      className={`rounded-lg border-2 px-2 py-0.5 text-[11px] font-semibold transition-colors ${i.status === s ? "border-kids-primary bg-kids-primary/10 text-kids-primary" : "border-border hover:border-kids-primary/50"}`}>
                      {t(`kids.ops.incidentStatus.${s}`)}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </AdminGate>
    </div>
  );
}
