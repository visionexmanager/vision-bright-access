import { memo } from "react";
import { Link } from "react-router-dom";
import { MapPin, CalendarClock, GraduationCap, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AcademyScholarshipRow, AcademyScholarshipStatus } from "@/lib/types/academy-modules";

const STATUS_LABEL: Record<AcademyScholarshipStatus, string> = {
  open: "مفتوحة", closing_soon: "تنتهي قريباً", closed: "مغلقة", upcoming: "قادمة",
};
const STATUS_CLASS: Record<AcademyScholarshipStatus, string> = {
  open: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  closing_soon: "bg-yellow-400/10 text-yellow-600 border-yellow-400/20",
  closed: "bg-muted text-muted-foreground border-border",
  upcoming: "bg-blue-500/10 text-blue-600 border-blue-500/20",
};

const FUNDING_LABEL: Record<string, string> = {
  full: "تمويل كامل", partial: "تمويل جزئي", tuition_only: "الرسوم فقط", stipend_only: "راتب شهري فقط",
};

interface ScholarshipCardProps {
  scholarship: AcademyScholarshipRow;
}

export const ScholarshipCard = memo(function ScholarshipCard({ scholarship }: ScholarshipCardProps) {
  return (
    <Link
      to={`/academy/scholarships/${scholarship.id}`}
      className="group flex flex-col gap-3 p-5 rounded-2xl border border-border bg-muted/30 hover:border-primary hover:shadow-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="flex items-start justify-between gap-2">
        <Badge variant="outline" className={STATUS_CLASS[scholarship.status]}>{STATUS_LABEL[scholarship.status]}</Badge>
        <Badge variant="secondary" className="gap-1"><Wallet className="w-3 h-3" aria-hidden="true" />{FUNDING_LABEL[scholarship.funding_level]}</Badge>
      </div>

      <h3 className="font-bold text-foreground text-sm leading-snug group-hover:text-primary transition-colors line-clamp-2">
        {scholarship.title}
      </h3>
      <p className="text-xs text-muted-foreground">{scholarship.provider}</p>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-2 border-t border-border/50">
        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" aria-hidden="true" />{scholarship.country}</span>
        {scholarship.degree && <span className="flex items-center gap-1"><GraduationCap className="w-3 h-3" aria-hidden="true" />{scholarship.degree}</span>}
        {scholarship.deadline && (
          <span className="flex items-center gap-1">
            <CalendarClock className="w-3 h-3" aria-hidden="true" />
            {new Date(scholarship.deadline).toLocaleDateString()}
          </span>
        )}
      </div>
    </Link>
  );
});
