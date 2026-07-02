import { Compass, BrainCircuit, Briefcase } from "lucide-react";
import CareerAptitudeTest from "@/components/CareerAptitudeTest";
import type { StudentProfile } from "@/lib/types";

interface CareerCompassSectionProps {
  displayProfile: StudentProfile;
  showAptitude: boolean;
  onOpenAptitude: () => void;
  onCloseAptitude: () => void;
  onAskJobMarket: () => void;
}

export function CareerCompassSection({
  displayProfile,
  showAptitude,
  onOpenAptitude,
  onCloseAptitude,
  onAskJobMarket,
}: CareerCompassSectionProps) {
  if (showAptitude) {
    return <CareerAptitudeTest profile={displayProfile} onClose={onCloseAptitude} />;
  }

  return (
    <section aria-labelledby="career-compass-heading" className="bg-card p-8 rounded-3xl border border-border shadow-lg">
      <div className="flex items-center gap-4 mb-8 border-b border-border pb-5">
        <div className="p-3 bg-orange-500/10 text-orange-500 rounded-2xl" aria-hidden="true"><Compass className="w-5 h-5" /></div>
        <h2 id="career-compass-heading" className="text-xl font-black text-foreground tracking-tight">بوصلة المستقبل لـ {displayProfile.name}</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <button
          type="button"
          className="text-start p-6 bg-muted/50 rounded-2xl border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-all cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          onClick={onOpenAptitude}
        >
          <BrainCircuit className="w-10 h-10 text-primary mb-4 group-hover:scale-110 transition-transform" aria-hidden="true" />
          <h3 className="font-bold text-lg mb-2 text-foreground">اختبار الميول 2026</h3>
          <p className="text-muted-foreground text-sm">8 أسئلة تفاعلية ومنير يحلل نتائجك</p>
        </button>
        <button
          type="button"
          className="text-start p-6 bg-muted/50 rounded-2xl border-2 border-dashed border-border hover:border-orange-500 hover:bg-orange-500/5 transition-all cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
          onClick={onAskJobMarket}
        >
          <Briefcase className="w-10 h-10 text-orange-500 mb-4 group-hover:scale-110 transition-transform" aria-hidden="true" />
          <h3 className="font-bold text-lg mb-2 text-foreground">سوق العمل العالمي</h3>
          <p className="text-muted-foreground text-sm">الرواتب والوظائف في {displayProfile.country} لهيدي السنة</p>
        </button>
      </div>
    </section>
  );
}
