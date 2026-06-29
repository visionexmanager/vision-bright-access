import { FinanceLayout } from "@/components/finance/FinanceLayout";
import { FinancePageShell } from "@/components/finance/FinancePageShell";

export default function AIAnalyst() {
  return (
    <FinanceLayout>
      <FinancePageShell
        title="AI Analyst"
        description="AI-powered buy/sell/hold signals and market reasoning."
      />
    </FinanceLayout>
  );
}
