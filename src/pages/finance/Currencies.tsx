import { FinanceLayout } from "@/components/finance/FinanceLayout";
import { FinancePageShell } from "@/components/finance/FinancePageShell";

export default function Currencies() {
  return (
    <FinanceLayout>
      <FinancePageShell
        title="Currencies"
        description="Forex pairs and currency exchange rates."
      />
    </FinanceLayout>
  );
}
