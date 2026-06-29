import { FinanceLayout } from "@/components/finance/FinanceLayout";
import { FinancePageShell } from "@/components/finance/FinancePageShell";

export default function Portfolio() {
  return (
    <FinanceLayout>
      <FinancePageShell
        title="Portfolio"
        description="Track your investments, P&L and asset allocation."
      />
    </FinanceLayout>
  );
}
