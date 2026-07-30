import { Lightbulb } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export function FunFactsList({ facts }: { facts: string[] }) {
  const { t } = useLanguage();
  if (facts.length === 0) return null;

  return (
    <div className="rounded-2xl border-2 border-kids-accent/30 bg-kids-accent/10 p-4">
      <h2 className="mb-2 flex items-center gap-2 font-heading text-sm font-bold text-kids-accent">
        <Lightbulb className="h-4 w-4" aria-hidden="true" /> {t("kids.explorer.funFacts")}
      </h2>
      <ul className="flex flex-col gap-2 text-sm">
        {facts.map((fact, i) => (
          <li key={i} className="flex items-start gap-2">
            <span aria-hidden="true">✨</span>
            <span>{fact}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
