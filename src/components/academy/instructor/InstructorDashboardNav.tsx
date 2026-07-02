import { Link } from "react-router-dom";
import {
  LayoutDashboard, BookOpen, Users, Star, MessageCircle, Megaphone,
  ClipboardList, HelpCircle, BadgeCheck, BarChart3, Wallet, Banknote,
  Bell, Settings, Rocket, FolderTree, Image,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export type InstructorDashboardSection =
  | "overview" | "courses" | "students" | "reviews" | "messages" | "announcements"
  | "assignments" | "quizzes" | "projects" | "certificates" | "analytics" | "content" | "media"
  | "revenue" | "payouts" | "notifications" | "settings";

interface NavItem {
  id: InstructorDashboardSection;
  label: string;
  icon: typeof LayoutDashboard;
  comingSoon?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: "overview", label: "نظرة عامة", icon: LayoutDashboard },
  { id: "courses", label: "دوراتي", icon: BookOpen },
  { id: "students", label: "الطلاب", icon: Users },
  { id: "reviews", label: "التقييمات", icon: Star },
  { id: "messages", label: "الرسائل", icon: MessageCircle, comingSoon: true },
  { id: "announcements", label: "الإعلانات", icon: Megaphone },
  { id: "assignments", label: "الواجبات", icon: ClipboardList },
  { id: "quizzes", label: "الاختبارات", icon: HelpCircle },
  { id: "projects", label: "المشاريع", icon: Rocket },
  { id: "certificates", label: "الشهادات", icon: BadgeCheck },
  { id: "analytics", label: "التحليلات", icon: BarChart3 },
  { id: "content", label: "إدارة المحتوى", icon: FolderTree },
  { id: "media", label: "إدارة الوسائط", icon: Image },
  { id: "revenue", label: "الإيرادات", icon: Wallet, comingSoon: true },
  { id: "payouts", label: "الدفعات", icon: Banknote, comingSoon: true },
  { id: "notifications", label: "الإشعارات", icon: Bell },
  { id: "settings", label: "الإعدادات", icon: Settings },
];

interface InstructorDashboardNavProps {
  active: InstructorDashboardSection;
}

export function InstructorDashboardNav({ active }: InstructorDashboardNavProps) {
  return (
    <nav aria-label="أقسام لوحة المدرّس" className="bg-card rounded-3xl border border-border p-2">
      <ul className="space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === active;
          return (
            <li key={item.id}>
              <Link
                to={`/academy/instructor/dashboard?section=${item.id}`}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  isActive ? "bg-primary/10 text-primary font-bold" : "text-foreground hover:bg-muted/60"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="flex-1">{item.label}</span>
                {item.comingSoon && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">قريباً</Badge>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function getSectionLabel(section: InstructorDashboardSection): string {
  return NAV_ITEMS.find((n) => n.id === section)?.label ?? section;
}
