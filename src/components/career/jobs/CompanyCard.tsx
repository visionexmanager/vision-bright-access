import { Star } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useComingSoon } from "@/components/career/useComingSoon";
import { CompanyAvatar } from "./CompanyAvatar";
import type { Company } from "./types";

interface CompanyCardProps {
  company: Company;
}

export function CompanyCard({ company }: CompanyCardProps) {
  const { t } = useLanguage();
  const handleComingSoon = useComingSoon();

  return (
    <button
      type="button"
      onClick={handleComingSoon}
      className="group flex w-full flex-col items-center gap-3 rounded-2xl border border-border/60 bg-card p-6 text-center transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg focus-visible:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <CompanyAvatar name={company.name} color={company.logoColor} size="lg" />
      <div>
        <h3 className="font-bold">{company.name}</h3>
        <p className="text-sm text-muted-foreground">{company.industry}</p>
      </div>
      <div className="flex items-center gap-1 text-sm font-medium">
        <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />
        {company.rating.toFixed(1)}
      </div>
      <p className="text-xs text-muted-foreground">
        {company.openJobs} {t("careersPage.company.openJobs")}
      </p>
    </button>
  );
}
