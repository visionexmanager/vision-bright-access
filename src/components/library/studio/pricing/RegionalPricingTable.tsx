import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchRegionalPrices, upsertRegionalPrice, removeRegionalPrice } from "@/services/library/pricing";

interface RegionalPricingTableProps {
  bookId: string;
}

export function RegionalPricingTable({ bookId }: RegionalPricingTableProps) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [countryCode, setCountryCode] = useState("");
  const [priceUsd, setPriceUsd] = useState("");

  const { data: prices = [], isLoading } = useQuery({ queryKey: queryKeys.library.studio.regionalPrices(bookId), queryFn: () => fetchRegionalPrices(bookId) });
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: queryKeys.library.studio.regionalPrices(bookId) });

  const handleAdd = async () => {
    if (countryCode.length !== 2 || !priceUsd) return;
    await upsertRegionalPrice({ book_id: bookId, country_code: countryCode.toUpperCase(), price_usd: Number(priceUsd), price_vx: null });
    setCountryCode("");
    setPriceUsd("");
    invalidate();
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">{t("library.studio.pricing.regionalPricing")}</h3>
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
      ) : prices.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("library.studio.pricing.regionalPricingEmpty")}</p>
      ) : (
        <ul className="space-y-1.5">
          {prices.map((price) => (
            <li key={price.country_code} className="flex items-center justify-between rounded-md border p-2 text-sm">
              <span>{price.country_code} — ${price.price_usd.toFixed(2)}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => void removeRegionalPrice(bookId, price.country_code).then(invalidate)} aria-label={t("library.common.delete")}>
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input value={countryCode} onChange={(e) => setCountryCode(e.target.value.slice(0, 2))} placeholder={t("library.studio.pricing.countryCode")} maxLength={2} className="w-20" />
        <Input type="number" min="0" step="0.01" value={priceUsd} onChange={(e) => setPriceUsd(e.target.value)} placeholder={t("library.studio.pricing.priceUsd")} />
        <Button size="icon" variant="outline" onClick={() => void handleAdd()} disabled={countryCode.length !== 2 || !priceUsd} aria-label={t("library.studio.pricing.addRegionalPrice")}>
          <Plus className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
