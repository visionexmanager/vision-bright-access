import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Bell } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AcademySectionHeader } from "@/components/academy/ui/AcademySectionHeader";
import { NotificationHistoryList } from "@/components/academy/notifications/NotificationHistoryList";

export default function AcademyNotifications() {
  const { user } = useAuth();

  if (!user) {
    return (
      <Layout>
        <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
          <p className="text-muted-foreground">يجب تسجيل الدخول لعرض إشعاراتك.</p>
          <Button asChild className="rounded-xl"><Link to="/login?returnTo=/academy/notifications">تسجيل الدخول</Link></Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-8 font-sans text-start">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-4 gap-1 rounded-xl">
            <Link to="/academy">
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              العودة إلى الأكاديمية
            </Link>
          </Button>
          <AcademySectionHeader
            icon={Bell}
            title="الإشعارات"
            description="كل إشعاراتك في الأكاديمية وVisionEx في مكان واحد"
            headingId="notifications-heading"
          />
        </div>

        <NotificationHistoryList />
      </div>
    </Layout>
  );
}
