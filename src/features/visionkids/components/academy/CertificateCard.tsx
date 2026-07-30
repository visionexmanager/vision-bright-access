import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { jsPDF } from "jspdf";
import { Award, Share2, Download, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import type { KidsCertificate } from "@/features/visionkids/types/academy.types";

function verificationUrl(certificateNumber: string): string {
  return `${window.location.origin}/kids/academy/certificates/verify/${certificateNumber}`;
}

export function CertificateCard({ certificate }: { certificate: KidsCertificate }) {
  const { t } = useLanguage();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(verificationUrl(certificate.certificate_number), { margin: 1, width: 160 }).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    });
    return () => { cancelled = true; };
  }, [certificate.certificate_number]);

  const handleShare = async () => {
    const url = verificationUrl(certificate.certificate_number);
    if (navigator.share) {
      await navigator.share({ title: certificate.title, text: t("kids.academy.certificateShareText"), url }).catch(() => {});
    } else {
      await navigator.clipboard?.writeText(url);
    }
  };

  const handleDownloadPdf = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    doc.setDrawColor(79, 70, 229);
    doc.setLineWidth(3);
    doc.rect(24, 24, pageWidth - 48, pageHeight - 48);

    doc.setFont("times", "bold");
    doc.setFontSize(28);
    doc.text("VisionKids Academy — Certificate of Completion", pageWidth / 2, 110, { align: "center", maxWidth: pageWidth - 160 });

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

    if (certificate.score_percent !== null) {
      doc.setFont("times", "normal");
      doc.setFontSize(12);
      doc.text(`Score: ${certificate.score_percent}%`, pageWidth / 2, 280, { align: "center" });
    }

    doc.setFontSize(10);
    doc.text(`Issued ${new Date(certificate.issued_at).toLocaleDateString()} by ${certificate.issuer_name}`, pageWidth / 2, pageHeight - 90, { align: "center" });
    doc.text(`Certificate No. ${certificate.certificate_number}`, pageWidth / 2, pageHeight - 74, { align: "center" });

    if (qrDataUrl) doc.addImage(qrDataUrl, "PNG", pageWidth - 140, pageHeight - 140, 90, 90);

    doc.save(`vision-kids-certificate-${certificate.certificate_number}.pdf`);
  };

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-kids-accent/40 bg-gradient-to-br from-kids-accent/10 to-kids-primary/10 p-6 text-center">
      <Award className="h-10 w-10 text-kids-accent" aria-hidden="true" />
      <div>
        <p className="font-heading text-lg font-extrabold">{certificate.title}</p>
        <p className="text-sm text-muted-foreground">{t("kids.academy.awardedTo")} {certificate.recipient_name}</p>
        {certificate.score_percent !== null && <p className="text-sm text-kids-primary">{t("kids.academy.score")}: {certificate.score_percent}%</p>}
        <p className="mt-1 text-xs text-muted-foreground">{new Date(certificate.issued_at).toLocaleDateString()}</p>
      </div>

      {qrDataUrl && <img src={qrDataUrl} alt={t("kids.academy.qrVerification")} className="h-24 w-24 rounded-lg border border-border" />}
      <p className="font-mono text-xs text-muted-foreground">{certificate.certificate_number}</p>

      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownloadPdf}>
          <Download className="h-4 w-4" aria-hidden="true" /> {t("kids.academy.exportPdf")}
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleShare}>
          <Share2 className="h-4 w-4" aria-hidden="true" /> {t("kids.academy.share")}
        </Button>
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <a href={`/kids/academy/certificates/verify/${certificate.certificate_number}`}>
            <QrCode className="h-4 w-4" aria-hidden="true" /> {t("kids.academy.verify")}
          </a>
        </Button>
      </div>
    </div>
  );
}
