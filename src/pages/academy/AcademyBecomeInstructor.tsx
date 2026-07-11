import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  GraduationCap, ArrowRight, ArrowLeft, CheckCircle2, Clock, XCircle, Ban,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { TagInput } from "@/components/academy/ui/TagInput";
import { useInstructorApplication } from "@/hooks/academy/useInstructorApplication";
import type { AcademyInstructorApplicationRow } from "@/lib/types/academy-lms";

const TOTAL_STEPS = 4;

const STATUS_CONFIG: Record<AcademyInstructorApplicationRow["status"], { icon: typeof Clock; label: string; className: string }> = {
  draft: { icon: Clock, label: "مسودة", className: "text-muted-foreground" },
  pending: { icon: Clock, label: "قيد المراجعة", className: "text-yellow-600" },
  approved: { icon: CheckCircle2, label: "مقبول", className: "text-emerald-600" },
  rejected: { icon: XCircle, label: "مرفوض", className: "text-red-600" },
  suspended: { icon: Ban, label: "موقوف", className: "text-red-600" },
};

export default function AcademyBecomeInstructor() {
  const { user } = useAuth();
  const { application, isLoading, saveDraft, submit, resetToDraft } = useInstructorApplication();
  const [step, setStep] = useState(1);

  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [country, setCountry] = useState("");
  const [experienceYears, setExperienceYears] = useState(0);
  const [languages, setLanguages] = useState<string[]>([]);
  const [expertise, setExpertise] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [identityStarted, setIdentityStarted] = useState(false);
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => {
    if (!application) return;
    setHeadline(application.headline);
    setBio(application.bio);
    setCountry(application.country ?? "");
    setExperienceYears(application.experience_years);
    setLanguages(application.languages);
    setExpertise(application.expertise);
    setSkills(application.skills);
    setPortfolioUrl(application.portfolio_url ?? "");
    setIdentityStarted(application.identity_verification_status !== "not_started");
    setAgreementAccepted(application.agreement_accepted);
    setTermsAccepted(application.terms_accepted);
  }, [application?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const persistDraft = useCallback(async () => {
    if (!user) return;
    await saveDraft({
      headline, bio, country: country || null, experience_years: experienceYears,
      languages, expertise, skills, portfolio_url: portfolioUrl || null,
      identity_verification_status: identityStarted ? "submitted" : "not_started",
      agreement_accepted: agreementAccepted, terms_accepted: termsAccepted,
    });
  }, [user, saveDraft, headline, bio, country, experienceYears, languages, expertise, skills, portfolioUrl, identityStarted, agreementAccepted, termsAccepted]);

  const goNext = async () => { await persistDraft(); setStep((s) => Math.min(s + 1, TOTAL_STEPS)); };
  const goBack = () => setStep((s) => Math.max(s - 1, 1));

  const handleSubmit = async () => {
    if (!user) return;
    await persistDraft();
    await submit();
  };

  if (!user) {
    return (
      <Layout>
        <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
          <p className="text-muted-foreground">يجب تسجيل الدخول للتقديم كمدرّس.</p>
          <Button asChild className="rounded-xl"><Link to="/login?returnTo=/academy/instructor/apply">تسجيل الدخول</Link></Button>
        </div>
      </Layout>
    );
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="p-8 max-w-2xl mx-auto text-center text-muted-foreground">جارِ التحميل...</div>
      </Layout>
    );
  }

  // Status view — anything beyond "draft" shows status instead of the form
  if (application && application.status !== "draft") {
    const cfg = STATUS_CONFIG[application.status];
    const Icon = cfg.icon;
    return (
      <Layout>
        <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6 font-sans text-start">
          <div className="bg-card p-8 rounded-3xl border border-border shadow-lg text-center space-y-4">
            <Icon className={`w-12 h-12 mx-auto ${cfg.className}`} aria-hidden="true" />
            <h1 className="text-xl font-black text-foreground">حالة طلبك: {cfg.label}</h1>
            {application.status === "pending" && (
              <p className="text-muted-foreground">طلبك قيد المراجعة من فريق Visionex. سنعلمك فور اتخاذ القرار.</p>
            )}
            {application.status === "approved" && (
              <>
                <p className="text-muted-foreground">تهانينا! أصبحت الآن مدرّساً في أكاديمية Visionex.</p>
                <Button asChild className="rounded-xl"><Link to="/academy/instructor/dashboard">الذهاب إلى لوحة المدرّس</Link></Button>
              </>
            )}
            {application.status === "rejected" && (
              <>
                <p className="text-muted-foreground">{application.review_note ?? "لم يتم قبول طلبك في هذه المرحلة."}</p>
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => { void resetToDraft(); }}
                >
                  تعديل الطلب وإعادة التقديم
                </Button>
              </>
            )}
            {application.status === "suspended" && (
              <p className="text-muted-foreground">{application.review_note ?? "تم تعليق حساب المدرّس الخاص بك. تواصل مع الدعم لمزيد من المعلومات."}</p>
            )}
          </div>
        </div>
      </Layout>
    );
  }

  const isNextDisabled =
    (step === 1 && (!headline.trim() || !bio.trim())) ||
    (step === 4 && (!agreementAccepted || !termsAccepted));

  return (
    <Layout>
      <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6 font-sans text-start">
        <Button variant="ghost" size="sm" asChild className="gap-1 rounded-xl">
          <Link to="/academy"><ArrowLeft className="w-4 h-4" aria-hidden="true" />العودة إلى الأكاديمية</Link>
        </Button>

        <div className="bg-card rounded-3xl border border-border shadow-lg overflow-hidden">
          <Progress value={(step / TOTAL_STEPS) * 100} className="h-1.5 rounded-none" />
          <div className="p-6 md:p-10 space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 text-primary rounded-2xl" aria-hidden="true"><GraduationCap className="w-6 h-6" /></div>
              <div>
                <h1 className="text-xl font-black text-foreground">كن مدرّساً في Visionex</h1>
                <p className="text-sm text-muted-foreground">الخطوة {step} من {TOTAL_STEPS}</p>
              </div>
            </div>

            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="app-headline" className="text-sm font-bold text-foreground">العنوان المهني</label>
                  <Input id="app-headline" value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="مثال: مطوّر تطبيقات موبايل بخبرة 5 سنوات" className="rounded-xl mt-1.5" />
                </div>
                <div>
                  <label htmlFor="app-bio" className="text-sm font-bold text-foreground">نبذة عنك</label>
                  <Textarea id="app-bio" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="حدّثنا عن خبرتك وشغفك بالتعليم..." className="rounded-xl mt-1.5 min-h-28" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="app-country" className="text-sm font-bold text-foreground">البلد</label>
                    <Input id="app-country" value={country} onChange={(e) => setCountry(e.target.value)} className="rounded-xl mt-1.5" />
                  </div>
                  <div>
                    <label htmlFor="app-experience" className="text-sm font-bold text-foreground">سنوات الخبرة</label>
                    <Input id="app-experience" type="number" min={0} value={experienceYears} onChange={(e) => setExperienceYears(Number(e.target.value))} className="rounded-xl mt-1.5" />
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <label className="text-sm font-bold text-foreground">مجالات الخبرة</label>
                  <div className="mt-1.5"><TagInput values={expertise} onChange={setExpertise} placeholder="مثال: تطوير الويب" /></div>
                </div>
                <div>
                  <label className="text-sm font-bold text-foreground">المهارات</label>
                  <div className="mt-1.5"><TagInput values={skills} onChange={setSkills} placeholder="مثال: React" /></div>
                </div>
                <div>
                  <label className="text-sm font-bold text-foreground">اللغات</label>
                  <div className="mt-1.5"><TagInput values={languages} onChange={setLanguages} placeholder="مثال: العربية" /></div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <label htmlFor="app-portfolio" className="text-sm font-bold text-foreground">رابط معرض الأعمال (اختياري)</label>
                  <Input id="app-portfolio" value={portfolioUrl} onChange={(e) => setPortfolioUrl(e.target.value)} placeholder="https://..." className="rounded-xl mt-1.5" />
                </div>
                <div className="p-5 rounded-2xl border-2 border-dashed border-border space-y-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-primary" aria-hidden="true" />
                    <p className="font-bold text-foreground text-sm">التحقق من الهوية</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    رفع وثائق التحقق من الهوية قيد التطوير حالياً. يمكنك إشارة نيتك بالتحقق والمتابعة لاحقاً.
                  </p>
                  <Button type="button" variant={identityStarted ? "default" : "outline"} size="sm" onClick={() => setIdentityStarted(true)} className="rounded-xl">
                    {identityStarted ? "تم تسجيل النية بالتحقق ✓" : "بدء التحقق من الهوية"}
                  </Button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <label className="flex items-start gap-3 p-4 rounded-2xl border border-border cursor-pointer hover:bg-muted/50">
                  <input type="checkbox" checked={agreementAccepted} onChange={(e) => setAgreementAccepted(e.target.checked)} className="mt-1 w-4 h-4" />
                  <span className="text-sm text-foreground">أوافق على <strong>اتفاقية المدرّسين</strong> الخاصة بأكاديمية Visionex.</span>
                </label>
                <label className="flex items-start gap-3 p-4 rounded-2xl border border-border cursor-pointer hover:bg-muted/50">
                  <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="mt-1 w-4 h-4" />
                  <span className="text-sm text-foreground">أوافق على <strong>الشروط والأحكام</strong> وسياسة الخصوصية.</span>
                </label>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <Button variant="outline" onClick={goBack} disabled={step === 1} className="gap-2 rounded-xl">
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
                السابق
              </Button>
              {step < TOTAL_STEPS ? (
                <Button onClick={goNext} disabled={isNextDisabled} className="gap-2 rounded-xl">
                  التالي
                  <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={isNextDisabled} className="gap-2 rounded-xl">
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  إرسال الطلب
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
