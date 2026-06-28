import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ArrowDownCircle, RefreshCw, Gift, CreditCard,
} from "lucide-react";
import { useTransactionHistory } from "@/hooks/useCredits";
import type { TransactionType } from "@/lib/types/billing";
import { TRANSACTION_LABELS } from "@/lib/types/billing";

const TYPE_ICON: Record<TransactionType, React.ElementType> = {
  earn:               Gift,
  spend:              ArrowDownCircle,
  refund:             RefreshCw,
  subscription_grant: Gift,
  admin_grant:        Gift,
  purchase:           CreditCard,
};

const TYPE_COLOR: Record<TransactionType, string> = {
  earn:               "text-green-400",
  spend:              "text-red-400",
  refund:             "text-blue-400",
  subscription_grant: "text-green-400",
  admin_grant:        "text-green-400",
  purchase:           "text-amber-400",
};

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString(undefined, {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function TransactionHistory() {
  const [typeFilter, setTypeFilter] = useState<string>("");
  const { data: transactions = [], isLoading } = useTransactionHistory({
    limit: 100,
    type:  typeFilter || undefined,
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-8 w-44 text-sm"><SelectValue placeholder="All types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All types</SelectItem>
            <SelectItem value="spend">Spent</SelectItem>
            <SelectItem value="purchase">Purchased</SelectItem>
            <SelectItem value="subscription_grant">Subscription Grant</SelectItem>
            <SelectItem value="refund">Refunded</SelectItem>
            <SelectItem value="admin_grant">Admin Grant</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-muted-foreground">
          {transactions.length} transactions
        </span>
      </div>

      <div className="rounded-xl border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Time</TableHead>
              <TableHead className="text-xs">Type</TableHead>
              <TableHead className="text-xs">Description</TableHead>
              <TableHead className="text-xs text-right">VX</TableHead>
              <TableHead className="text-xs text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <TableCell key={j}><div className="h-3 bg-muted animate-pulse rounded w-20" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-xs text-muted-foreground">
                  No transactions yet
                </TableCell>
              </TableRow>
            ) : transactions.map((txn) => {
              const Icon  = TYPE_ICON[txn.type] ?? ArrowDownCircle;
              const color = TYPE_COLOR[txn.type] ?? "";
              const isCredit = txn.amount_vx > 0;

              return (
                <TableRow key={txn.id}>
                  <TableCell className="text-[11px] font-mono whitespace-nowrap">
                    {formatTime(txn.created_at)}
                  </TableCell>
                  <TableCell>
                    <div className={cn("flex items-center gap-1.5", color)}>
                      <Icon className="size-3.5" />
                      <span className="text-[11px]">{TRANSACTION_LABELS[txn.type]}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-[11px] text-muted-foreground max-w-48 truncate">
                    {txn.description}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={cn(
                      "text-xs font-bold tabular-nums",
                      isCredit ? "text-green-400" : "text-red-400"
                    )}>
                      {isCredit ? "+" : ""}{txn.amount_vx.toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {txn.balance_after.toLocaleString()}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
