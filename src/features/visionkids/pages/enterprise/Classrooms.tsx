import { useState } from "react";
import { Plus } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useClasses, useCreateClass } from "@/features/visionkids/hooks/enterprise/useEnterprise";
import { useCurrentOrg } from "@/features/visionkids/hooks/enterprise/useCurrentOrg";
import { EnterpriseHeader, NoOrgPrompt } from "@/features/visionkids/components/enterprise/EnterpriseHeader";

export default function Classrooms() {
  const { t } = useLanguage();
  const { orgId, isStaff } = useCurrentOrg();
  const { data: classes = [], isLoading } = useClasses(orgId ?? undefined);
  const createClass = useCreateClass();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [subject, setSubject] = useState("");

  useDocumentHead({
    title: `${t("kids.enterprise.nav.classrooms")} — VisionKids`,
    description: t("kids.enterprise.classrooms.subtitle"),
    canonicalPath: "/kids/enterprise/classrooms",
  });

  async function create() {
    if (!orgId || !name.trim()) return;
    await createClass.mutateAsync({ orgId, name: name.trim(), grade: grade.trim() || undefined, subject: subject.trim() || undefined }).catch(() => {});
    setShowForm(false); setName(""); setGrade(""); setSubject("");
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <EnterpriseHeader emoji="🪑" title={t("kids.enterprise.nav.classrooms")} subtitle={t("kids.enterprise.classrooms.subtitle")} />

      {!orgId ? (
        <NoOrgPrompt />
      ) : (
        <>
          {isStaff && (
            <div className="mt-5">
              <button type="button" onClick={() => setShowForm((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-full bg-kids-primary px-4 py-2 text-sm font-bold text-white hover:opacity-90">
                <Plus className="h-4 w-4" aria-hidden="true" /> {t("kids.enterprise.classrooms.new")}
              </button>
              {showForm && (
                <div className="mt-3 flex flex-wrap gap-2 rounded-2xl border-2 border-border bg-card p-4">
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("kids.enterprise.classrooms.name")} className="min-w-0 flex-1 rounded-xl border-2 border-border bg-background px-3 py-2 text-sm" />
                  <input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder={t("kids.enterprise.classrooms.grade")} className="w-24 rounded-xl border-2 border-border bg-background px-3 py-2 text-sm" />
                  <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t("kids.enterprise.classrooms.subject")} className="min-w-0 flex-1 rounded-xl border-2 border-border bg-background px-3 py-2 text-sm" />
                  <button type="button" onClick={create} disabled={!name.trim() || createClass.isPending}
                    className="rounded-full bg-kids-primary px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50">{t("kids.enterprise.classrooms.add")}</button>
                </div>
              )}
            </div>
          )}

          {isLoading ? (
            <div className="mt-6 grid gap-3 sm:grid-cols-2" aria-busy="true">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />)}
            </div>
          ) : classes.length === 0 ? (
            <p className="mt-8 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.enterprise.classrooms.empty")}</p>
          ) : (
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {classes.map((c) => (
                <div key={c.id} className="rounded-2xl border-2 border-border bg-card p-4">
                  <p className="font-heading font-bold leading-tight">🪑 {c.name}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {c.grade && <span>{t("kids.enterprise.classrooms.grade")}: {c.grade} · </span>}
                    {c.subject ?? t("kids.enterprise.classrooms.general")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
