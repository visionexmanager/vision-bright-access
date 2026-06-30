import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, PieChart, TrendingUp, TrendingDown, Sparkles } from "lucide-react";
import { FinanceLayout } from "@/components/finance/FinanceLayout";
import { FinancePageShell } from "@/components/finance/FinancePageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Holding {
  id: string;
  symbol: string;
  name: string;
  qty: number;
  buyPrice: number;
  currentPrice: number;
}

interface LocalPortfolio {
  id: string;
  name: string;
  holdings: Holding[];
  createdAt: string;
}

// ── localStorage helpers ──────────────────────────────────────────────────────

const LS_KEY = "vx_finance_portfolios";

function loadPortfolios(): LocalPortfolio[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as LocalPortfolio[]) : [];
  } catch {
    return [];
  }
}

function savePortfolios(portfolios: LocalPortfolio[]): void {
  localStorage.setItem(LS_KEY, JSON.stringify(portfolios));
}

// ── Calculation helpers ───────────────────────────────────────────────────────

function calcHolding(h: Holding) {
  const cost = h.qty * h.buyPrice;
  const value = h.qty * h.currentPrice;
  const pnl = value - cost;
  const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
  return { cost, value, pnl, pnlPct };
}

function calcPortfolioTotals(holdings: Holding[]) {
  let totalCost = 0;
  let totalValue = 0;
  for (const h of holdings) {
    const { cost, value } = calcHolding(h);
    totalCost += cost;
    totalValue += value;
  }
  const totalPnl = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
  return { totalCost, totalValue, totalPnl, totalPnlPct };
}

function fmtUSD(v: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(v);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Portfolio() {
  const navigate = useNavigate();
  const [portfolios, setPortfolios] = useState<LocalPortfolio[]>(loadPortfolios);
  const [activeId, setActiveId] = useState<string | null>(
    () => loadPortfolios()[0]?.id ?? null
  );

  // Dialog states
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");

  const [addHoldingOpen, setAddHoldingOpen] = useState(false);
  const [holdingForm, setHoldingForm] = useState({
    symbol: "",
    name: "",
    qty: "",
    buyPrice: "",
    currentPrice: "",
  });

  // ── Mutators ────────────────────────────────────────────────────────────────

  const persist = useCallback((updated: LocalPortfolio[]) => {
    setPortfolios(updated);
    savePortfolios(updated);
  }, []);

  const handleCreatePortfolio = () => {
    if (!createName.trim()) return;
    const newP: LocalPortfolio = {
      id: crypto.randomUUID(),
      name: createName.trim(),
      holdings: [],
      createdAt: new Date().toISOString(),
    };
    const updated = [...portfolios, newP];
    persist(updated);
    setActiveId(newP.id);
    setCreateName("");
    setCreateOpen(false);
  };

  const handleDeletePortfolio = (id: string) => {
    const updated = portfolios.filter((p) => p.id !== id);
    persist(updated);
    if (activeId === id) setActiveId(updated[0]?.id ?? null);
  };

  const handleAddHolding = () => {
    if (!activeId) return;
    const qty = parseFloat(holdingForm.qty);
    const buyPrice = parseFloat(holdingForm.buyPrice);
    const currentPrice = parseFloat(holdingForm.currentPrice) || buyPrice;
    if (!holdingForm.symbol.trim() || isNaN(qty) || isNaN(buyPrice)) return;

    const newHolding: Holding = {
      id: crypto.randomUUID(),
      symbol: holdingForm.symbol.trim().toUpperCase(),
      name: holdingForm.name.trim() || holdingForm.symbol.trim().toUpperCase(),
      qty,
      buyPrice,
      currentPrice,
    };

    const updated = portfolios.map((p) =>
      p.id === activeId ? { ...p, holdings: [...p.holdings, newHolding] } : p
    );
    persist(updated);
    setHoldingForm({ symbol: "", name: "", qty: "", buyPrice: "", currentPrice: "" });
    setAddHoldingOpen(false);
  };

  const handleRemoveHolding = (portfolioId: string, holdingId: string) => {
    const updated = portfolios.map((p) =>
      p.id === portfolioId
        ? { ...p, holdings: p.holdings.filter((h) => h.id !== holdingId) }
        : p
    );
    persist(updated);
  };

  // ── Derived ─────────────────────────────────────────────────────────────────

  const activePortfolio = portfolios.find((p) => p.id === activeId) ?? null;
  const totals = activePortfolio ? calcPortfolioTotals(activePortfolio.holdings) : null;

  // ── Render ──────────────────────────────────────────────────────────────────

  const createAction = (
    <div className="flex gap-2">
      {activePortfolio && activePortfolio.holdings.length > 0 && (
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => {
            const { totalCost, totalValue, totalPnl, totalPnlPct } = totals!;
            const holdingsList = activePortfolio.holdings.map((h) => {
              const { cost, value, pnl, pnlPct } = calcHolding(h);
              return `• ${h.symbol.toUpperCase()} (${h.name}): ${h.qty} units @ $${h.buyPrice} buy → $${h.currentPrice || h.buyPrice} current | P&L: $${pnl.toFixed(2)} (${pnlPct.toFixed(1)}%)`;
            }).join("\n");
            const ctx = encodeURIComponent(
              `Analyze my investment portfolio "${activePortfolio.name}":\n\nHoldings:\n${holdingsList}\n\nSummary: Total Cost $${totalCost.toFixed(2)}, Total Value $${totalValue.toFixed(2)}, P&L $${totalPnl.toFixed(2)} (${totalPnlPct.toFixed(1)}%)\n\nPlease: 1) Assess overall health 2) Identify concentration risks 3) Highlight best/worst performers 4) Suggest one rebalancing action.`
            );
            navigate(`/finance/ai-analyst?ctx=${ctx}`);
          }}
        >
          <Sparkles className="h-3.5 w-3.5" />
          AI Analysis
        </Button>
      )}
      <Button size="sm" className="gap-2" onClick={() => setCreateOpen(true)}>
        <Plus className="h-4 w-4" />
        Create Portfolio
      </Button>
    </div>
  );

  return (
    <FinanceLayout>
      <FinancePageShell
        title="Portfolio"
        description="Track your investments, P&L, and asset allocation."
        actions={createAction}
      >
        {portfolios.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-20 text-center gap-4">
            <PieChart className="h-12 w-12 text-muted-foreground/50" />
            <div>
              <p className="font-semibold text-base">No portfolios yet</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                Create your first portfolio to start tracking your investments.
              </p>
            </div>
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Portfolio
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Portfolio tabs */}
            <div className="flex flex-wrap gap-2 border-b pb-3">
              {portfolios.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setActiveId(p.id)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                    activeId === p.id
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "border border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {p.name}
                </button>
              ))}
              <button
                onClick={() => setCreateOpen(true)}
                className="rounded-full px-4 py-1.5 text-sm font-medium border border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-foreground transition-all"
              >
                + New
              </button>
            </div>

            {activePortfolio && (
              <>
                {/* Summary cards */}
                {totals && (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <Card>
                      <CardContent className="pt-4 pb-3">
                        <div className="text-xs text-muted-foreground">Total Value</div>
                        <div className="text-xl font-bold mt-1">{fmtUSD(totals.totalValue)}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 pb-3">
                        <div className="text-xs text-muted-foreground">Total Cost</div>
                        <div className="text-xl font-bold mt-1">{fmtUSD(totals.totalCost)}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 pb-3">
                        <div className="text-xs text-muted-foreground">P&L</div>
                        <div
                          className={`text-xl font-bold mt-1 ${
                            totals.totalPnl >= 0 ? "text-green-500" : "text-red-500"
                          }`}
                        >
                          {totals.totalPnl >= 0 ? "+" : ""}
                          {fmtUSD(totals.totalPnl)}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 pb-3">
                        <div className="text-xs text-muted-foreground">P&L %</div>
                        <div
                          className={`text-xl font-bold mt-1 flex items-center gap-1 ${
                            totals.totalPnlPct >= 0 ? "text-green-500" : "text-red-500"
                          }`}
                        >
                          {totals.totalPnlPct >= 0 ? (
                            <TrendingUp className="h-4 w-4" />
                          ) : (
                            <TrendingDown className="h-4 w-4" />
                          )}
                          {totals.totalPnlPct >= 0 ? "+" : ""}
                          {totals.totalPnlPct.toFixed(2)}%
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Holdings table */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold">
                      Holdings ({activePortfolio.holdings.length})
                    </h2>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => setAddHoldingOpen(true)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add Holding
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-2 text-destructive hover:text-destructive"
                        onClick={() => handleDeletePortfolio(activePortfolio.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete Portfolio
                      </Button>
                    </div>
                  </div>

                  {activePortfolio.holdings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-12 text-center gap-3">
                      <p className="text-sm text-muted-foreground">No holdings yet.</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => setAddHoldingOpen(true)}
                      >
                        <Plus className="h-4 w-4" />
                        Add First Holding
                      </Button>
                    </div>
                  ) : (
                    <div className="rounded-xl border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead>Symbol</TableHead>
                            <TableHead className="text-right">Qty</TableHead>
                            <TableHead className="text-right">Buy Price</TableHead>
                            <TableHead className="text-right">Current</TableHead>
                            <TableHead className="text-right hidden sm:table-cell">Value</TableHead>
                            <TableHead className="text-right hidden md:table-cell">P&L</TableHead>
                            <TableHead className="w-10" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {activePortfolio.holdings.map((h) => {
                            const { value, pnl, pnlPct } = calcHolding(h);
                            const isPos = pnl >= 0;
                            const pnlClass = isPos ? "text-green-500" : "text-red-500";

                            return (
                              <TableRow key={h.id} className="hover:bg-muted/20 transition-colors">
                                <TableCell>
                                  <div className="font-semibold text-sm">{h.symbol}</div>
                                  <div className="text-xs text-muted-foreground">{h.name}</div>
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm">
                                  {h.qty}
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm">
                                  {fmtUSD(h.buyPrice)}
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm">
                                  {fmtUSD(h.currentPrice)}
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm hidden sm:table-cell">
                                  {fmtUSD(value)}
                                </TableCell>
                                <TableCell className={`text-right font-mono text-sm hidden md:table-cell ${pnlClass}`}>
                                  {isPos ? "+" : ""}
                                  {fmtUSD(pnl)} ({isPos ? "+" : ""}
                                  {pnlPct.toFixed(2)}%)
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                    onClick={() =>
                                      handleRemoveHolding(activePortfolio.id, h.id)
                                    }
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </FinancePageShell>

      {/* Create Portfolio Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Portfolio</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              placeholder="Portfolio name (e.g. My Crypto)"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreatePortfolio()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button onClick={handleCreatePortfolio} disabled={!createName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Holding Dialog */}
      <Dialog open={addHoldingOpen} onOpenChange={setAddHoldingOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Holding</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="Symbol (e.g. BTC)"
                value={holdingForm.symbol}
                onChange={(e) =>
                  setHoldingForm((f) => ({ ...f, symbol: e.target.value }))
                }
              />
              <Input
                placeholder="Name (e.g. Bitcoin)"
                value={holdingForm.name}
                onChange={(e) =>
                  setHoldingForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
            <Input
              type="number"
              placeholder="Quantity"
              value={holdingForm.qty}
              min="0"
              onChange={(e) =>
                setHoldingForm((f) => ({ ...f, qty: e.target.value }))
              }
            />
            <Input
              type="number"
              placeholder="Buy price (USD)"
              value={holdingForm.buyPrice}
              min="0"
              onChange={(e) =>
                setHoldingForm((f) => ({ ...f, buyPrice: e.target.value }))
              }
            />
            <Input
              type="number"
              placeholder="Current price (USD) — optional, defaults to buy price"
              value={holdingForm.currentPrice}
              min="0"
              onChange={(e) =>
                setHoldingForm((f) => ({ ...f, currentPrice: e.target.value }))
              }
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              onClick={handleAddHolding}
              disabled={
                !holdingForm.symbol.trim() ||
                !holdingForm.qty ||
                !holdingForm.buyPrice
              }
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FinanceLayout>
  );
}
