import { useQuery } from "@tanstack/react-query";
import { RefreshCw, DollarSign } from "lucide-react";
import { FinanceLayout } from "@/components/finance/FinanceLayout";
import { FinancePageShell } from "@/components/finance/FinancePageShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";

// ── Config ────────────────────────────────────────────────────────────────────

const DISPLAYED_CURRENCIES = [
  { code: "EUR", name: "Euro",                  flag: "🇪🇺" },
  { code: "GBP", name: "British Pound",         flag: "🇬🇧" },
  { code: "JPY", name: "Japanese Yen",          flag: "🇯🇵" },
  { code: "AED", name: "UAE Dirham",            flag: "🇦🇪" },
  { code: "SAR", name: "Saudi Riyal",           flag: "🇸🇦" },
  { code: "EGP", name: "Egyptian Pound",        flag: "🇪🇬" },
  { code: "TRY", name: "Turkish Lira",          flag: "🇹🇷" },
  { code: "CNY", name: "Chinese Yuan",          flag: "🇨🇳" },
  { code: "INR", name: "Indian Rupee",          flag: "🇮🇳" },
  { code: "CAD", name: "Canadian Dollar",       flag: "🇨🇦" },
  { code: "AUD", name: "Australian Dollar",     flag: "🇦🇺" },
  { code: "CHF", name: "Swiss Franc",           flag: "🇨🇭" },
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExchangeRateResponse {
  base_code: string;
  time_last_update_utc: string;
  rates: Record<string, number>;
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function fetchForexRates(): Promise<ExchangeRateResponse> {
  const res = await fetch("https://open.er-api.com/v6/latest/USD");
  if (!res.ok) throw new Error(`ExchangeRate API error: ${res.status}`);
  return res.json();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRate(code: string, rate: number): string {
  // JPY, TRY, INR, EGP usually shown with more decimal places when < 1 (vs USD)
  // but from USD base, they are > 1 so use 4 decimal places by default
  if (rate >= 100) return rate.toFixed(2);
  if (rate >= 1) return rate.toFixed(4);
  return rate.toFixed(6);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Currencies() {
  const {
    data,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["finance", "forex-rates"],
    queryFn: fetchForexRates,
    staleTime: 10 * 60_000, // 10 min — free tier refreshes every 24h but we check fresh
    retry: 2,
  });

  const lastUpdated = data?.time_last_update_utc
    ? new Date(data.time_last_update_utc).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const refreshAction = (
    <Button
      variant="outline"
      size="sm"
      onClick={() => refetch()}
      disabled={isFetching}
      className="gap-2"
    >
      <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
      Refresh
    </Button>
  );

  return (
    <FinanceLayout>
      <FinancePageShell
        title="Currency Exchange Rates"
        description="Major forex pairs vs. USD — powered by ExchangeRate API."
        actions={refreshAction}
      >
        {isLoading ? (
          <div className="rounded-xl border overflow-hidden">
            <div className="bg-muted/30 px-4 py-3 flex gap-4">
              {["Currency", "Name", "Rate vs USD"].map((h) => (
                <Skeleton key={h} className="h-4 w-28" />
              ))}
            </div>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="px-4 py-3 flex gap-4 border-t">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-20 text-center gap-3">
            <DollarSign className="h-10 w-10 text-muted-foreground/50" />
            <p className="font-semibold">Failed to load exchange rates</p>
            <p className="text-sm text-muted-foreground">
              ExchangeRate API may be temporarily unavailable. Try again in a moment.
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Base currency info card */}
            <Card className="bg-muted/20">
              <CardContent className="py-3 px-4 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🇺🇸</span>
                  <div>
                    <div className="text-sm font-semibold">USD — US Dollar</div>
                    <div className="text-xs text-muted-foreground">Base currency</div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground ml-auto">
                  {lastUpdated ? `Last updated: ${lastUpdated}` : ""}
                </div>
              </CardContent>
            </Card>

            {/* Rates table */}
            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Currency</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Rate (per 1 USD)</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">1 Unit = USD</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {DISPLAYED_CURRENCIES.map(({ code, name, flag }) => {
                    const rate = data?.rates[code];
                    if (rate === undefined) return null;
                    const inverse = 1 / rate;

                    return (
                      <TableRow key={code} className="hover:bg-muted/20 transition-colors">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{flag}</span>
                            <span className="font-mono text-sm font-semibold">{code}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{name}</TableCell>
                        <TableCell className="text-right font-mono text-sm font-medium">
                          {formatRate(code, rate)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-muted-foreground hidden sm:table-cell">
                          ${formatRate("USD", inverse)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </FinancePageShell>
    </FinanceLayout>
  );
}
