import { FinanceLayout } from "@/components/finance/FinanceLayout";
import { FinancePageShell } from "@/components/finance/FinancePageShell";

export default function Markets() {
  return (
    <FinanceLayout>
      <FinancePageShell
        title="Markets"
        description="Global stocks, currencies, commodities and indices."
      />
    </FinanceLayout>
  );
}
