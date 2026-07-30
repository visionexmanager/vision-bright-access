import { useState } from "react";
import { UserPlus } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useMembers, useAddMember } from "@/features/visionkids/hooks/enterprise/useEnterprise";
import { useCurrentOrg } from "@/features/visionkids/hooks/enterprise/useCurrentOrg";
import { EnterpriseHeader, NoOrgPrompt } from "@/features/visionkids/components/enterprise/EnterpriseHeader";
import type { OrgRole } from "@/features/visionkids/types/enterprise.types";

/** Generic roster page shared by Students / Teachers / Parents — one component
 *  over the polymorphic kids_org_members table, filtered by role. */
export function MembersRoster({
  role,
  emoji,
  titleKey,
  subtitleKey,
  canonicalPath,
}: {
  role: OrgRole;
  emoji: string;
  titleKey: string;
  subtitleKey: string;
  canonicalPath: string;
}) {
  const { t } = useLanguage();
  const { orgId, isAdmin } = useCurrentOrg();
  const { data: members = [], isLoading } = useMembers(orgId ?? undefined, role);
  const addMember = useAddMember();

  const [userId, setUserId] = useState("");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useDocumentHead({ title: `${t(titleKey)} — VisionKids`, description: t(subtitleKey), canonicalPath });

  async function add() {
    if (!orgId || !userId.trim()) return;
    setMsg(null);
    try {
      await addMember.mutateAsync({ orgId, userId: userId.trim(), role, displayName: name.trim() || undefined });
      setUserId(""); setName("");
      setMsg(t("kids.enterprise.roster.added"));
      setTimeout(() => setMsg(null), 2800);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : t("kids.enterprise.roster.addFailed"));
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <EnterpriseHeader emoji={emoji} title={t(titleKey)} subtitle={t(subtitleKey)} />

      {!orgId ? (
        <NoOrgPrompt />
      ) : (
        <>
          {isAdmin && (
            <div className="mt-5 rounded-2xl border-2 border-border bg-card p-4">
              <p className="text-sm font-semibold">{t("kids.enterprise.roster.addTitle")}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder={t("kids.enterprise.roster.userId")}
                  className="min-w-0 flex-1 rounded-xl border-2 border-border bg-background px-3 py-2 text-sm" />
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("kids.enterprise.roster.displayName")}
                  className="min-w-0 flex-1 rounded-xl border-2 border-border bg-background px-3 py-2 text-sm" />
                <button type="button" onClick={add} disabled={!userId.trim() || addMember.isPending}
                  className="inline-flex items-center gap-1.5 rounded-full bg-kids-primary px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50">
                  <UserPlus className="h-4 w-4" aria-hidden="true" /> {t("kids.enterprise.roster.add")}
                </button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{t("kids.enterprise.roster.hint")}</p>
              {msg && <p className="mt-2 text-sm font-semibold">{msg}</p>}
            </div>
          )}

          {isLoading ? (
            <div className="mt-6 flex flex-col gap-2" aria-busy="true">
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-2xl bg-muted" />)}
            </div>
          ) : members.length === 0 ? (
            <p className="mt-8 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.enterprise.roster.empty")}</p>
          ) : (
            <ul className="mt-6 flex flex-col gap-2">
              {members.map((m) => (
                <li key={m.user_id} className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-4">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-kids-primary/10 text-lg" aria-hidden="true">{emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-heading font-bold leading-tight">{m.display_name ?? t("kids.enterprise.roster.member")}</p>
                    <p className="truncate text-xs text-muted-foreground">{m.user_id}</p>
                  </div>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">{t(`kids.enterprise.role.${m.role}`)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
