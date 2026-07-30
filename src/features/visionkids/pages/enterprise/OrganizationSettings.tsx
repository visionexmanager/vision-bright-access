import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useOrg, useUpdateOrg } from "@/features/visionkids/hooks/enterprise/useEnterprise";
import { useCurrentOrg } from "@/features/visionkids/hooks/enterprise/useCurrentOrg";
import { EnterpriseHeader, NoOrgPrompt } from "@/features/visionkids/components/enterprise/EnterpriseHeader";

export default function OrganizationSettings() {
  const { t } = useLanguage();
  const { orgId, isAdmin } = useCurrentOrg();
  const { data: org } = useOrg(orgId ?? undefined);
  const update = useUpdateOrg();

  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [logo, setLogo] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (org) { setName(org.name); setDomain(org.domain ?? ""); setLogo(org.logo_url ?? ""); }
  }, [org]);

  useDocumentHead({
    title: `${t("kids.enterprise.nav.settings")} — VisionKids`,
    description: t("kids.enterprise.settings.subtitle"),
    canonicalPath: "/kids/enterprise/settings",
  });

  async function save() {
    if (!orgId) return;
    await update.mutateAsync({ id: orgId, patch: { name: name.trim(), domain: domain.trim() || null, logo_url: logo.trim() || null } }).catch(() => {});
    setSaved(true);
    setTimeout(() => setSaved(false), 2800);
  }

  if (!orgId) return <div className="mx-auto max-w-2xl px-4 py-10"><EnterpriseHeader emoji="⚙️" title={t("kids.enterprise.nav.settings")} /><NoOrgPrompt /></div>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <EnterpriseHeader emoji="⚙️" title={t("kids.enterprise.nav.settings")} subtitle={t("kids.enterprise.settings.subtitle")} />

      {!isAdmin ? (
        <p className="mt-8 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.enterprise.adminOnly")}</p>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          <section className="rounded-2xl border-2 border-border bg-card p-5">
            <h2 className="font-heading text-lg font-bold">{t("kids.enterprise.settings.branding")}</h2>
            <label className="mt-3 block text-sm font-semibold">{t("kids.enterprise.settings.name")}
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="mt-1 w-full rounded-xl border-2 border-border bg-background px-3 py-2" />
            </label>
            <label className="mt-3 block text-sm font-semibold">{t("kids.enterprise.settings.domain")}
              <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="school.example.com" className="mt-1 w-full rounded-xl border-2 border-border bg-background px-3 py-2" />
            </label>
            <label className="mt-3 block text-sm font-semibold">{t("kids.enterprise.settings.logo")}
              <input value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="https://…" className="mt-1 w-full rounded-xl border-2 border-border bg-background px-3 py-2" />
            </label>
            <button type="button" onClick={save} disabled={update.isPending} className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-kids-primary px-5 py-2 font-bold text-white hover:opacity-90 disabled:opacity-50">
              <Save className="h-4 w-4" aria-hidden="true" /> {t("kids.enterprise.settings.save")}
            </button>
            {saved && <p className="mt-2 text-sm font-semibold text-kids-green">✅ {t("kids.enterprise.settings.saved")}</p>}
          </section>

          {org && (
            <section className="rounded-2xl border-2 border-border bg-card p-5">
              <h2 className="font-heading text-lg font-bold">{t("kids.enterprise.settings.tenant")}</h2>
              <dl className="mt-2 space-y-1 text-sm">
                <div><dt className="inline font-semibold">{t("kids.enterprise.settings.slug")}: </dt><dd className="inline text-muted-foreground">{org.slug}</dd></div>
                <div><dt className="inline font-semibold">{t("kids.enterprise.settings.storage")}: </dt><dd className="inline text-muted-foreground">{org.storage_quota_mb} MB</dd></div>
              </dl>
              <p className="mt-2 text-xs text-muted-foreground">🔒 {t("kids.enterprise.settings.isolationNote")}</p>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
