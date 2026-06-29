import { FinanceLayout } from "@/components/finance/FinanceLayout";
import { FinancePageShell } from "@/components/finance/FinancePageShell";

export default function FinanceWatchlist() {
  return (
    <FinanceLayout>
      <FinancePageShell
        title="Watchlist"
        description="Monitor symbols you care about in real time."
      />
    </FinanceLayout>
  );
}
