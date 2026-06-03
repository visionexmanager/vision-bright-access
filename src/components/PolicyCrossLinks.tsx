import { Link } from "react-router-dom";
import { ArrowRight, FileText } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface PolicyRef {
  to: string;
  labelKey: string;
  descKey?: string;
}

interface Props {
  links: PolicyRef[];
}

export function PolicyCrossLinks({ links }: Props) {
  const { t } = useLanguage();
  return (
    <div className="mt-10 rounded-2xl border border-primary/20 bg-primary/5 p-6">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-primary uppercase tracking-wider">
          {t("legal.seeAlso")}
        </h2>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="group flex items-center justify-between rounded-xl border bg-card px-4 py-3 text-sm font-medium transition-all hover:border-primary/40 hover:shadow-sm"
          >
            <span className="text-foreground group-hover:text-primary transition-colors">
              {t(l.labelKey)}
            </span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-1 group-hover:text-primary" />
          </Link>
        ))}
      </div>
    </div>
  );
}
