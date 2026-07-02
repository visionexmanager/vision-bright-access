import { Award, QrCode, Printer, Ban, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { AcademyCertificateRow } from "@/lib/types/academy-modules";

interface CertificateDisplayProps {
  certificate: AcademyCertificateRow;
  showPrintButton?: boolean;
}

export function CertificateDisplay({ certificate, showPrintButton = true }: CertificateDisplayProps) {
  const revoked = certificate.status === "revoked";

  return (
    <div className="space-y-4">
      {showPrintButton && (
        <div className="flex justify-end print:hidden">
          <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2 rounded-xl">
            <Printer className="w-4 h-4" aria-hidden="true" />
            طباعة / حفظ PDF
          </Button>
        </div>
      )}

      <div
        className={`relative bg-card border-4 rounded-3xl p-8 md:p-12 text-center space-y-6 ${revoked ? "border-destructive/40 opacity-75" : "border-primary/30"}`}
        role="article"
        aria-label={`شهادة إتمام دورة ${certificate.course_name}`}
      >
        {revoked && (
          <Badge variant="destructive" className="absolute top-4 start-4 gap-1">
            <Ban className="w-3 h-3" aria-hidden="true" />
            شهادة ملغاة
          </Badge>
        )}

        <div className="flex justify-center">
          <div className="p-4 bg-primary/10 text-primary rounded-full" aria-hidden="true">
            <Award className="w-10 h-10" />
          </div>
        </div>

        <div>
          <p className="text-sm text-muted-foreground uppercase tracking-widest">أكاديمية Visionex</p>
          <h1 className="text-2xl md:text-3xl font-black text-foreground mt-2">شهادة إتمام</h1>
        </div>

        <p className="text-muted-foreground">تشهد أكاديمية Visionex بأن</p>
        <p className="text-2xl md:text-3xl font-black text-primary">{certificate.student_name}</p>
        <p className="text-muted-foreground">
          قد أتمّ بنجاح دورة <span className="font-bold text-foreground">"{certificate.course_name}"</span>
        </p>

        {certificate.skills.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1.5">
            {certificate.skills.map((s) => <Badge key={s} variant="secondary">{s}</Badge>)}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-border max-w-md mx-auto text-sm">
          <div>
            <p className="text-muted-foreground">تاريخ الإتمام</p>
            <p className="font-bold text-foreground">{new Date(certificate.completion_date).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-muted-foreground">توقيع</p>
            <p className="font-bold text-foreground">{certificate.signature_name}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-border">
          <div className="text-start">
            <p className="text-xs text-muted-foreground">رقم الشهادة</p>
            <p className="font-mono text-sm text-foreground" dir="ltr">{certificate.certificate_number}</p>
          </div>
          <a
            href={certificate.verification_url}
            className="flex items-center gap-2 p-2 rounded-xl border border-border hover:border-primary transition-colors"
            aria-label="التحقق من صحة الشهادة"
          >
            <QrCode className="w-8 h-8 text-foreground" aria-hidden="true" />
            <span className="text-xs text-muted-foreground max-w-[160px] truncate" dir="ltr">{certificate.verification_url}</span>
          </a>
        </div>

        <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
          {revoked ? "هذه الشهادة أُلغيت ولم تعد صالحة." : "هذه الشهادة قابلة للتحقق علنياً عبر الرابط أعلاه."}
        </p>
      </div>
    </div>
  );
}
