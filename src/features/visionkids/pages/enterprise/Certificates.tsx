import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, ExternalLink } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useCertificates, useIssueCertificate } from "@/features/visionkids/hooks/enterprise/useEnterprise";
import { useCurrentOrg } from "@/features/visionkids/hooks/enterprise/useCurrentOrg";
import { EnterpriseHeader, NoOrgPrompt } from "@/features/visionkids/components/enterprise/EnterpriseHeader";

export default function Certificates() {
  const { t } = useLanguage();
  const { orgId, isStaff } = useCurrentOrg();
  const { data: certs = [], isLoading } = useCertificates(orgId ?? undefined);
  const issue = useIssueCertificate();

  const [showForm, setShowForm] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [title, setTitle] = useState("");
  const [lastCode, setLastCode] = useState<string | null>(null);

  useDocumentHead({
    title: `${t("kids.enterprise.nav.certificates")} — VisionKids`,
    description: t("kids.enterprise.certificates.subtitle"),
    canonicalPath: "/kids/enterprise/certificates",
  });

  async function create() {
    if (!orgId || !studentId.trim() || !studentName.trim() || !title.trim()) return;
    try {
      const res = await issue.mutateAsync({ orgId, studentId: studentId.trim(), studentName: studentName.trim(), title: title.trim() });
      setLastCode(res.verify_code);
      setStudentId(""); setStudentName(""); setTitle("");
    } catch { /* ignore */ }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <EnterpriseHeader emoji="📜" title={t("kids.enterprise.nav.certificates")} subtitle={t("kids.enterprise.certificates.subtitle")} />

      {!orgId ? (
        <NoOrgPrompt />
      ) : (
        <>
          {isStaff && (
            <div className="mt-5">
              <button type="button" onClick={() => setShowForm((v) => !v)} className="inline-flex items-center gap-1.5 rounded-full bg-kids-primary px-4 py-2 text-sm font-bold text-white hover:opacity-90">
                <Plus className="h-4 w-4" aria-hidden="true" /> {t("kids.enterprise.certificates.issue")}
              </button>
              {showForm && (
                <div className="mt-3 flex flex-col gap-2 rounded-2xl border-2 border-border bg-card p-4">
                  <input value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder={t("kids.enterprise.certificates.studentName")} className="rounded-xl border-2 border-border bg-background px-3 py-2 text-sm" />
                  <input value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder={t("kids.enterprise.certificates.studentId")} className="rounded-xl border-2 border-border bg-background px-3 py-2 text-sm" />
                  <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("kids.enterprise.certificates.title")} className="rounded-xl border-2 border-border bg-background px-3 py-2 text-sm" />
                  <button type="button" onClick={create} disabled={issue.isPending || !studentName.trim() || !title.trim()} className="self-start rounded-full bg-kids-primary px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50">{t("kids.enterprise.certificates.create")}</button>
                </div>
              )}
              {lastCode && (
                <p className="mt-3 rounded-xl border-2 border-kids-green/40 bg-kids-green/5 p-3 text-sm">
                  ✅ {t("kids.enterprise.certificates.issued")} — <Link to={`/kids/enterprise/verify?code=${lastCode}`} className="font-semibold text-kids-primary hover:underline">{t("kids.enterprise.certificates.verifyLink")}</Link>
                </p>
              )}
            </div>
          )}

          {isLoading ? (
            <div className="mt-6 flex flex-col gap-2" aria-busy="true">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />)}</div>
          ) : certs.length === 0 ? (
            <p className="mt-8 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.enterprise.certificates.empty")}</p>
          ) : (
            <ul className="mt-6 flex flex-col gap-2">
              {certs.map((c) => (
                <li key={c.id} className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-4">
                  <span className="text-2xl" aria-hidden="true">📜</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-heading font-bold leading-tight">{c.title}</p>
                    <p className="text-xs text-muted-foreground">{c.student_name} · {new Date(c.issued_at).toLocaleDateString()}</p>
                  </div>
                  <Link to={`/kids/enterprise/verify?code=${c.verify_code}`} className="inline-flex items-center gap-1 text-xs font-semibold text-kids-primary hover:underline">
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> {t("kids.enterprise.certificates.verify")}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
