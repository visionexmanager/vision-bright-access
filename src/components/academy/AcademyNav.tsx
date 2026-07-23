import { Link, useLocation } from "react-router-dom";
import {
  Award, BookOpen, GraduationCap, Home, Library, Map, Search, Sparkles,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

const ITEMS = [
  { path: "/academy", en: "Academy home", ar: "الرئيسية", icon: Home, exact: true },
  { path: "/academy/courses", en: "Courses", ar: "الدورات", icon: BookOpen },
  { path: "/academy/my-courses", en: "My learning", ar: "تعلّمي", icon: GraduationCap },
  { path: "/academy/paths", en: "Learning paths", ar: "المسارات", icon: Map },
  { path: "/academy/library", en: "Digital library", ar: "المكتبة", icon: Library },
  { path: "/academy/scholarships", en: "Scholarships", ar: "المنح", icon: Sparkles },
  { path: "/academy/certificates", en: "Certificates", ar: "الشهادات", icon: Award },
  { path: "/academy/search", en: "Search", ar: "بحث", icon: Search },
] as const;

export function AcademyNav() {
  const { pathname } = useLocation();
  const { lang } = useLanguage();
  const isArabic = lang === "ar";

  return (
    <nav
      aria-label={isArabic ? "أقسام الأكاديمية" : "Academy sections"}
      className="border-b border-border/70 bg-card/95 supports-[backdrop-filter]:bg-card/85 supports-[backdrop-filter]:backdrop-blur"
    >
      <div className="section-container flex gap-1 overflow-x-auto py-2" style={{ scrollbarWidth: "thin" }}>
        {ITEMS.map((item) => {
          const active = item.exact ? pathname === item.path : pathname.startsWith(item.path);
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {isArabic ? item.ar : item.en}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
