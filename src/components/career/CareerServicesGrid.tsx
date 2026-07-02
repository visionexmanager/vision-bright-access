import { StaggerGrid, StaggerItem } from "@/components/AnimatedSection";
import { CAREER_SERVICE_CARDS } from "./data";
import { CareerServiceCard } from "./CareerServiceCard";

export function CareerServicesGrid() {
  return (
    <StaggerGrid className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {CAREER_SERVICE_CARDS.map((card) => (
        <StaggerItem key={card.id}>
          <CareerServiceCard card={card} />
        </StaggerItem>
      ))}
    </StaggerGrid>
  );
}
