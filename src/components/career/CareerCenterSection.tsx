import { AnimatedSection } from "@/components/AnimatedSection";
import { CareerHero } from "./CareerHero";
import { CareerStats } from "./CareerStats";
import { CareerServicesGrid } from "./CareerServicesGrid";

export function CareerCenterSection() {
  return (
    <section className="relative overflow-hidden py-20" aria-labelledby="career-center-heading">
      <div className="absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,hsl(var(--primary)/0.10),transparent)]" />
      </div>
      <div className="section-container relative z-10 flex flex-col gap-14">
        <CareerHero />
        <AnimatedSection className="mx-auto w-full max-w-4xl">
          <CareerStats />
        </AnimatedSection>
        <CareerServicesGrid />
      </div>
    </section>
  );
}
