import { FinanceLayout } from "@/components/finance/FinanceLayout";
import { FinancePageShell } from "@/components/finance/FinancePageShell";

export default function Stocks() {
  return (
    <FinanceLayout>
      <FinancePageShell
        title="Stocks"
        description="Track equities from global exchanges."
      />
    </FinanceLayout>
  );
}
