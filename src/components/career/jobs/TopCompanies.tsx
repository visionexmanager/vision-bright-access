import { useLanguage } from "@/contexts/LanguageContext";
import { StaggerGrid, StaggerItem } from "@/components/AnimatedSection";
import { MOCK_COMPANIES } from "./mockCompanies";
import { CompanyCard } from "./CompanyCard";

export function TopCompanies() {
  const { t } = useLanguage();

  return (
    <div>
      <h2 className="type-heading mb-6">{t("careersPage.topCompanies.title")}</h2>
      <StaggerGrid className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {MOCK_COMPANIES.map((company) => (
          <StaggerItem key={company.id}>
            <CompanyCard company={company} />
          </StaggerItem>
        ))}
      </StaggerGrid>
    </div>
  );
}
