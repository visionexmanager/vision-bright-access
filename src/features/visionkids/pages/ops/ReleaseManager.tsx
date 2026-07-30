import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useFlags, useToggleFlag, useReleases } from "@/features/visionkids/hooks/ops/useOps";
import { OpsHeader, AdminGate } from "@/features/visionkids/components/ops/OpsShell";

export default function ReleaseManager() {
  const { t } = useLanguage();
  const { data: flags = [] } = useFlags();
  const { data: releases = [] } = useReleases();
  const toggle = useToggleFlag();

  useDocumentHead({ title: `${t("kids.ops.nav.releases")} — VisionKids`, description: t("kids.ops.releases.subtitle"), canonicalPath: "/kids/ops/releases" });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <OpsHeader emoji="🚀" title={t("kids.ops.nav.releases")} subtitle={t("kids.ops.releases.subtitle")} />
      <AdminGate>
        <section className="mt-6">
          <h2 className="font-heading text-lg font-bold">{t("kids.ops.releases.flags")}</h2>
          {flags.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">{t("kids.ops.releases.noFlags")}</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {flags.map((f) => (
                <li key={f.key} className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-heading font-bold leading-tight">{f.key}</p>
                    {f.description && <p className="text-xs text-muted-foreground">{f.description}</p>}
                    <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase">{t(`kids.ops.channel.${f.channel}`)}</span>
                  </div>
                  <Switch checked={f.enabled} onCheckedChange={(c) => toggle.mutate({ key: f.key, enabled: c })} aria-label={f.key} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-8">
          <h2 className="font-heading text-lg font-bold">{t("kids.ops.releases.history")}</h2>
          {releases.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">{t("kids.ops.releases.noHistory")}</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {releases.map((r) => (
                <li key={r.id} className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-4">
                  <span className="font-heading font-bold">{r.version}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase">{t(`kids.ops.channel.${r.channel}`)}</span>
                  <span className="ms-auto text-xs text-muted-foreground">{new Date(r.deployed_at).toLocaleDateString()}</span>
                  {r.status === "rolled_back" && <span className="text-xs font-semibold text-kids-pink">{t("kids.ops.releases.rolledBack")}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </AdminGate>
    </div>
  );
}
