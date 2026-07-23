import { useEffect, useState } from "react";
import { Award, Download } from "lucide-react";
import QRCode from "qrcode";
import { jsPDF } from "jspdf";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import type { LibraryCertificateRow } from "@/lib/types/library-learning";

interface CertificateCardProps {
  certificate: LibraryCertificateRow;
}

function verificationUrl(certificateNumber: string): string {
  return `${window.location.origin}/library/certificates/verify/${certificateNumber}`;
}

export function CertificateCard({ certificate }: CertificateCardProps) {
  const { t } = useLanguage();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(verificationUrl(certificate.certificate_number), { margin: 1, width: 160 }).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    });
    return () => { cancelled = true; };
  }, [certificate.certificate_number]);

  const handleDownloadPdf = async () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    doc.setDrawColor(120, 90, 30);
    doc.setLineWidth(3);
    doc.rect(24, 24, pageWidth - 48, pageHeight - 48);

    doc.setFont("times", "bold");
    doc.setFontSize(28);
    doc.text("Certificate of Completion", pageWidth / 2, 110, { align: "center" });

    doc.setFont("times", "normal");
    doc.setFontSize(14);
    doc.text("This certifies that", pageWidth / 2, 160, { align: "center" });

    doc.setFont("times", "bold");
    doc.setFontSize(22);
    doc.text(certificate.recipient_name, pageWidth / 2, 195, { align: "center" });

    doc.setFont("times", "normal");
    doc.setFontSize(14);
    doc.text("has successfully completed", pageWidth / 2, 225, { align: "center" });

    doc.setFont("times", "bolditalic");
    doc.setFontSize(18);
    doc.text(certificate.title, pageWidth / 2, 255, { align: "center", maxWidth: pageWidth - 160 });

    if (certificate.score_percent != null) {
      doc.setFont("times", "normal");
      doc.setFontSize(12);
      doc.text(`Score: ${certificate.score_percent}%`, pageWidth / 2, 280, { align: "center" });
    }

    doc.setFontSize(10);
    doc.text(`Issued ${new Date(certificate.issued_at).toLocaleDateString()} by ${certificate.issuer_name}`, pageWidth / 2, pageHeight - 90, { align: "center" });
    doc.text(`Certificate No. ${certificate.certificate_number}`, pageWidth / 2, pageHeight - 74, { align: "center" });

    if (qrDataUrl) {
      doc.addImage(qrDataUrl, "PNG", pageWidth - 140, pageHeight - 140, 90, 90);
    }

    doc.save(`certificate-${certificate.certificate_number}.pdf`);
  };

  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-1.5 font-semibold"><Award className="h-4 w-4 text-primary" aria-hidden="true" /> {certificate.title}</h3>
          <p className="text-xs text-muted-foreground">{new Date(certificate.issued_at).toLocaleDateString()}</p>
          {certificate.score_percent != null && <p className="text-xs text-muted-foreground">{certificate.score_percent}%</p>}
        </div>
        {qrDataUrl && <img src={qrDataUrl} alt={t("library.certificates.qrAlt")} className="h-16 w-16 shrink-0 rounded" />}
      </div>
      <p className="font-mono text-xs text-muted-foreground">{certificate.certificate_number}</p>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void handleDownloadPdf()}>
        <Download className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.certificates.downloadPdf")}
      </Button>
    </Card>
  );
}
