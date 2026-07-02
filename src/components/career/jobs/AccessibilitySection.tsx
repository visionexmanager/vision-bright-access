import { Accessibility } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { StaggerGrid, StaggerItem } from "@/components/AnimatedSection";
import { ACCESSIBILITY_FEATURES } from "./mockAccessibility";

export function AccessibilitySection() {
  const { t } = useLanguage();

  return (
    <div className="rounded-3xl border border-primary/20 bg-primary/5 p-6 sm:p-8" aria-labelledby="careers-accessibility-heading">
      <div className="mb-2 flex items-center gap-2">
        <Accessibility className="h-6 w-6 text-primary" aria-hidden="true" />
        <h2 id="careers-accessibility-heading" className="type-heading">{t("careersPage.accessibility.title")}</h2>
      </div>
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">{t("careersPage.accessibility.subtitle")}</p>

      <StaggerGrid className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ACCESSIBILITY_FEATURES.map((feature) => {
          const Icon = feature.icon;
          return (
            <StaggerItem key={feature.id}>
              <div className="flex h-full flex-col gap-2 rounded-2xl border border-border/50 bg-card p-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="text-sm font-bold">{t(feature.titleKey)}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{t(feature.descKey)}</p>
              </div>
            </StaggerItem>
          );
        })}
      </StaggerGrid>
    </div>
  );
}
