import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, LayoutDashboard, Users, Trophy, BarChart3, GraduationCap,
  Library, Award, Landmark, Info,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const CARDS = [
  { id: "students", icon: Users, link: "/admin/academy/students", titleKey: "admin.academyHub.card.students.title", descKey: "admin.academyHub.card.students.desc", color: "text-purple-500" },
  { id: "gamification", icon: Trophy, link: "/admin/academy/gamification", titleKey: "admin.academyHub.card.gamification.title", descKey: "admin.academyHub.card.gamification.desc", color: "text-yellow-500" },
  { id: "analytics", icon: BarChart3, link: "/admin/academy/analytics", titleKey: "admin.academyHub.card.analytics.title", descKey: "admin.academyHub.card.analytics.desc", color: "text-cyan-500" },
  { id: "instructorApps", icon: GraduationCap, link: "/admin/instructor-applications", titleKey: "admin.academyHub.card.instructorApps.title", descKey: "admin.academyHub.card.instructorApps.desc", color: "text-emerald-500" },
  { id: "library", icon: Library, link: "/admin/library-resources", titleKey: "admin.academyHub.card.library.title", descKey: "admin.academyHub.card.library.desc", color: "text-violet-500" },
  { id: "scholarships", icon: Award, link: "/admin/scholarships", titleKey: "admin.academyHub.card.scholarships.title", descKey: "admin.academyHub.card.scholarships.desc", color: "text-amber-500" },
  { id: "universities", icon: Landmark, link: "/admin/universities", titleKey: "admin.academyHub.card.universities.title", descKey: "admin.academyHub.card.universities.desc", color: "text-blue-500" },
];

export default function AdminAcademyHub() {
  const { t } = useLanguage();
  return (
    <Layout>
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex items-center gap-3">
          <Button asChild variant="ghost" size="icon"><Link to="/admin" aria-label={t("admin.academyHub.back")}><ArrowLeft className="h-5 w-5" aria-hidden="true" /></Link></Button>
          <LayoutDashboard className="h-6 w-6 text-primary" aria-hidden="true" />
          <div>
            <h1 className="text-3xl font-bold">{t("admin.academyHub.title")}</h1>
            <p className="text-muted-foreground text-sm">{t("admin.academyHub.subtitle")}</p>
          </div>
        </div>

        <div className="mb-6 flex items-start gap-2 p-4 rounded-xl bg-muted/50 border border-border text-sm text-muted-foreground">
          <Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <p>
            {t("admin.academyHub.infoNote")}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((card) => (
            <Link key={card.id} to={card.link}>
              <Card className="transition-all hover:shadow-lg hover:scale-[1.02] cursor-pointer h-full">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{t(card.titleKey)}</CardTitle>
                  <card.icon className={`h-5 w-5 ${card.color}`} aria-hidden="true" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground mt-1">{t(card.descKey)}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </Layout>
  );
}
