import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { User, Globe, GraduationCap, ArrowRight, Star, Loader2 } from "lucide-react";
import type { StudentProfile } from "@/lib/types";

export const ACADEMY_ONBOARDING_COUNTRIES = ["لبنان", "مصر", "السعودية", "تركيا", "أمريكا", "بلد آخر"];
export const ACADEMY_ONBOARDING_LEVELS    = ["ابتدائي", "متوسط", "ثانوي / بكالوريا", "جامعي / دراسات"];
const COUNTRIES = ACADEMY_ONBOARDING_COUNTRIES;
const LEVELS    = ACADEMY_ONBOARDING_LEVELS;

interface AcademyOnboardingProps {
  formProfile: StudentProfile;
  setFormProfile: (profile: StudentProfile) => void;
  step: number;
  isNextDisabled: boolean;
  isSaving: boolean;
  onNext: () => void;
}

export function AcademyOnboarding({
  formProfile,
  setFormProfile,
  step,
  isNextDisabled,
  isSaving,
  onNext,
}: AcademyOnboardingProps) {
  return (
    <div className="flex items-center justify-center min-h-[80vh] p-6 bg-gradient-to-br from-background to-muted/40">
      <div className="w-full max-w-xl bg-card rounded-3xl shadow-xl border border-border text-center relative overflow-hidden">
        {/* Progress bar — flush to top */}
        <Progress value={(step / 3) * 100} className="absolute top-0 left-0 w-full h-1.5 rounded-none" />

        {/* Step indicator */}
        <div className="flex justify-center gap-1.5 pt-8 px-10">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={`h-1 flex-1 rounded-full transition-all duration-500 ${n <= step ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>

        <div className="px-8 md:px-12 pb-10 pt-6">

          {step === 1 && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-400">
              {/* Unified icon container — same style all steps */}
              <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto text-primary">
                <User className="w-10 h-10" />
              </div>
              <div>
                <h2 className="type-subhead text-foreground">شو اسمك؟</h2>
                <p className="type-caption mt-1">الخطوة 1 من 3 — التعريف بنفسك</p>
              </div>
              <Input
                value={formProfile.name}
                onChange={(e) => setFormProfile({ ...formProfile, name: e.target.value })}
                className="text-center text-xl py-5 rounded-xl"
                placeholder="اسمي هو..."
                onKeyDown={(e) => e.key === "Enter" && !isNextDisabled && onNext()}
              />
              <div className="flex gap-3">
                <Button
                  variant={formProfile.gender === "male" ? "default" : "outline"}
                  className="flex-1 py-5 text-base font-semibold rounded-xl"
                  onClick={() => setFormProfile({ ...formProfile, gender: "male" })}
                >
                  ذكر
                </Button>
                <Button
                  variant={formProfile.gender === "female" ? "default" : "outline"}
                  className="flex-1 py-5 text-base font-semibold rounded-xl"
                  onClick={() => setFormProfile({ ...formProfile, gender: "female" })}
                >
                  أنثى
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in fade-in duration-400">
              <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto text-primary">
                <Globe className="w-10 h-10" />
              </div>
              <div>
                <h2 className="type-subhead text-foreground">من أي بلد؟</h2>
                <p className="type-caption mt-1">الخطوة 2 من 3 — المنهاج الدراسي</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {COUNTRIES.map((c) => (
                  <Button
                    key={c}
                    variant={formProfile.country === c ? "default" : "outline"}
                    className="h-auto py-3.5 rounded-xl font-semibold text-sm"
                    onClick={() => setFormProfile({ ...formProfile, country: c })}
                  >
                    {c}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-in zoom-in-95 duration-400">
              <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto text-primary">
                <GraduationCap className="w-10 h-10" />
              </div>
              <div>
                <h2 className="type-subhead text-foreground">ما مستواك الدراسي؟</h2>
                <p className="type-caption mt-1">الخطوة 3 من 3 — تخصيص المحتوى</p>
              </div>
              <div className="grid grid-cols-1 gap-2.5">
                {LEVELS.map((l) => (
                  <Button
                    key={l}
                    variant={formProfile.level === l ? "default" : "outline"}
                    className="h-auto py-4 rounded-xl text-start flex justify-between items-center"
                    onClick={() => setFormProfile({ ...formProfile, level: l })}
                  >
                    <span className="font-semibold">{l}</span>
                    {formProfile.level === l && <Star className="fill-current w-4 h-4 opacity-80" />}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <Button
            onClick={onNext}
            disabled={isNextDisabled || isSaving}
            size="lg"
            className="mt-8 w-full py-5 rounded-xl font-bold text-base"
          >
            {isSaving
              ? <><Loader2 className="w-4 h-4 animate-spin me-2" /> جاري الحفظ...</>
              : <>متابعة <ArrowRight className="w-4 h-4 rotate-180 ms-2" /></>
            }
          </Button>
        </div>
      </div>
    </div>
  );
}
