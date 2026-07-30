import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useMaintenance, useSetMaintenance } from "@/features/visionkids/hooks/ops/useOps";
import { OpsHeader, AdminGate } from "@/features/visionkids/components/ops/OpsShell";

export default function MaintenanceMode() {
  const { t } = useLanguage();
  const { data: state } = useMaintenance();
  const save = useSetMaintenance();

  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<"full" | "partial">("full");
  const [message, setMessage] = useState("");
  const [adminsBypass, setAdminsBypass] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (state) { setEnabled(state.enabled); setMode(state.mode); setMessage(state.message ?? ""); setAdminsBypass(state.admins_bypass); }
  }, [state]);

  useDocumentHead({ title: `${t("kids.ops.nav.maintenance")} — VisionKids`, description: t("kids.ops.maintenance.subtitle"), canonicalPath: "/kids/ops/maintenance" });

  async function apply() {
    await save.mutateAsync({ enabled, mode, message: message.trim() || undefined, adminsBypass }).catch(() => {});
    setSaved(true);
    setTimeout(() => setSaved(false), 2800);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <OpsHeader emoji="🛠️" title={t("kids.ops.nav.maintenance")} subtitle={t("kids.ops.maintenance.subtitle")} />
      <AdminGate>
        <div className="mt-6 flex flex-col gap-4 rounded-2xl border-2 border-border bg-card p-5">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="maint-enabled" className="font-heading text-lg font-bold">{t("kids.ops.maintenance.enable")}</Label>
            <Switch id="maint-enabled" checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <fieldset>
            <legend className="text-sm font-semibold">{t("kids.ops.maintenance.mode")}</legend>
            <div className="mt-2 flex gap-2">
              {(["full", "partial"] as const).map((m) => (
                <button key={m} type="button" onClick={() => setMode(m)} aria-pressed={mode === m}
                  className={`rounded-full border-2 px-4 py-1.5 text-sm font-semibold transition-colors ${mode === m ? "border-kids-primary bg-kids-primary/10 text-kids-primary" : "border-border hover:border-kids-primary/50"}`}>
                  {t(`kids.ops.maintenance.mode.${m}`)}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="block text-sm font-semibold">{t("kids.ops.maintenance.message")}
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} placeholder={t("kids.ops.maintenance.messagePlaceholder")}
              className="mt-1 w-full rounded-xl border-2 border-border bg-background px-3 py-2" />
          </label>

          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="maint-bypass" className="text-sm font-medium">{t("kids.ops.maintenance.adminsBypass")}</Label>
            <Switch id="maint-bypass" checked={adminsBypass} onCheckedChange={setAdminsBypass} />
          </div>

          <button type="button" onClick={apply} disabled={save.isPending} className="inline-flex items-center gap-1.5 self-start rounded-full bg-kids-primary px-5 py-2 font-bold text-white hover:opacity-90 disabled:opacity-50">
            <Save className="h-4 w-4" aria-hidden="true" /> {t("kids.ops.maintenance.apply")}
          </button>
          {saved && <p className="text-sm font-semibold text-kids-green">✅ {t("kids.ops.maintenance.saved")}</p>}
          {enabled && <p className="rounded-xl border-2 border-kids-accent/40 bg-kids-accent/10 p-3 text-sm font-semibold text-kids-accent">⚠️ {t("kids.ops.maintenance.activeWarning")}</p>}
        </div>
      </AdminGate>
    </div>
  );
}
