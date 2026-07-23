import { Link } from "react-router-dom";
import { PackagePlus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useBundlesForBook } from "@/hooks/library/useBundlesForBook";
import { useLanguage } from "@/contexts/LanguageContext";

interface FrequentlyBoughtTogetherProps {
  bookId: string;
}

export function FrequentlyBoughtTogether({ bookId }: FrequentlyBoughtTogetherProps) {
  const { t } = useLanguage();
  const { bundles, isLoading } = useBundlesForBook(bookId);
  if (isLoading || bundles.length === 0) return null;

  return (
    <section aria-labelledby="frequently-bought-heading">
      <h2 id="frequently-bought-heading" className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <PackagePlus className="h-4 w-4" aria-hidden="true" /> {t("library.bookDetails.frequentlyBoughtTogether")}
      </h2>
      <div className="space-y-3">
        {bundles.map((bundle) => (
          <Card key={bundle.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="font-semibold">{bundle.title}</p>
              <p className="truncate text-sm text-muted-foreground">
                {t("library.bookDetails.bundleIncludes").replace("{count}", String(bundle.otherBooks.length + 1))}
                {": "}
                {[t("library.bookDetails.thisBook"), ...bundle.otherBooks.map((b) => b.title)].join(", ")}
              </p>
              <p className="mt-1 text-sm font-semibold text-primary">
                {bundle.price_vx ? `${bundle.price_vx} VX` : bundle.price_usd ? `$${bundle.price_usd}` : null}
              </p>
            </div>
            <Button asChild size="sm">
              <Link to={`/library/bundles/${bundle.id}`}>{t("library.bookDetails.viewBundle")}</Link>
            </Button>
          </Card>
        ))}
      </div>
    </section>
  );
}
