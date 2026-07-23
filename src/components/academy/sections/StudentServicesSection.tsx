import { memo } from "react";
import {
  Volume2, Phone, BookOpen, CalendarDays, Search,
  Users, HeartHandshake, GraduationCap,
} from "lucide-react";
import { AcademySectionHeader } from "../ui/AcademySectionHeader";

interface StudentServicesSectionProps {
  voiceMode: boolean;
  isStreaming: boolean;
  onSpeakGreeting: () => void;
  onToggleVoiceMode: () => void;
  onGoToStudyRoom: () => void;
  onGoToOCRScan: () => void;
  onStudyPlan: () => void;
  onAcademicGuidance: () => void;
  onTutoring: () => void;
  onTechnicalSupport: () => void;
}

interface ServiceTile {
  icon: typeof Volume2;
  title: string;
  description: string;
  onClick?: () => void;
  disabled?: boolean;
}

export const StudentServicesSection = memo(function StudentServicesSection({
  voiceMode,
  isStreaming,
  onSpeakGreeting,
  onToggleVoiceMode,
  onGoToStudyRoom,
  onGoToOCRScan,
  onStudyPlan,
  onAcademicGuidance,
  onTutoring,
  onTechnicalSupport,
}: StudentServicesSectionProps) {
  const services: ServiceTile[] = [
    { icon: Volume2, title: "تحية صوتية", description: "استمع لترحيب منير الصوتي", onClick: onSpeakGreeting },
    { icon: Phone, title: voiceMode ? "إخفاء المكالمة" : "مكالمة مع منير", description: "تحدث صوتياً مع مساعدك الأكاديمي", onClick: onToggleVoiceMode },
    { icon: BookOpen, title: "غرفتي الدراسية", description: "ادخل إلى مساحة المذاكرة الخاصة بك", onClick: onGoToStudyRoom },
    { icon: CalendarDays, title: "خطة مذاكرة", description: "احصل على خطة أسبوعية مخصصة", onClick: onStudyPlan, disabled: isStreaming },
    { icon: Search, title: "ماسح الدروس", description: "امسح دروسك ضوئياً بالكاميرا", onClick: onGoToOCRScan },
    { icon: HeartHandshake, title: "الإرشاد الأكاديمي", description: "احصل على إرشاد مخصص من منير", onClick: onAcademicGuidance },
    { icon: Users, title: "دروس تقوية", description: "تصفح الدورات والمدرّسين المتاحين", onClick: onTutoring },
    { icon: GraduationCap, title: "الدعم الفني", description: "مساعدة تقنية لمشاكل المنصة", onClick: onTechnicalSupport },
  ];

  return (
    <section aria-labelledby="student-services-heading" className="bg-card p-8 rounded-3xl border border-border shadow-lg">
      <AcademySectionHeader
        icon={HeartHandshake}
        title="خدمات الطالب"
        description="كل الأدوات التي تحتاجها في مكان واحد"
        headingId="student-services-heading"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {services.map((service) => {
          const Icon = service.icon;
          return (
            <button
              key={service.title}
              type="button"
              onClick={service.onClick}
              disabled={service.disabled}
              aria-disabled={service.disabled}
              className="text-start p-5 rounded-2xl border border-border bg-muted/50 transition-all hover:border-primary hover:bg-primary/5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 bg-primary/10 text-primary rounded-xl" aria-hidden="true">
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <h3 className="font-bold text-foreground text-sm mb-1">{service.title}</h3>
              <p className="text-muted-foreground text-xs">{service.description}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
});
