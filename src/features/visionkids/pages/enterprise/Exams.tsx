import { useState } from "react";
import { Plus } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useExams, useClasses, useCreateExam } from "@/features/visionkids/hooks/enterprise/useEnterprise";
import { useCurrentOrg } from "@/features/visionkids/hooks/enterprise/useCurrentOrg";
import { EnterpriseHeader, NoOrgPrompt } from "@/features/visionkids/components/enterprise/EnterpriseHeader";

export default function Exams() {
  const { t } = useLanguage();
  const { orgId, isStaff } = useCurrentOrg();
  const { data: classes = [] } = useClasses(orgId ?? undefined);
  const { data: exams = [], isLoading } = useExams(orgId ?? undefined);
  const create = useCreateExam();

  const [showForm, setShowForm] = useState(false);
  const [classId, setClassId] = useState("");
  const [title, setTitle] = useState("");
  const [examDate, setExamDate] = useState("");

  useDocumentHead({
    title: `${t("kids.enterprise.nav.exams")} — VisionKids`,
    description: t("kids.enterprise.exams.subtitle"),
    canonicalPath: "/kids/enterprise/exams",
  });

  async function add() {
    if (!orgId || !title.trim() || !(classId || classes[0]?.id)) return;
    await create.mutateAsync({ orgId, classId: classId || classes[0].id, title: title.trim(), examDate: examDate || undefined }).catch(() => {});
    setShowForm(false); setTitle(""); setExamDate("");
  }

  const classNameById = new Map(classes.map((c) => [c.id, c.name]));

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <EnterpriseHeader emoji="🎓" title={t("kids.enterprise.nav.exams")} subtitle={t("kids.enterprise.exams.subtitle")} />

      {!orgId ? (
        <NoOrgPrompt />
      ) : (
        <>
          {isStaff && classes.length > 0 && (
            <div className="mt-5">
              <button type="button" onClick={() => setShowForm((v) => !v)} className="inline-flex items-center gap-1.5 rounded-full bg-kids-primary px-4 py-2 text-sm font-bold text-white hover:opacity-90">
                <Plus className="h-4 w-4" aria-hidden="true" /> {t("kids.enterprise.exams.new")}
              </button>
              {showForm && (
                <div className="mt-3 flex flex-wrap gap-2 rounded-2xl border-2 border-border bg-card p-4">
                  <select value={classId || classes[0].id} onChange={(e) => setClassId(e.target.value)} className="rounded-xl border-2 border-border bg-background px-3 py-2 text-sm">
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("kids.enterprise.exams.title")} className="min-w-0 flex-1 rounded-xl border-2 border-border bg-background px-3 py-2 text-sm" />
                  <input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} className="rounded-xl border-2 border-border bg-background px-3 py-2 text-sm" />
                  <button type="button" onClick={add} disabled={!title.trim() || create.isPending} className="rounded-full bg-kids-primary px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50">{t("kids.enterprise.exams.add")}</button>
                </div>
              )}
            </div>
          )}

          {isLoading ? (
            <div className="mt-6 flex flex-col gap-2" aria-busy="true">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />)}</div>
          ) : exams.length === 0 ? (
            <p className="mt-8 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.enterprise.exams.empty")}</p>
          ) : (
            <ul className="mt-6 flex flex-col gap-2">
              {exams.map((e) => (
                <li key={e.id} className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-4">
                  <span className="text-2xl" aria-hidden="true">🎓</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-heading font-bold leading-tight">{e.title}</p>
                    <p className="text-xs text-muted-foreground">{classNameById.get(e.class_id) ?? ""} · {e.total_marks} {t("kids.enterprise.exams.marks")}</p>
                  </div>
                  {e.exam_date && <span className="text-xs font-semibold text-muted-foreground">{e.exam_date}</span>}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
