import { Coins } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useVXWallet } from "@/hooks/useVXWallet";
import { useLanguage } from "@/contexts/LanguageContext";

/** Reuses the existing app-wide useVXWallet() hook — no separate reward system for Library. */
export function VXRewardCard() {
  const { balance, isLoading } = useVXWallet();
  const { t } = useLanguage();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Coins className="h-5 w-5 text-primary" aria-hidden="true" />
          {t("library.vxReward.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold text-primary" aria-live="polite">
          {isLoading ? "…" : balance.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">VX</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{t("library.vxReward.description")}</p>
      </CardContent>
    </Card>
  );
}
