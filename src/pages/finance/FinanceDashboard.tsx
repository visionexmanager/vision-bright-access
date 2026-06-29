import { FinanceLayout } from "@/components/finance/FinanceLayout";
import { FinancePageShell } from "@/components/finance/FinancePageShell";

export default function FinanceDashboard() {
  return (
    <FinanceLayout>
      <FinancePageShell
        title="Finance Dashboard"
        description="Overview of your markets, portfolio, and watchlist."
      />
    </FinanceLayout>
  );
}
