import { useLanguage } from "@/contexts/LanguageContext";
import { StaggerGrid, StaggerItem } from "@/components/AnimatedSection";
import { useCareerCompanies, useCareerJobs } from "@/hooks/career/useCareerJobs";
import { companyRowToCard } from "./adapters";
import { CompanyCard } from "./CompanyCard";

export function TopCompanies() {
  const { t } = useLanguage();
  const { companies, isLoading } = useCareerCompanies();
  const { jobs } = useCareerJobs({ limit: 200 });

  if (!isLoading && companies.length === 0) return null;

  return (
    <div>
      <h2 className="type-heading mb-6">{t("careersPage.topCompanies.title")}</h2>
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-44 rounded-2xl border border-border/60 bg-card animate-pulse" aria-hidden="true" />)}
        </div>
      ) : (
        <StaggerGrid className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {companies.map((company) => {
            const openJobs = jobs.filter((j) => j.company_id === company.id).length;
            return (
              <StaggerItem key={company.id}>
                <CompanyCard company={companyRowToCard(company, openJobs)} />
              </StaggerItem>
            );
          })}
        </StaggerGrid>
      )}
    </div>
  );
}
