import { useMemo, useState, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, BookOpen, Users, Star, Plus, Clock, CheckCircle2, XCircle, Ban,
  MessageCircle, Wallet, Banknote,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { InstructorDashboardNav, getSectionLabel, type InstructorDashboardSection } from "@/components/academy/instructor/InstructorDashboardNav";
import { InstructorCoursesSection } from "@/components/academy/instructor/InstructorCoursesSection";
import { InstructorStudentsSection } from "@/components/academy/instructor/InstructorStudentsSection";
import { InstructorReviewsSection } from "@/components/academy/instructor/InstructorReviewsSection";
import { InstructorAnalyticsSection } from "@/components/academy/instructor/InstructorAnalyticsSection";
import { InstructorAnnouncementsSection } from "@/components/academy/instructor/InstructorAnnouncementsSection";
import { InstructorSettingsSection } from "@/components/academy/instructor/InstructorSettingsSection";
import { InstructorAssignmentsSection } from "@/components/academy/instructor/InstructorAssignmentsSection";
import { InstructorQuizzesSection } from "@/components/academy/instructor/InstructorQuizzesSection";
import { InstructorProjectsSection } from "@/components/academy/instructor/InstructorProjectsSection";
import { InstructorCertificatesSection } from "@/components/academy/instructor/InstructorCertificatesSection";
import { InstructorContentSection } from "@/components/academy/instructor/InstructorContentSection";
import { InstructorMediaSection } from "@/components/academy/instructor/InstructorMediaSection";
import { NotificationHistoryList } from "@/components/academy/notifications/NotificationHistoryList";
import { AcademyPlaceholderSection } from "@/components/academy/ui/AcademyPlaceholderSection";
import { AcademySectionHeader } from "@/components/academy/ui/AcademySectionHeader";
import {
  getMyApplication, getOrCreateMyInstructorProfile, getMyCoursesLocal,
  getAnnouncementsForInstructor,
} from "@/lib/academy/instructorLocalStore";
import type { AcademyInstructorRow } from "@/lib/types/academy-modules";

const PLACEHOLDER_META: Record<string, { icon: typeof BookOpen; description: string }> = {
  messages: { icon: MessageCircle, description: "مراسلة الطلاب مباشرة قيد التطوير." },
  revenue: { icon: Wallet, description: "لوحة الإيرادات قيد التحضير — لا معالجة دفعات بعد." },
  payouts: { icon: Banknote, description: "الدفعات المالية قيد التحضير — لا توزيع أرباح بعد." },
};

export default function AcademyInstructorDashboard() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const section = (searchParams.get("section") as InstructorDashboardSection) || "overview";

  const [refreshKey, setRefreshKey] = useState(0);
  const bump = useCallback(() => setRefreshKey((k) => k + 1), []);

  const application = user ? getMyApplication(user.id) : null;
  const instructor: AcademyInstructorRow | null = user ? getOrCreateMyInstructorProfile(user.id) : null;

  const courses = useMemo(() => (instructor ? getMyCoursesLocal(instructor.id) : []), [instructor, refreshKey]);
  const announcements = useMemo(() => (instructor ? getAnnouncementsForInstructor(instructor.id) : []), [instructor, refreshKey]);

  if (!user) {
    return (
      <Layout>
        <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
          <p className="text-muted-foreground">يجب تسجيل الدخول للوصول إلى لوحة المدرّس.</p>
          <Button asChild className="rounded-xl"><Link to="/login?returnTo=/academy/instructor/dashboard">تسجيل الدخول</Link></Button>
        </div>
      </Layout>
    );
  }

  if (!instructor) {
    const status = application?.status ?? null;
    const statusInfo = {
      pending: { icon: Clock, text: "طلبك قيد المراجعة حالياً.", className: "text-yellow-600" },
      rejected: { icon: XCircle, text: "لم يتم قبول طلبك بعد. يمكنك مراجعته وإعادة التقديم.", className: "text-red-600" },
      suspended: { icon: Ban, text: "تم تعليق حساب المدرّس الخاص بك.", className: "text-red-600" },
      draft: { icon: CheckCircle2, text: "أكمل طلبك لتصبح مدرّساً.", className: "text-muted-foreground" },
    }[status ?? "draft"];
    const Icon = statusInfo.icon;
    return (
      <Layout>
        <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
          <Icon className={`w-12 h-12 mx-auto ${statusInfo.className}`} aria-hidden="true" />
          <p className="text-muted-foreground">{statusInfo.text}</p>
          <Button asChild className="rounded-xl"><Link to="/academy/instructor/apply">{status ? "عرض طلبي" : "التقديم كمدرّس"}</Link></Button>
        </div>
      </Layout>
    );
  }

  const renderSection = () => {
    switch (section) {
      case "courses":
        return <InstructorCoursesSection courses={courses} onCoursesChange={bump} />;
      case "students":
        return <InstructorStudentsSection courses={courses} />;
      case "reviews":
        return <InstructorReviewsSection courses={courses} instructorId={instructor.id} />;
      case "announcements":
        return (
          <InstructorAnnouncementsSection
            instructorId={instructor.id}
            courses={courses}
            announcements={announcements}
            onAnnouncementsChange={bump}
          />
        );
      case "assignments":
        return <InstructorAssignmentsSection courses={courses} graderUserId={user.id} refreshKey={refreshKey} onGraded={bump} />;
      case "quizzes":
        return <InstructorQuizzesSection courses={courses} />;
      case "projects":
        return <InstructorProjectsSection courses={courses} reviewerUserId={user.id} refreshKey={refreshKey} onReviewed={bump} />;
      case "certificates":
        return <InstructorCertificatesSection courses={courses} />;
      case "analytics":
        return <InstructorAnalyticsSection instructor={instructor} courses={courses} />;
      case "content":
        return <InstructorContentSection courses={courses} />;
      case "media":
        return <InstructorMediaSection courses={courses} />;
      case "notifications":
        return <NotificationHistoryList />;
      case "settings":
        return <InstructorSettingsSection instructor={instructor} onSaved={bump} />;
      case "overview":
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-muted/50 rounded-2xl border border-border p-5 text-center">
                <BookOpen className="w-6 h-6 mx-auto text-primary mb-2" aria-hidden="true" />
                <p className="text-2xl font-black text-foreground">{courses.length}</p>
                <p className="text-xs text-muted-foreground mt-1">دوراتي</p>
              </div>
              <div className="bg-muted/50 rounded-2xl border border-border p-5 text-center">
                <Users className="w-6 h-6 mx-auto text-primary mb-2" aria-hidden="true" />
                <p className="text-2xl font-black text-foreground">{courses.reduce((s, c) => s + c.students_count, 0).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">الطلاب</p>
              </div>
              <div className="bg-muted/50 rounded-2xl border border-border p-5 text-center">
                <Star className="w-6 h-6 mx-auto text-primary mb-2" aria-hidden="true" />
                <p className="text-2xl font-black text-foreground">{instructor.rating != null ? instructor.rating.toFixed(1) : "—"}</p>
                <p className="text-xs text-muted-foreground mt-1">التقييم</p>
              </div>
            </div>
            <Button asChild className="gap-2 rounded-xl">
              <Link to="/academy/instructor/courses/new"><Plus className="w-4 h-4" aria-hidden="true" />إنشاء دورة جديدة</Link>
            </Button>
            {courses.length === 0 && (
              <p className="text-sm text-muted-foreground">ابدأ بإنشاء دورتك الأولى من قسم "دوراتي".</p>
            )}
          </div>
        );
      default: {
        const meta = PLACEHOLDER_META[section];
        return (
          <AcademyPlaceholderSection
            icon={meta?.icon ?? BookOpen}
            title={getSectionLabel(section)}
            description={meta?.description}
            headingId={`instructor-${section}-heading`}
          />
        );
      }
    }
  };

  return (
    <Layout>
      <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6 font-sans text-start">
        <AcademySectionHeader
          icon={LayoutDashboard}
          title={`لوحة المدرّس — ${instructor.name}`}
          description="إدارة دوراتك وطلابك وأداءك في مكان واحد"
          headingId="instructor-dashboard-heading"
          action={
            <Button variant="outline" size="sm" asChild className="rounded-xl">
              <Link to={`/academy/instructors/${instructor.id}`}>عرض ملفي العام</Link>
            </Button>
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-3">
            <InstructorDashboardNav active={section} />
          </div>
          <div className="lg:col-span-9 bg-card p-6 md:p-8 rounded-3xl border border-border shadow-sm">
            <h2 className="text-lg font-black text-foreground mb-6">{getSectionLabel(section)}</h2>
            {renderSection()}
          </div>
        </div>
      </div>
    </Layout>
  );
}
