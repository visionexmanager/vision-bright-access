import type { OrgKind, OrgRole, AttendanceStatus } from "@/features/visionkids/types/enterprise.types";

export type KidsColor = "primary" | "secondary" | "accent" | "pink" | "green" | "purple";

export const ENT_COLOR_CLASSES: Record<KidsColor, string> = {
  primary: "border-kids-primary/30 bg-kids-primary/10 text-kids-primary",
  secondary: "border-kids-secondary/30 bg-kids-secondary/10 text-kids-secondary",
  accent: "border-kids-accent/30 bg-kids-accent/10 text-kids-accent",
  pink: "border-kids-pink/30 bg-kids-pink/10 text-kids-pink",
  green: "border-kids-green/30 bg-kids-green/10 text-kids-green",
  purple: "border-kids-purple/30 bg-kids-purple/10 text-kids-purple",
};

export const ORG_KINDS: { kind: OrgKind; emoji: string; labelKey: string }[] = [
  { kind: "school", emoji: "🏫", labelKey: "kids.enterprise.kind.school" },
  { kind: "nursery", emoji: "🧸", labelKey: "kids.enterprise.kind.nursery" },
  { kind: "center", emoji: "🏢", labelKey: "kids.enterprise.kind.center" },
  { kind: "library", emoji: "📚", labelKey: "kids.enterprise.kind.library" },
  { kind: "nonprofit", emoji: "🤝", labelKey: "kids.enterprise.kind.nonprofit" },
];

export const ORG_ROLES: OrgRole[] = ["owner", "admin", "teacher", "parent", "student", "staff"];

/** Roles that can manage classroom data (used to gate staff-only UI). */
export const STAFF_ROLES: OrgRole[] = ["owner", "admin", "teacher", "staff"];
export const ADMIN_ROLES: OrgRole[] = ["owner", "admin"];

export const ATTENDANCE_STATUSES: { status: AttendanceStatus; emoji: string; color: KidsColor }[] = [
  { status: "present", emoji: "✅", color: "green" },
  { status: "absent", emoji: "❌", color: "pink" },
  { status: "late", emoji: "⏰", color: "accent" },
  { status: "excused", emoji: "📝", color: "secondary" },
];

export const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

/** The School Dashboard's management sections. */
export const ENTERPRISE_SECTIONS: { id: string; emoji: string; to: string; labelKey: string; staffOnly?: boolean }[] = [
  { id: "classrooms", emoji: "🪑", to: "/kids/enterprise/classrooms", labelKey: "kids.enterprise.nav.classrooms" },
  { id: "students", emoji: "🧒", to: "/kids/enterprise/students", labelKey: "kids.enterprise.nav.students" },
  { id: "teachers", emoji: "🧑‍🏫", to: "/kids/enterprise/teachers", labelKey: "kids.enterprise.nav.teachers" },
  { id: "parents", emoji: "👨‍👩‍👧", to: "/kids/enterprise/parents", labelKey: "kids.enterprise.nav.parents" },
  { id: "attendance", emoji: "📋", to: "/kids/enterprise/attendance", labelKey: "kids.enterprise.nav.attendance", staffOnly: true },
  { id: "assignments", emoji: "📝", to: "/kids/enterprise/assignments", labelKey: "kids.enterprise.nav.assignments" },
  { id: "timetable", emoji: "🗓️", to: "/kids/enterprise/timetable", labelKey: "kids.enterprise.nav.timetable" },
  { id: "exams", emoji: "🎓", to: "/kids/enterprise/exams", labelKey: "kids.enterprise.nav.exams" },
  { id: "certificates", emoji: "📜", to: "/kids/enterprise/certificates", labelKey: "kids.enterprise.nav.certificates" },
  { id: "resources", emoji: "📚", to: "/kids/enterprise/resources", labelKey: "kids.enterprise.nav.resources" },
  { id: "communication", emoji: "📢", to: "/kids/enterprise/communication", labelKey: "kids.enterprise.nav.communication" },
  { id: "reports", emoji: "📈", to: "/kids/enterprise/reports", labelKey: "kids.enterprise.nav.reports" },
  { id: "analytics", emoji: "📊", to: "/kids/enterprise/analytics", labelKey: "kids.enterprise.nav.analytics", staffOnly: true },
  { id: "settings", emoji: "⚙️", to: "/kids/enterprise/settings", labelKey: "kids.enterprise.nav.settings", staffOnly: true },
];
