import { Link } from "react-router-dom";
import {
  BookOpen, Route, CalendarDays, Bookmark, ClipboardCheck, BadgeCheck,
  Trophy, Target, Bell, Settings, GraduationCap, Library, Search,
} from "lucide-react";
import { AcademySectionHeader } from "../ui/AcademySectionHeader";

const QUICK_LINKS = [
  { to: "/academy/courses", label: "تصفح الدورات", description: "اكتشف الدورات المتاحة وسجّل فيها", icon: Search },
  { to: "/academy/my-courses", label: "دوراتي", description: "تابع تقدّمك وأكمل تعلّمك", icon: BookOpen },
  { to: "/academy/paths", label: "مسارات التعلّم", description: "خطط متكاملة للوصول إلى هدفك", icon: Route },
  { to: "/academy/planner", label: "مخطط الدراسة", description: "نظّم أهدافك وجدولك الأسبوعي", icon: CalendarDays },
  { to: "/academy/saved", label: "المحفوظات", description: "ملاحظاتك وإشاراتك المرجعية", icon: Bookmark },
  { to: "/academy/my-work", label: "أعمالي", description: "الواجبات والاختبارات والمشاريع", icon: ClipboardCheck },
  { to: "/academy/certificates", label: "شهاداتي", description: "اعرض شهاداتك وتحقق منها", icon: BadgeCheck },
  { to: "/academy/achievements", label: "الإنجازات", description: "الشارات والمستويات التي حققتها", icon: Trophy },
  { to: "/academy/missions", label: "المهام", description: "تحديات يومية وأسبوعية لكسب XP", icon: Target },
  { to: "/academy/leaderboard", label: "لوحة المتصدرين", description: "تابع ترتيبك وتقدّم مجتمع التعلّم", icon: GraduationCap },
  { to: "/academy/notifications", label: "الإشعارات", description: "المواعيد والتنبيهات التعليمية", icon: Bell },
  { to: "/academy/settings", label: "إعدادات الأكاديمية", description: "الحساب والخصوصية وإمكانية الوصول", icon: Settings },
] as const;

export function AcademyQuickAccessSection() {
  return (
    <section aria-labelledby="academy-quick-access-heading" className="bg-card p-6 md:p-8 rounded-3xl border border-border shadow-lg">
      <AcademySectionHeader
        icon={Library}
        title="مركز التعلّم"
        description="وصول سريع إلى جميع أدوات الأكاديمية"
        headingId="academy-quick-access-heading"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {QUICK_LINKS.map(({ to, label, description, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="group flex items-start gap-3 rounded-2xl border border-border bg-muted/30 p-4 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="shrink-0 rounded-xl bg-primary/10 p-2.5 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground" aria-hidden="true">
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-foreground">{label}</span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
