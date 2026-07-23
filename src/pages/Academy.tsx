import { useCallback, useState } from "react";
import { Layout } from "@/components/Layout";
import { Loader2 } from "lucide-react";
import { speakText } from "@/lib/audio/speech";
import { AcademyOnboarding } from "@/components/academy/AcademyOnboarding";
import { AcademyDashboard } from "@/components/academy/AcademyDashboard";
import { useAcademyProfile } from "@/hooks/academy/useAcademyProfile";
import { useLanguage } from "@/contexts/LanguageContext";
import type { StudentProfile } from "@/lib/types";
import { AcademyErrorState } from "@/components/academy/ui/AcademyErrorState";

export default function Academy() {
  const { lang } = useLanguage();
  const speak = useCallback((text: string) => speakText(text, lang, { rate: 0.9 }), [lang]);

  const [formProfile, setFormProfile] = useState<StudentProfile>({ name: "", gender: "male", country: "", level: "" });
  const [step, setStep] = useState(1);

  const {
    profile, isOnboarded, isLoading: profileLoading,
    error: profileError, retry, saveProfile, isSaving,
  } = useAcademyProfile();
  const [saveError, setSaveError] = useState<string | null>(null);

  const isNextDisabled =
    (step === 1 && !formProfile.name.trim()) ||
    (step === 2 && !formProfile.country) ||
    (step === 3 && !formProfile.level);

  const handleNext = async () => {
    if (step === 1) speak(`أهلاً بك يا ${formProfile.gender === "male" ? "بطل" : "بطلة"}, ${formProfile.name}`);
    if (step === 3) {
      speak(`ممتاز، منهاج الـ ${formProfile.level} في ${formProfile.country} جاهز لك الآن.`);
      setSaveError(null);
      try {
        await saveProfile(formProfile);
      } catch {
        setSaveError(lang === "ar"
          ? "تعذر حفظ ملف الأكاديمية. تحقق من الاتصال ثم أعد المحاولة."
          : "Your Academy profile could not be saved. Check your connection and try again.");
      }
      return;
    }
    setStep(step + 1);
  };

  if (profileLoading) {
    return (
      <Layout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (profileError) {
    return (
      <Layout>
        <AcademyErrorState
          className="mx-auto min-h-[50vh] max-w-xl justify-center"
          message={lang === "ar"
            ? "تعذر تحميل الأكاديمية. تحقق من الاتصال ثم أعد المحاولة."
            : "The Academy could not be loaded. Check your connection and try again."}
          onRetry={() => void retry()}
        />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="font-sans overflow-x-hidden text-start">
        {!isOnboarded && (
          <>
            {saveError && <AcademyErrorState message={saveError} className="mx-auto max-w-xl" />}
            <AcademyOnboarding
              formProfile={formProfile}
              setFormProfile={setFormProfile}
              step={step}
              isNextDisabled={isNextDisabled}
              isSaving={isSaving}
              onNext={handleNext}
            />
          </>
        )}

        {isOnboarded && profile && <AcademyDashboard profile={profile} />}
      </div>
    </Layout>
  );
}
