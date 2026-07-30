import { useState } from "react";
import { Plus, CalendarClock } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useAssignments, useClasses, useCreateAssignment } from "@/features/visionkids/hooks/enterprise/useEnterprise";
import { useCurrentOrg } from "@/features/visionkids/hooks/enterprise/useCurrentOrg";
import { EnterpriseHeader, NoOrgPrompt } from "@/features/visionkids/components/enterprise/EnterpriseHeader";

export default function Assignments() {
  const { t } = useLanguage();
  const { orgId, isStaff } = useCurrentOrg();
  const { data: classes = [] } = useClasses(orgId ?? undefined);
  const { data: assignments = [], isLoading } = useAssignments(orgId ?? undefined);
  const create = useCreateAssignment();

  const [showForm, setShowForm] = useState(false);
  const [classId, setClassId] = useState("");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");

  useDocumentHead({
    title: `${t("kids.enterprise.nav.assignments")} — VisionKids`,
    description: t("kids.enterprise.assignments.subtitle"),
    canonicalPath: "/kids/enterprise/assignments",
  });

  async function add() {
    if (!orgId || !title.trim() || !(classId || classes[0]?.id)) return;
    await create.mutateAsync({ orgId, classId: classId || classes[0].id, title: title.trim(), dueDate: due || undefined }).catch(() => {});
    setShowForm(false); setTitle(""); setDue("");
  }

  const classNameById = new Map(classes.map((c) => [c.id, c.name]));

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <EnterpriseHeader emoji="📝" title={t("kids.enterprise.nav.assignments")} subtitle={t("kids.enterprise.assignments.subtitle")} />

      {!orgId ? (
        <NoOrgPrompt />
      ) : (
        <>
          {isStaff && classes.length > 0 && (
            <div className="mt-5">
              <button type="button" onClick={() => setShowForm((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-full bg-kids-primary px-4 py-2 text-sm font-bold text-white hover:opacity-90">
                <Plus className="h-4 w-4" aria-hidden="true" /> {t("kids.enterprise.assignments.new")}
              </button>
              {showForm && (
                <div className="mt-3 flex flex-wrap gap-2 rounded-2xl border-2 border-border bg-card p-4">
                  <select value={classId || classes[0].id} onChange={(e) => setClassId(e.target.value)} className="rounded-xl border-2 border-border bg-background px-3 py-2 text-sm">
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("kids.enterprise.assignments.title")} className="min-w-0 flex-1 rounded-xl border-2 border-border bg-background px-3 py-2 text-sm" />
                  <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="rounded-xl border-2 border-border bg-background px-3 py-2 text-sm" />
                  <button type="button" onClick={add} disabled={!title.trim() || create.isPending} className="rounded-full bg-kids-primary px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50">{t("kids.enterprise.assignments.add")}</button>
                </div>
              )}
            </div>
          )}

          {isLoading ? (
            <div className="mt-6 flex flex-col gap-2" aria-busy="true">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />)}</div>
          ) : assignments.length === 0 ? (
            <p className="mt-8 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.enterprise.assignments.empty")}</p>
          ) : (
            <ul className="mt-6 flex flex-col gap-2">
              {assignments.map((a) => (
                <li key={a.id} className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-4">
                  <span className="text-2xl" aria-hidden="true">📝</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-heading font-bold leading-tight">{a.title}</p>
                    <p className="text-xs text-muted-foreground">{classNameById.get(a.class_id) ?? ""} · {a.points} {t("kids.enterprise.assignments.points")}</p>
                  </div>
                  {a.due_date && <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground"><CalendarClock className="h-3.5 w-3.5" aria-hidden="true" /> {a.due_date}</span>}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
