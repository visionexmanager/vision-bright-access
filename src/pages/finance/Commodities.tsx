import { FinanceLayout } from "@/components/finance/FinanceLayout";
import { FinancePageShell } from "@/components/finance/FinancePageShell";

export default function Commodities() {
  return (
    <FinanceLayout>
      <FinancePageShell
        title="Commodities"
        description="Gold, oil, silver and agricultural commodities."
      />
    </FinanceLayout>
  );
}
