import { Link } from "react-router-dom";
import { Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { AnimatedSection, scaleFade } from "@/components/AnimatedSection";
import { useComingSoon } from "./useComingSoon";

export function CareerHero() {
  const { t } = useLanguage();
  const { playSound } = useSound();
  const handleActivate = useComingSoon();

  return (
    <AnimatedSection variants={scaleFade} className="mx-auto max-w-3xl text-center">
      <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-medium text-primary">
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        {t("careerCenter.badge")}
      </div>
      <h2 id="career-center-heading" className="type-display mb-4 text-balance">
        {t("careerCenter.title")}
      </h2>
      <p className="mb-4 text-lg font-semibold text-primary sm:text-xl">{t("careerCenter.subtitle")}</p>
      <p className="mx-auto mb-8 max-w-2xl text-muted-foreground leading-relaxed">{t("careerCenter.description")}</p>
      <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
        <Link to="/careers">
          <Button size="lg" className="text-lg px-8 py-6 font-semibold" onClick={() => playSound("navigate")}>
            {t("careerCenter.findJobs")} <ArrowRight className="ms-2 h-5 w-5" aria-hidden="true" />
          </Button>
        </Link>
        <Button variant="outline" size="lg" className="text-lg px-8 py-6" onClick={handleActivate}>
          {t("careerCenter.postJob")}
        </Button>
      </div>
    </AnimatedSection>
  );
}
