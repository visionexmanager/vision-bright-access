import { FinanceLayout } from "@/components/finance/FinanceLayout";
import { FinancePageShell } from "@/components/finance/FinancePageShell";

export default function BrokerComparison() {
  return (
    <FinanceLayout>
      <FinancePageShell
        title="Broker Comparison"
        description="Compare regulated brokers by fees, spreads, and platforms."
      />
    </FinanceLayout>
  );
}
