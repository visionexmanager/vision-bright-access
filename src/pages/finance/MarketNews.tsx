import { FinanceLayout } from "@/components/finance/FinanceLayout";
import { FinancePageShell } from "@/components/finance/FinancePageShell";

export default function MarketNews() {
  return (
    <FinanceLayout>
      <FinancePageShell
        title="Market News"
        description="Latest financial news with sentiment analysis."
      />
    </FinanceLayout>
  );
}
