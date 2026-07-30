import { useParams } from "react-router-dom";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useVerifyCertificate } from "@/features/visionkids/hooks/academy/useAcademyCertificates";

export default function CertificateVerify() {
  const { certificateNumber } = useParams<{ certificateNumber: string }>();
  const { t } = useLanguage();
  const { data: result, isLoading } = useVerifyCertificate(certificateNumber);

  useDocumentHead({ title: t("kids.academy.verifyTitle"), description: "", canonicalPath: `/kids/academy/certificates/verify/${certificateNumber}` });

  if (isLoading) return <div className="mx-auto max-w-xl px-4 py-16" aria-busy="true"><div className="h-48 animate-pulse rounded-2xl bg-muted" /></div>;

  if (!result) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <ShieldAlert className="mx-auto h-12 w-12 text-destructive" aria-hidden="true" />
        <p className="mt-3 text-lg font-semibold">{t("kids.academy.certificateNotFound")}</p>
        <p className="mt-1 text-sm text-muted-foreground font-mono">{certificateNumber}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <ShieldCheck className={`mx-auto h-12 w-12 ${result.is_valid ? "text-kids-green" : "text-destructive"}`} aria-hidden="true" />
      <p className="mt-3 font-heading text-2xl font-extrabold">{result.is_valid ? t("kids.academy.certificateValid") : t("kids.academy.certificateInvalid")}</p>

      <div className="mt-6 rounded-2xl border-2 border-border bg-card p-6 text-start">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="font-semibold text-muted-foreground">{t("kids.academy.certificateTitle")}</dt><dd>{result.title}</dd>
          <dt className="font-semibold text-muted-foreground">{t("kids.academy.awardedTo")}</dt><dd>{result.recipient_name}</dd>
          <dt className="font-semibold text-muted-foreground">{t("kids.academy.issuer")}</dt><dd>{result.issuer_name}</dd>
          {result.score_percent !== null && <><dt className="font-semibold text-muted-foreground">{t("kids.academy.score")}</dt><dd>{result.score_percent}%</dd></>}
          <dt className="font-semibold text-muted-foreground">{t("kids.academy.issuedOn")}</dt><dd>{new Date(result.issued_at).toLocaleDateString()}</dd>
        </dl>
      </div>
    </div>
  );
}
