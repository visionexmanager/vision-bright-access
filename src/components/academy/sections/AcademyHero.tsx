import { memo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Zap, PlayCircle, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { StudentProfile } from "@/lib/types";

interface AcademyHeroProps {
  displayProfile: StudentProfile;
  totalPoints: number;
  onContinueLearning: () => void;
  onOpenAILearning: () => void;
}

export const AcademyHero = memo(function AcademyHero({
  displayProfile,
  totalPoints,
  onContinueLearning,
  onOpenAILearning,
}: AcademyHeroProps) {
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState("");

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!searchValue.trim()) return;
    navigate(`/academy/search?q=${encodeURIComponent(searchValue.trim())}`);
  };

  return (
    <section
      aria-labelledby="academy-hero-heading"
      className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-card to-card rounded-3xl border border-border shadow-lg p-6 md:p-10"
    >
      <Sparkles className="absolute -left-6 -top-6 w-32 h-32 text-primary/10 rotate-12" aria-hidden="true" />

      <div className="relative flex flex-col gap-6">
        <div>
          <h1 id="academy-hero-heading" className="text-2xl md:text-3xl font-black text-foreground">
            أهلاً {displayProfile.gender === "male" ? "بالبطل" : "بالبطلة"} {displayProfile.name} ✨
          </h1>
          <div className="flex flex-wrap gap-2 mt-2.5">
            <span className="px-2.5 py-0.5 bg-primary/10 text-primary rounded-lg text-xs font-bold border border-primary/20">{displayProfile.level}</span>
            <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-600 rounded-lg text-xs font-bold border border-emerald-500/20">منهاج {displayProfile.country}</span>
            <span className="px-2.5 py-0.5 bg-yellow-400/10 text-yellow-600 rounded-lg text-xs font-bold border border-yellow-400/20">
              <Zap className="inline w-3 h-3 me-1" aria-hidden="true" />{totalPoints.toLocaleString()} VX
            </span>
          </div>
        </div>

        <form
          onSubmit={handleSearchSubmit}
          className="relative max-w-xl"
          role="search"
          aria-label="بحث في الأكاديمية"
        >
          <label htmlFor="academy-search-input" className="sr-only">
            ابحث عن دورة، مدرّس، أو مورد
          </label>
          <div className="relative">
            <Search className="absolute start-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="academy-search-input"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="ابحث عن دورة، مدرّس، منحة، جامعة، أو مورد..."
              className="ps-11 py-5 rounded-2xl bg-background/60"
            />
          </div>
        </form>

        <div className="flex flex-wrap gap-3">
          <Button onClick={onContinueLearning} className="gap-2 rounded-xl py-5 px-6 font-bold">
            <PlayCircle className="w-4 h-4" aria-hidden="true" />
            متابعة التعلم
          </Button>
          <Button onClick={onOpenAILearning} variant="outline" className="gap-2 rounded-xl py-5 px-6 font-bold">
            <Sparkles className="w-4 h-4" aria-hidden="true" />
            التعلم الذكي مع منير
          </Button>
        </div>
      </div>
    </section>
  );
});
