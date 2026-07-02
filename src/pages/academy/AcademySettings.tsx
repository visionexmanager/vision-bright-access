import { useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Settings, User, Eye, Lock, Loader2, Save, ExternalLink } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useThemeToggle } from "@/contexts/ThemeContext";
import { AcademySectionHeader } from "@/components/academy/ui/AcademySectionHeader";
import { useAcademyProfile } from "@/hooks/academy/useAcademyProfile";
import { ACADEMY_ONBOARDING_COUNTRIES, ACADEMY_ONBOARDING_LEVELS } from "@/components/academy/AcademyOnboarding";
import {
  getAcademyTextScale, setAcademyTextScale, getAcademyReduceMotion, setAcademyReduceMotion,
  type AcademyTextScale,
} from "@/lib/academy/accessibilityPrefs";
import { getLeaderboardPrivacy, setLeaderboardPrivacy } from "@/lib/academy/gamificationLocalStore";
import type { StudentProfile } from "@/lib/types";

type Tab = "account" | "accessibility" | "privacy";

const TEXT_SCALE_LABEL: Record<AcademyTextScale, string> = { normal: "عادي", large: "كبير", "extra-large": "كبير جداً" };
const THEME_LABEL: Record<string, string> = { light: "فاتح", dark: "داكن", "high-contrast": "تباين عالٍ" };

export default function AcademySettings() {
  const { user } = useAuth();
  const { profile, isLoading, saveProfile, isSaving } = useAcademyProfile();
  const { theme, setTheme } = useThemeToggle();
  const [tab, setTab] = useState<Tab>("account");

  const [form, setForm] = useState<StudentProfile | null>(null);
  const [textScaleVersion, setTextScaleVersion] = useState(0);
  const [privacyVersion, setPrivacyVersion] = useState(0);

  const textScale = getAcademyTextScale();
  const reduceMotion = getAcademyReduceMotion();
  const privacy = user ? getLeaderboardPrivacy(user.id) : null;

  if (!user) {
    return (
      <Layout>
        <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
          <p className="text-muted-foreground">يجب تسجيل الدخول لإدارة إعداداتك.</p>
          <Button asChild className="rounded-xl"><Link to="/login?returnTo=/academy/settings">تسجيل الدخول</Link></Button>
        </div>
      </Layout>
    );
  }

  const active = form ?? profile ?? { name: "", gender: "male", country: ACADEMY_ONBOARDING_COUNTRIES[0], level: ACADEMY_ONBOARDING_LEVELS[0] };

  const handleSaveAccount = async () => {
    await saveProfile(active);
    setForm(null);
  };

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
            icon={Settings}
            title="الإعدادات"
            description="حسابك، إمكانية الوصول، والخصوصية"
            headingId="settings-heading"
          />
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList>
            <TabsTrigger value="account" className="gap-1.5"><User className="w-3.5 h-3.5" aria-hidden="true" />الحساب</TabsTrigger>
            <TabsTrigger value="accessibility" className="gap-1.5"><Eye className="w-3.5 h-3.5" aria-hidden="true" />إمكانية الوصول</TabsTrigger>
            <TabsTrigger value="privacy" className="gap-1.5"><Lock className="w-3.5 h-3.5" aria-hidden="true" />الخصوصية</TabsTrigger>
          </TabsList>
        </Tabs>

        {tab === "account" && (
          isLoading ? (
            <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>
          ) : (
            <div className="bg-card p-6 rounded-2xl border border-border space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="settings-name">الاسم</Label>
                <input
                  id="settings-name"
                  value={active.name}
                  onChange={(e) => setForm({ ...active, name: e.target.value })}
                  className="w-full p-3 rounded-xl border border-border bg-background text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label>الجنس</Label>
                <div className="flex gap-2">
                  <Button type="button" variant={active.gender === "male" ? "default" : "outline"} size="sm" className="rounded-xl" onClick={() => setForm({ ...active, gender: "male" })}>ذكر</Button>
                  <Button type="button" variant={active.gender === "female" ? "default" : "outline"} size="sm" className="rounded-xl" onClick={() => setForm({ ...active, gender: "female" })}>أنثى</Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>البلد</Label>
                <div className="flex flex-wrap gap-2">
                  {ACADEMY_ONBOARDING_COUNTRIES.map((c) => (
                    <Button key={c} type="button" variant={active.country === c ? "default" : "outline"} size="sm" className="rounded-xl" onClick={() => setForm({ ...active, country: c })}>{c}</Button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>المستوى الدراسي</Label>
                <div className="flex flex-wrap gap-2">
                  {ACADEMY_ONBOARDING_LEVELS.map((l) => (
                    <Button key={l} type="button" variant={active.level === l ? "default" : "outline"} size="sm" className="rounded-xl" onClick={() => setForm({ ...active, level: l })}>{l}</Button>
                  ))}
                </div>
              </div>

              <Button onClick={handleSaveAccount} disabled={isSaving || !active.name.trim()} className="gap-2 rounded-xl">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Save className="w-4 h-4" aria-hidden="true" />}
                حفظ التغييرات
              </Button>
            </div>
          )
        )}

        {tab === "accessibility" && (
          <div className="space-y-4">
            <div className="bg-card p-6 rounded-2xl border border-border space-y-3">
              <p className="text-sm font-bold text-foreground">المظهر وتباين الألوان</p>
              <p className="text-xs text-muted-foreground">المظهر الحالي: <span className="font-bold text-foreground">{THEME_LABEL[theme] ?? theme}</span></p>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant={theme === "light" ? "default" : "outline"} className="rounded-xl" onClick={() => setTheme("light")}>فاتح</Button>
                <Button type="button" size="sm" variant={theme === "dark" ? "default" : "outline"} className="rounded-xl" onClick={() => setTheme("dark")}>داكن</Button>
                <Button type="button" size="sm" variant={theme === "high-contrast" ? "default" : "outline"} className="rounded-xl" onClick={() => setTheme("high-contrast")}>تباين عالٍ</Button>
              </div>
              <Link to="/settings" className="flex items-center gap-1 text-xs text-primary hover:underline w-fit">
                إعدادات المظهر الكاملة
                <ExternalLink className="w-3 h-3" aria-hidden="true" />
              </Link>
            </div>

            <div className="bg-card p-6 rounded-2xl border border-border space-y-3">
              <p className="text-sm font-bold text-foreground">حجم النص</p>
              <div className="flex gap-2">
                {(Object.keys(TEXT_SCALE_LABEL) as AcademyTextScale[]).map((scale) => (
                  <Button
                    key={scale}
                    type="button"
                    size="sm"
                    variant={textScale === scale ? "default" : "outline"}
                    className="rounded-xl"
                    onClick={() => { setAcademyTextScale(scale); setTextScaleVersion((v) => v + 1); }}
                  >
                    {TEXT_SCALE_LABEL[scale]}
                  </Button>
                ))}
              </div>
            </div>

            <div className="bg-card p-6 rounded-2xl border border-border flex items-center justify-between gap-4" key={textScaleVersion}>
              <div>
                <Label htmlFor="reduce-motion-toggle" className="text-sm font-bold text-foreground cursor-pointer">تقليل الحركة</Label>
                <p className="text-xs text-muted-foreground mt-1">يوقف الانتقالات والحركات المتحركة بغض النظر عن إعداد نظام التشغيل.</p>
              </div>
              <Switch
                id="reduce-motion-toggle"
                checked={reduceMotion}
                onCheckedChange={(checked) => { setAcademyReduceMotion(checked); setTextScaleVersion((v) => v + 1); }}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              مصمّمة للعمل مع قارئات الشاشة (NVDA وJAWS وVoiceOver وTalkBack) والتنقل الكامل عبر لوحة المفاتيح — لم يتم اختبارها آلياً بقارئ شاشة فعلي في هذه البيئة، يُنصح بمراجعة يدوية.
            </p>
          </div>
        )}

        {tab === "privacy" && privacy && (
          <div className="bg-card p-6 rounded-2xl border border-border flex items-center justify-between gap-4" key={privacyVersion}>
            <div>
              <Label htmlFor="privacy-leaderboard-toggle" className="text-sm font-bold text-foreground cursor-pointer">الظهور في لوحة المتصدرين</Label>
              <p className="text-xs text-muted-foreground mt-1">عند إيقافه، لن يظهر اسمك للآخرين في لوحة متصدري الأكاديمية.</p>
            </div>
            <Switch
              id="privacy-leaderboard-toggle"
              checked={privacy.visible_on_leaderboards}
              onCheckedChange={(checked) => { setLeaderboardPrivacy(user.id, checked, privacy.visible_display_name); setPrivacyVersion((v) => v + 1); }}
            />
          </div>
        )}
      </div>
    </Layout>
  );
}
