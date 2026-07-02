import { Link } from "react-router-dom";
import { Award, Calendar, Ban } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AcademyCertificateRow } from "@/lib/types/academy-modules";

export function CertificateCard({ certificate }: { certificate: AcademyCertificateRow }) {
  return (
    <Link
      to={`/academy/verify/${certificate.certificate_number}`}
      className="group flex flex-col gap-3 p-5 rounded-2xl border border-border bg-muted/30 hover:border-primary hover:shadow-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="flex items-center justify-between">
        <div className="p-2.5 bg-primary/10 text-primary rounded-xl" aria-hidden="true"><Award className="w-5 h-5" /></div>
        {certificate.status === "revoked" && <Badge variant="destructive" className="gap-1"><Ban className="w-3 h-3" aria-hidden="true" />ملغاة</Badge>}
      </div>
      <h3 className="font-bold text-foreground text-sm leading-snug group-hover:text-primary transition-colors">{certificate.course_name}</h3>
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <Calendar className="w-3 h-3" aria-hidden="true" />
        {new Date(certificate.completion_date).toLocaleDateString()}
      </p>
      <p className="text-xs text-muted-foreground font-mono" dir="ltr">{certificate.certificate_number}</p>
    </Link>
  );
}
