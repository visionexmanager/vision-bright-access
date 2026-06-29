import { FinanceLayout } from "@/components/finance/FinanceLayout";
import { FinancePageShell } from "@/components/finance/FinancePageShell";

export default function FinanceAcademy() {
  return (
    <FinanceLayout>
      <FinancePageShell
        title="Finance Academy"
        description="Learn trading, investing, and financial analysis."
      />
    </FinanceLayout>
  );
}
