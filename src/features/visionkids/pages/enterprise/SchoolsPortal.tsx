import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Check } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useCreateOrg } from "@/features/visionkids/hooks/enterprise/useEnterprise";
import { useCurrentOrg } from "@/features/visionkids/hooks/enterprise/useCurrentOrg";
import { ORG_KINDS } from "@/features/visionkids/data/enterpriseConfig";
import { EnterpriseHeader } from "@/features/visionkids/components/enterprise/EnterpriseHeader";
import type { OrgKind } from "@/features/visionkids/types/enterprise.types";

export default function SchoolsPortal() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { memberships, orgId, setOrgId } = useCurrentOrg();
  const createOrg = useCreateOrg();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<OrgKind>("school");
  const [msg, setMsg] = useState<string | null>(null);

  useDocumentHead({
    title: `${t("kids.enterprise.nav.portal")} — VisionKids`,
    description: t("kids.enterprise.portal.subtitle"),
    canonicalPath: "/kids/enterprise/schools",
  });

  async function create() {
    if (!name.trim()) return;
    setMsg(null);
    try {
      const id = await createOrg.mutateAsync({ name: name.trim(), kind, slug: name.trim() });
      setOrgId(id);
      setShowForm(false); setName("");
      setMsg(t("kids.enterprise.portal.created"));
      setTimeout(() => setMsg(null), 2800);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : t("kids.enterprise.portal.createFailed"));
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <EnterpriseHeader emoji="🏫" title={t("kids.enterprise.nav.portal")} subtitle={t("kids.enterprise.portal.subtitle")} showSwitcher={false} />

      {!user ? (
        <p className="mt-8 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.enterprise.signInHint")}</p>
      ) : (
        <>
          <div className="mt-6 flex items-center justify-between">
            <h2 className="font-heading text-lg font-bold">{t("kids.enterprise.portal.myOrgs")}</h2>
            <button type="button" onClick={() => setShowForm((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full bg-kids-primary px-4 py-2 text-sm font-bold text-white hover:opacity-90">
              <Plus className="h-4 w-4" aria-hidden="true" /> {t("kids.enterprise.portal.create")}
            </button>
          </div>

          {showForm && (
            <div className="mt-3 rounded-2xl border-2 border-border bg-card p-4">
              <label className="block text-sm font-semibold">{t("kids.enterprise.portal.orgName")}
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80}
                  className="mt-1 w-full rounded-xl border-2 border-border bg-background px-3 py-2" />
              </label>
              <label className="mt-3 block text-sm font-semibold">{t("kids.enterprise.portal.orgKind")}
                <select value={kind} onChange={(e) => setKind(e.target.value as OrgKind)} className="mt-1 w-full rounded-xl border-2 border-border bg-background px-3 py-2">
                  {ORG_KINDS.map((k) => <option key={k.kind} value={k.kind}>{t(k.labelKey)}</option>)}
                </select>
              </label>
              <button type="button" onClick={create} disabled={!name.trim() || createOrg.isPending}
                className="mt-3 rounded-full bg-kids-primary px-5 py-2 font-bold text-white hover:opacity-90 disabled:opacity-50">
                {t("kids.enterprise.portal.createOrg")}
              </button>
            </div>
          )}
          {msg && <p className="mt-3 text-sm font-semibold">{msg}</p>}

          {memberships.length === 0 ? (
            <p className="mt-6 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.enterprise.portal.none")}</p>
          ) : (
            <ul className="mt-6 flex flex-col gap-2">
              {memberships.map((m) => {
                const active = m.org_id === orgId;
                const kindMeta = ORG_KINDS.find((k) => k.kind === m.organization?.kind);
                return (
                  <li key={m.org_id} className={`flex items-center gap-3 rounded-2xl border-2 p-4 ${active ? "border-kids-primary bg-kids-primary/5" : "border-border bg-card"}`}>
                    <span className="text-2xl" aria-hidden="true">{kindMeta?.emoji ?? "🏫"}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-heading font-bold leading-tight">{m.organization?.name ?? m.org_id}</p>
                      <p className="text-xs text-muted-foreground">{t(`kids.enterprise.role.${m.role}`)}</p>
                    </div>
                    {active ? (
                      <Link to="/kids/enterprise/dashboard" className="inline-flex items-center gap-1 rounded-full bg-kids-primary px-4 py-1.5 text-xs font-bold text-white hover:opacity-90">
                        {t("kids.enterprise.portal.open")}
                      </Link>
                    ) : (
                      <button type="button" onClick={() => setOrgId(m.org_id)}
                        className="rounded-full border-2 border-border px-4 py-1.5 text-xs font-bold hover:border-kids-primary/50">
                        {t("kids.enterprise.portal.select")}
                      </button>
                    )}
                    {active && <Check className="h-4 w-4 text-kids-primary" aria-hidden="true" />}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
