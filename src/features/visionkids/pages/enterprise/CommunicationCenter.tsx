import { useState } from "react";
import { Plus, Megaphone, CalendarClock, ClipboardList } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useAnnouncements, useCreateAnnouncement } from "@/features/visionkids/hooks/enterprise/useEnterprise";
import { useCurrentOrg } from "@/features/visionkids/hooks/enterprise/useCurrentOrg";
import { EnterpriseHeader, NoOrgPrompt } from "@/features/visionkids/components/enterprise/EnterpriseHeader";
import type { AnnouncementKind, Audience } from "@/features/visionkids/types/enterprise.types";

const KIND_ICON = { announcement: Megaphone, meeting: CalendarClock, survey: ClipboardList } as const;
const AUDIENCES: Audience[] = ["all", "teachers", "parents", "students"];
const KINDS: AnnouncementKind[] = ["announcement", "meeting", "survey"];

export default function CommunicationCenter() {
  const { t } = useLanguage();
  const { orgId, isStaff } = useCurrentOrg();
  const { data: items = [], isLoading } = useAnnouncements(orgId ?? undefined);
  const create = useCreateAnnouncement();

  const [showForm, setShowForm] = useState(false);
  const [kind, setKind] = useState<AnnouncementKind>("announcement");
  const [audience, setAudience] = useState<Audience>("all");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  useDocumentHead({
    title: `${t("kids.enterprise.nav.communication")} — VisionKids`,
    description: t("kids.enterprise.communication.subtitle"),
    canonicalPath: "/kids/enterprise/communication",
  });

  async function post() {
    if (!orgId || !title.trim()) return;
    await create.mutateAsync({ orgId, kind, title: title.trim(), body: body.trim() || undefined, audience }).catch(() => {});
    setShowForm(false); setTitle(""); setBody("");
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <EnterpriseHeader emoji="📢" title={t("kids.enterprise.nav.communication")} subtitle={t("kids.enterprise.communication.subtitle")} />

      {!orgId ? (
        <NoOrgPrompt />
      ) : (
        <>
          {isStaff && (
            <div className="mt-5">
              <button type="button" onClick={() => setShowForm((v) => !v)} className="inline-flex items-center gap-1.5 rounded-full bg-kids-primary px-4 py-2 text-sm font-bold text-white hover:opacity-90">
                <Plus className="h-4 w-4" aria-hidden="true" /> {t("kids.enterprise.communication.new")}
              </button>
              {showForm && (
                <div className="mt-3 flex flex-col gap-2 rounded-2xl border-2 border-border bg-card p-4">
                  <div className="flex flex-wrap gap-2">
                    <select value={kind} onChange={(e) => setKind(e.target.value as AnnouncementKind)} className="rounded-xl border-2 border-border bg-background px-3 py-2 text-sm">
                      {KINDS.map((k) => <option key={k} value={k}>{t(`kids.enterprise.commKind.${k}`)}</option>)}
                    </select>
                    <select value={audience} onChange={(e) => setAudience(e.target.value as Audience)} className="rounded-xl border-2 border-border bg-background px-3 py-2 text-sm">
                      {AUDIENCES.map((a) => <option key={a} value={a}>{t(`kids.enterprise.audience.${a}`)}</option>)}
                    </select>
                  </div>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("kids.enterprise.communication.title")} className="rounded-xl border-2 border-border bg-background px-3 py-2 text-sm" />
                  <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder={t("kids.enterprise.communication.body")} className="rounded-xl border-2 border-border bg-background px-3 py-2 text-sm" />
                  <button type="button" onClick={post} disabled={!title.trim() || create.isPending} className="self-start rounded-full bg-kids-primary px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50">{t("kids.enterprise.communication.post")}</button>
                </div>
              )}
            </div>
          )}

          {isLoading ? (
            <div className="mt-6 flex flex-col gap-2" aria-busy="true">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />)}</div>
          ) : items.length === 0 ? (
            <p className="mt-8 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.enterprise.communication.empty")}</p>
          ) : (
            <ul className="mt-6 flex flex-col gap-2">
              {items.map((a) => {
                const Icon = KIND_ICON[a.kind] ?? Megaphone;
                return (
                  <li key={a.id} className="rounded-2xl border-2 border-border bg-card p-4">
                    <div className="flex items-start gap-3">
                      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-kids-primary" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="font-heading font-bold leading-tight">{a.title}</p>
                        {a.body && <p className="mt-0.5 text-sm text-muted-foreground">{a.body}</p>}
                        <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{t(`kids.enterprise.audience.${a.audience}`)} · {new Date(a.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
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
