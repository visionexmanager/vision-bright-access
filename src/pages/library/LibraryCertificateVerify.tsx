import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { Card } from "@/components/ui/card";
import { verifyCertificate } from "@/services/library/certificates";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import type { LibraryCertificateVerification } from "@/lib/types/library-learning";

export default function LibraryCertificateVerify() {
  const { certificateNumber } = useParams<{ certificateNumber: string }>();
  const { t } = useLanguage();
  const [result, setResult] = useState<LibraryCertificateVerification | null | undefined>(undefined);

  useDocumentHead({ title: t("library.certificates.verify.title") });

  useEffect(() => {
    if (!certificateNumber) return;
    let cancelled = false;
    verifyCertificate(certificateNumber).then((r) => { if (!cancelled) setResult(r); });
    return () => { cancelled = true; };
  }, [certificateNumber]);

  return (
    <Layout>
      <LibraryLayout title={t("library.certificates.verify.title")} breadcrumb={[{ label: t("library.certificates.verify.title") }]}>
        <div className="mx-auto max-w-md">
          {result === undefined ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" /></div>
          ) : result === null ? (
            <Card className="space-y-2 p-6 text-center">
              <XCircle className="mx-auto h-8 w-8 text-destructive" aria-hidden="true" />
              <p className="font-medium">{t("library.certificates.verify.notFound")}</p>
            </Card>
          ) : (
            <Card className="space-y-3 p-6 text-center">
              {result.is_valid ? (
                <CheckCircle2 className="mx-auto h-10 w-10 text-primary" aria-hidden="true" />
              ) : (
                <XCircle className="mx-auto h-10 w-10 text-destructive" aria-hidden="true" />
              )}
              <p className="text-lg font-semibold">{result.title}</p>
              <p className="text-sm">
                {result.is_valid ? t("library.certificates.verify.valid") : t("library.certificates.verify.invalid")}
              </p>
              <div className="space-y-1 border-t pt-3 text-start text-sm">
                <p><span className="text-muted-foreground">{t("library.certificates.verify.issuedTo")}: </span>{result.recipient_name}</p>
                <p><span className="text-muted-foreground">{t("library.certificates.verify.issuedBy")}: </span>{result.issuer_name}</p>
                <p><span className="text-muted-foreground">{t("library.certificates.verify.issuedOn")}: </span>{new Date(result.issued_at).toLocaleDateString()}</p>
                <p className="font-mono text-xs"><span className="text-muted-foreground">{t("library.certificates.verify.number")}: </span>{certificateNumber}</p>
              </div>
            </Card>
          )}
        </div>
      </LibraryLayout>
    </Layout>
  );
}
