import { useLanguage } from "@/contexts/LanguageContext";
import { StaggerGrid, StaggerItem } from "@/components/AnimatedSection";
import { CareerServiceCard } from "@/components/career/CareerServiceCard";
import { CAREER_TOOLS } from "./mockTools";

export function CareerToolsGrid() {
  const { t } = useLanguage();

  return (
    <div>
      <h2 className="type-heading mb-6">{t("careersPage.tools.title")}</h2>
      <StaggerGrid className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {CAREER_TOOLS.map((tool) => (
          <StaggerItem key={tool.id}>
            <CareerServiceCard card={tool} />
          </StaggerItem>
        ))}
      </StaggerGrid>
    </div>
  );
}
