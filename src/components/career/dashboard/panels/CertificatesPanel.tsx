import { Award, Plus, Calendar } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { useComingSoon } from "@/components/career/useComingSoon";
import { MOCK_CERTIFICATES } from "../mock/mockCertificates";

export function CertificatesPanel() {
  const { t } = useLanguage();
  const handleAction = useComingSoon();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="type-heading mb-1">{t("careerDash.nav.certificates")}</h1>
          <p className="text-sm text-muted-foreground">{t("careerDash.certificates.subtitle")}</p>
        </div>
        <Button onClick={handleAction}>
          <Plus className="me-2 h-4 w-4" aria-hidden="true" />
          {t("careerDash.certificates.add")}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MOCK_CERTIFICATES.map((cert) => (
          <div key={cert.id} className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-card p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Award className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className="text-sm font-bold">{cert.title}</p>
            <p className="text-xs text-primary">{cert.issuer}</p>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" aria-hidden="true" />
              {cert.issueDate}{cert.expiryDate ? ` – ${cert.expiryDate}` : ""}
            </p>
            <p className="text-[11px] text-muted-foreground">ID: {cert.credentialId}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
