import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, LayoutDashboard, Users, Trophy, BarChart3, GraduationCap,
  Library, Award, Landmark, Info,
} from "lucide-react";

const CARDS = [
  { id: "students", icon: Users, link: "/admin/academy/students", title: "طلاب الأكاديمية", desc: "تصفّح وابحث في ملفات الطلاب الحقيقية (Supabase)", color: "text-purple-500" },
  { id: "gamification", icon: Trophy, link: "/admin/academy/gamification", title: "إعدادات التلعيب", desc: "عرض كتالوج الإنجازات والشارات والمهام ومعدّلات XP", color: "text-yellow-500" },
  { id: "analytics", icon: BarChart3, link: "/admin/academy/analytics", title: "تحليلات الأكاديمية", desc: "إحصاءات حقيقية عبر جميع المستخدمين حيثما توفّرت", color: "text-cyan-500" },
  { id: "instructorApps", icon: GraduationCap, link: "/admin/instructor-applications", title: "طلبات التدريس", desc: "مراجعة واعتماد طلبات الانضمام كمدرّس", color: "text-emerald-500" },
  { id: "library", icon: Library, link: "/admin/library-resources", title: "المكتبة الرقمية", desc: "إدارة موارد المكتبة", color: "text-violet-500" },
  { id: "scholarships", icon: Award, link: "/admin/scholarships", title: "المنح الدراسية", desc: "إدارة قوائم المنح الدراسية", color: "text-amber-500" },
  { id: "universities", icon: Landmark, link: "/admin/universities", title: "الجامعات", desc: "إدارة دليل الجامعات", color: "text-blue-500" },
];

export default function AdminAcademyHub() {
  return (
    <Layout>
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex items-center gap-3">
          <Button asChild variant="ghost" size="icon"><Link to="/admin" aria-label="العودة إلى لوحة التحكم"><ArrowLeft className="h-5 w-5" aria-hidden="true" /></Link></Button>
          <LayoutDashboard className="h-6 w-6 text-primary" aria-hidden="true" />
          <div>
            <h1 className="text-3xl font-bold">إدارة الأكاديمية</h1>
            <p className="text-muted-foreground text-sm">مركز إدارة موحّد لكل ما يخص أكاديمية VisionEx</p>
          </div>
        </div>

        <div className="mb-6 flex items-start gap-2 p-4 rounded-xl bg-muted/50 border border-border text-sm text-muted-foreground">
          <Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <p>
            الطلاب و تحليلاتهم تُقرأ مباشرة من قاعدة بيانات Supabase (بيانات حقيقية عبر كل المستخدمين).
            بيانات الدورات والشهادات والمدرّسين المُنشأة محلياً (Phase 3–6) لا تزال مخزّنة في متصفح كل مستخدم على حدة —
            لذلك لا تظهر هنا كقوائم شاملة؛ هذا قيد معماري حالي وليس خللاً، وسيُحل عند ربط تلك الأنظمة بقاعدة بيانات حقيقية.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((card) => (
            <Link key={card.id} to={card.link}>
              <Card className="transition-all hover:shadow-lg hover:scale-[1.02] cursor-pointer h-full">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
                  <card.icon className={`h-5 w-5 ${card.color}`} aria-hidden="true" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground mt-1">{card.desc}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </Layout>
  );
}
