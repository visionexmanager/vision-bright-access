import { useCallback, useState } from "react";
import { Layout } from "@/components/Layout";
import { Loader2 } from "lucide-react";
import { speakText } from "@/lib/audio/speech";
import { AcademyOnboarding } from "@/components/academy/AcademyOnboarding";
import { AcademyDashboard } from "@/components/academy/AcademyDashboard";
import { useAcademyProfile } from "@/hooks/academy/useAcademyProfile";
import { useLanguage } from "@/contexts/LanguageContext";
import type { StudentProfile } from "@/lib/types";

export default function Academy() {
  const { lang } = useLanguage();
  const speak = useCallback((text: string) => speakText(text, lang, { rate: 0.9 }), [lang]);

  const [formProfile, setFormProfile] = useState<StudentProfile>({ name: "", gender: "male", country: "", level: "" });
  const [step, setStep] = useState(1);

  const { profile, isOnboarded, isLoading: profileLoading, saveProfile, isSaving } = useAcademyProfile();

  const isNextDisabled =
    (step === 1 && !formProfile.name.trim()) ||
    (step === 2 && !formProfile.country) ||
    (step === 3 && !formProfile.level);

  const handleNext = async () => {
    if (step === 1) speak(`أهلاً بك يا ${formProfile.gender === "male" ? "بطل" : "بطلة"}, ${formProfile.name}`);
    if (step === 3) {
      speak(`ممتاز، منهاج الـ ${formProfile.level} في ${formProfile.country} جاهز لك الآن.`);
      await saveProfile(formProfile);
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

  return (
    <Layout>
      <div className="font-sans overflow-x-hidden text-start">
        {!isOnboarded && (
          <AcademyOnboarding
            formProfile={formProfile}
            setFormProfile={setFormProfile}
            step={step}
            isNextDisabled={isNextDisabled}
            isSaving={isSaving}
            onNext={handleNext}
          />
        )}

        {isOnboarded && profile && <AcademyDashboard profile={profile} />}
      </div>
    </Layout>
  );
}
