import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Award } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getCertificatesForCourses } from "@/lib/academy/certificateLocalStore";
import type { AcademyCourseRow } from "@/lib/types/academy-modules";

interface InstructorCertificatesSectionProps {
  courses: AcademyCourseRow[];
}

export function InstructorCertificatesSection({ courses }: InstructorCertificatesSectionProps) {
  const certificates = useMemo(() => getCertificatesForCourses(courses.map((c) => c.id)), [courses]);

  if (certificates.length === 0) {
    return (
      <div className="text-center py-12 border-2 border-dashed border-border rounded-3xl space-y-3">
        <Award className="w-10 h-10 mx-auto text-muted-foreground" aria-hidden="true" />
        <p className="text-muted-foreground text-sm">لم يحصل أي طالب على شهادة من دوراتك بعد.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {certificates.map((c) => (
        <li key={c.id}>
          <Link to={`/academy/verify/${c.certificate_number}`} className="flex items-center justify-between gap-2 p-3 rounded-xl bg-muted/50 border border-border hover:border-primary transition-colors">
            <div>
              <p className="text-sm font-medium text-foreground">{c.student_name}</p>
              <p className="text-xs text-muted-foreground">{c.course_name} · {new Date(c.completion_date).toLocaleDateString()}</p>
            </div>
            <Badge variant={c.status === "valid" ? "default" : "destructive"}>{c.status === "valid" ? "سارية" : "ملغاة"}</Badge>
          </Link>
        </li>
      ))}
    </ul>
  );
}
