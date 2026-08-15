import {
  LayoutDashboard, BookOpen, Users, Star, MessageCircle, Megaphone,
  ClipboardList, HelpCircle, BadgeCheck, BarChart3, Wallet, Banknote,
  Bell, Settings, Rocket, FolderTree, Image,
} from "lucide-react";

export type InstructorDashboardSection =
  | "overview" | "courses" | "students" | "reviews" | "messages" | "announcements"
  | "assignments" | "quizzes" | "projects" | "certificates" | "analytics" | "content" | "media"
  | "revenue" | "payouts" | "notifications" | "settings";

export interface NavItem {
  id: InstructorDashboardSection;
  label: string;
  icon: typeof LayoutDashboard;
  comingSoon?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
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

export function getSectionLabel(section: InstructorDashboardSection): string {
  return NAV_ITEMS.find((n) => n.id === section)?.label ?? section;
}
