import { useState } from "react";
import { Award, Plus, Calendar, Trash2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useCareerCertificates } from "@/hooks/career/useCareerCertificates";
import { CareerErrorState } from "../../ui/CareerErrorState";

const EMPTY_FORM = { title: "", issuer: "", issue_date: "", credential_id: "" };

export function CertificatesPanel() {
  const { t } = useLanguage();
  const { certificates, isLoading, error, refetch, add, isAdding, remove } = useCareerCertificates();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const submit = async () => {
    if (!form.title.trim()) return;
    await add({
      title: form.title.trim(),
      issuer: form.issuer.trim() || undefined,
      issue_date: form.issue_date || undefined,
      credential_id: form.credential_id.trim() || undefined,
    });
    setForm(EMPTY_FORM);
    setOpen(false);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="type-heading mb-1">{t("careerDash.nav.certificates")}</h1>
          <p className="text-sm text-muted-foreground">{t("careerDash.certificates.subtitle")}</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="me-2 h-4 w-4" aria-hidden="true" />
          {t("careerDash.certificates.add")}
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-32 rounded-2xl border border-border/60 bg-card animate-pulse" aria-hidden="true" />)}
        </div>
      ) : error ? (
        <CareerErrorState message={error} onRetry={refetch} className="rounded-2xl border border-border/60 bg-card" />
      ) : certificates.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {t("careerDash.certificates.empty")}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {certificates.map((cert) => (
            <div key={cert.id} className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-card p-5">
              <div className="flex items-start justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Award className="h-5 w-5" aria-hidden="true" />
                </span>
                <button
                  type="button"
                  onClick={() => remove(cert.id)}
                  aria-label={t("careerDash.certificates.remove")}
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
              <p className="text-sm font-bold">{cert.title}</p>
              {cert.issuer && <p className="text-xs text-primary">{cert.issuer}</p>}
              {cert.issue_date && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" aria-hidden="true" />
                  {cert.issue_date}{cert.expiry_date ? ` – ${cert.expiry_date}` : ""}
                </p>
              )}
              {cert.credential_id && <p className="text-[11px] text-muted-foreground">ID: {cert.credential_id}</p>}
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("careerDash.certificates.add")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div>
              <Label htmlFor="cert-title">{t("careerDash.certificates.form.title")}</Label>
              <Input id="cert-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="cert-issuer">{t("careerDash.certificates.form.issuer")}</Label>
              <Input id="cert-issuer" value={form.issuer} onChange={(e) => setForm({ ...form, issuer: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="cert-date">{t("careerDash.certificates.form.issueDate")}</Label>
              <Input id="cert-date" type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="cert-credential">{t("careerDash.certificates.form.credentialId")}</Label>
              <Input id="cert-credential" value={form.credential_id} onChange={(e) => setForm({ ...form, credential_id: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("careerDash.profile.cancel")}</Button>
            <Button onClick={submit} disabled={isAdding || !form.title.trim()}>
              {isAdding ? t("careerDash.profile.saving") : t("careerDash.profile.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
