import { FinanceLayout } from "@/components/finance/FinanceLayout";
import { FinancePageShell } from "@/components/finance/FinancePageShell";

export default function EconomicCalendar() {
  return (
    <FinanceLayout>
      <FinancePageShell
        title="Economic Calendar"
        description="Upcoming economic events, earnings, and announcements."
      />
    </FinanceLayout>
  );
}
