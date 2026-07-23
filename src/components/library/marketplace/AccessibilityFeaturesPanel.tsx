import { Accessibility, Headphones, Type, Ear } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { LibraryBookFormat } from "@/lib/types/library-book";

interface AccessibilityFeaturesPanelProps {
  formats: LibraryBookFormat[];
}

/**
 * Surfaces accessibility capabilities that are already real and universal
 * across the reader engine (dyslexia-friendly font, adjustable text size/
 * spacing, TTS read-aloud — see LibraryReaderSettings / useReadAloud) plus
 * whichever formats this specific book supports. Deliberately does NOT claim
 * per-book braille/audio-description metadata that doesn't exist in the
 * schema yet.
 */
export function AccessibilityFeaturesPanel({ formats }: AccessibilityFeaturesPanelProps) {
  const { t } = useLanguage();

  const features = [
    { icon: Type, label: t("library.accessibility.dyslexiaFont") },
    { icon: Accessibility, label: t("library.accessibility.adjustableText") },
    { icon: Ear, label: t("library.accessibility.readAloud") },
    ...(formats.includes("audiobook") ? [{ icon: Headphones, label: t("library.accessibility.audiobookAvailable") }] : []),
  ];

  return (
    <section aria-labelledby="book-accessibility-heading" className="rounded-xl border bg-card p-4">
      <h2 id="book-accessibility-heading" className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Accessibility className="h-4 w-4" aria-hidden="true" /> {t("library.accessibility.title")}
      </h2>
      <ul className="space-y-2">
        {features.map((f) => (
          <li key={f.label} className="flex items-center gap-2 text-sm text-muted-foreground">
            <f.icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            {f.label}
          </li>
        ))}
      </ul>
    </section>
  );
}
