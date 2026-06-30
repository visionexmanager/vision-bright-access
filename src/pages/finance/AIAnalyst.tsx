import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { FinanceLayout } from "@/components/finance/FinanceLayout";
import { FinancePageShell } from "@/components/finance/FinancePageShell";
import { useAIChat } from "@/hooks/useAIChat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  TrendingUp, TrendingDown, Minus, Send, Bot, User,
  Zap, BarChart2, RefreshCw, AlertTriangle, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CoinData {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  price_change_percentage_24h: number | null;
  total_volume: number;
}

interface ParsedSignal {
  signal: "BUY" | "SELL" | "HOLD" | null;
  confidence: string | null;
  target: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const QUICK_COINS = [
  { id: "bitcoin",      label: "BTC" },
  { id: "ethereum",     label: "ETH" },
  { id: "solana",       label: "SOL" },
  { id: "binancecoin",  label: "BNB" },
  { id: "ripple",       label: "XRP" },
  { id: "cardano",      label: "ADA" },
];

async function fetchCoinData(coinId: string): Promise<CoinData | null> {
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${coinId}&sparkline=false`
    );
    if (!res.ok) return null;
    const data: CoinData[] = await res.json();
    return data[0] ?? null;
  } catch {
    return null;
  }
}

function parseSignal(text: string): ParsedSignal {
  const signalMatch     = text.match(/\*\*Signal:\s*(BUY|SELL|HOLD)\*\*/i);
  const confidenceMatch = text.match(/\*\*Confidence:\*\*\s*(\w+)/i);
  const targetMatch     = text.match(/\*\*Price Target[^:]*:\*\*\s*([^\n]+)/i);
  return {
    signal:     (signalMatch?.[1]?.toUpperCase() as "BUY" | "SELL" | "HOLD") ?? null,
    confidence: confidenceMatch?.[1] ?? null,
    target:     targetMatch?.[1]?.trim() ?? null,
  };
}

function fmtPrice(n: number) {
  if (n >= 1000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (n >= 1)    return `$${n.toFixed(2)}`;
  return `$${n.toFixed(6)}`;
}

function fmtBig(n: number) {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

// ── Signal Badge ──────────────────────────────────────────────────────────────

function SignalBadge({ signal }: { signal: "BUY" | "SELL" | "HOLD" | null }) {
  if (!signal) return null;
  const config = {
    BUY:  { color: "bg-green-500/15 text-green-400 border-green-500/30",     Icon: TrendingUp },
    SELL: { color: "bg-red-500/15 text-red-400 border-red-500/30",           Icon: TrendingDown },
    HOLD: { color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",  Icon: Minus },
  };
  const { color, Icon } = config[signal];
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold border", color)}>
      <Icon className="h-3.5 w-3.5" />
      {signal}
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AIAnalyst() {
  const [searchParams] = useSearchParams();
  const { messages, isLoading, sendMessage, clearMessages } = useAIChat({
    assistantId: "finance-advisor",
  });

  const [coinInput,   setCoinInput]   = useState("");
  const [activeCoin,  setActiveCoin]  = useState<CoinData | null>(null);
  const [coinLoading, setCoinLoading] = useState(false);
  const [signalSent,  setSignalSent]  = useState(false);
  const [chatInput,   setChatInput]   = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Pre-load context from URL params (from Dashboard / News / Portfolio)
  useEffect(() => {
    const ctx = searchParams.get("ctx");
    if (ctx) setChatInput(decodeURIComponent(ctx));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generateSignal = useCallback(async (coin: CoinData) => {
    setSignalSent(true);
    const chg = coin.price_change_percentage_24h;
    const prompt = [
      `Analyze ${coin.name} (${coin.symbol.toUpperCase()}) — live data as of ${new Date().toUTCString()}:`,
      `• Current Price: ${fmtPrice(coin.current_price)}`,
      `• 24h Change: ${chg !== null ? `${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%` : "N/A"}`,
      `• Market Cap: ${fmtBig(coin.market_cap)}`,
      `• 24h Volume: ${fmtBig(coin.total_volume)}`,
      ``,
      `Provide a full analysis: Signal (BUY/SELL/HOLD), Confidence, 30-day Price Target, Key Risks, and Reasoning.`,
    ].join("\n");
    await sendMessage(prompt);
  }, [sendMessage]);

  const loadCoin = useCallback(async (coinId: string) => {
    setCoinLoading(true);
    setSignalSent(false);
    clearMessages();
    const data = await fetchCoinData(coinId);
    setCoinLoading(false);
    if (data) {
      setActiveCoin(data);
      await generateSignal(data);
    }
  }, [clearMessages, generateSignal]);

  const handleQuickCoin = (coinId: string) => {
    setCoinInput(coinId);
    loadCoin(coinId);
  };

  const handleCoinSearch = () => {
    if (!coinInput.trim()) return;
    loadCoin(coinInput.trim().toLowerCase().replace(/\s+/g, "-"));
  };

  const handleChatSend = () => {
    const msg = chatInput.trim();
    if (!msg || isLoading) return;
    setChatInput("");
    sendMessage(msg);
  };

  const handleChatKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleChatSend();
    }
  };

  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant");
  const parsed = lastAssistantMsg && signalSent ? parseSignal(lastAssistantMsg.content) : null;

  return (
    <FinanceLayout>
      <FinancePageShell
        title="AI Analyst"
        description="Real-time AI signals, portfolio analysis, and market intelligence — powered by Visionex Finance Advisor."
      >
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          {/* ── Left: Signal Generator ──────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-4">

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  AI Signal Generator
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. bitcoin, ethereum"
                    value={coinInput}
                    onChange={(e) => setCoinInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCoinSearch()}
                    className="text-sm"
                  />
                  <Button size="sm" onClick={handleCoinSearch} disabled={coinLoading || isLoading}>
                    {coinLoading
                      ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      : <BarChart2 className="h-3.5 w-3.5" />
                    }
                  </Button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {QUICK_COINS.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleQuickCoin(c.id)}
                      disabled={coinLoading || isLoading}
                      className={cn(
                        "px-2.5 py-1 rounded-md text-xs font-mono font-medium border transition-colors",
                        activeCoin?.id === c.id
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted hover:bg-muted/70 border-border"
                      )}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Live coin data */}
            {(activeCoin || coinLoading) && (
              <Card>
                <CardContent className="p-4 space-y-3">
                  {coinLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-8 w-24" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  ) : activeCoin ? (
                    <>
                      <div className="flex items-center gap-2">
                        {activeCoin.image && (
                          <img src={activeCoin.image} alt={activeCoin.name} className="h-7 w-7 rounded-full" />
                        )}
                        <div>
                          <p className="text-xs text-muted-foreground uppercase font-mono">{activeCoin.symbol}</p>
                          <p className="text-sm font-semibold">{activeCoin.name}</p>
                        </div>
                      </div>
                      <p className="text-2xl font-bold">{fmtPrice(activeCoin.current_price)}</p>
                      <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                        <span className={cn(
                          "font-medium",
                          (activeCoin.price_change_percentage_24h ?? 0) >= 0 ? "text-green-500" : "text-red-500"
                        )}>
                          {(activeCoin.price_change_percentage_24h ?? 0) >= 0 ? "+" : ""}
                          {(activeCoin.price_change_percentage_24h ?? 0).toFixed(2)}% 24h
                        </span>
                        <span>· Cap {fmtBig(activeCoin.market_cap)}</span>
                        <span>· Vol {fmtBig(activeCoin.total_volume)}</span>
                      </div>
                    </>
                  ) : null}
                </CardContent>
              </Card>
            )}

            {/* Signal result */}
            {signalSent && (
              <Card className={cn(
                "border transition-colors",
                parsed?.signal === "BUY"  && "border-green-500/40 bg-green-500/5",
                parsed?.signal === "SELL" && "border-red-500/40 bg-red-500/5",
                parsed?.signal === "HOLD" && "border-yellow-500/40 bg-yellow-500/5",
                !parsed?.signal           && "border-border",
              )}>
                <CardContent className="p-4 space-y-2">
                  {isLoading && !parsed?.signal ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Sparkles className="h-4 w-4 animate-pulse text-primary" />
                      Generating AI signal…
                    </div>
                  ) : parsed?.signal ? (
                    <>
                      <SignalBadge signal={parsed.signal} />
                      {parsed.confidence && (
                        <p className="text-xs text-muted-foreground">
                          Confidence: <span className="font-medium text-foreground">{parsed.confidence}</span>
                        </p>
                      )}
                      {parsed.target && (
                        <p className="text-xs text-muted-foreground">
                          30d Target: <span className="font-medium text-foreground">{parsed.target}</span>
                        </p>
                      )}
                    </>
                  ) : null}
                </CardContent>
              </Card>
            )}

            <div className="flex gap-2 text-[11px] text-muted-foreground bg-muted/50 rounded-lg p-3">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <p>AI signals are for informational purposes only — not financial advice. Always do your own research.</p>
            </div>
          </div>

          {/* ── Right: Full AI Chat ──────────────────────────────────────────── */}
          <div className="lg:col-span-3 flex flex-col">
            <Card className="flex flex-col" style={{ height: 600 }}>
              <CardHeader className="pb-2 border-b shrink-0">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Bot className="h-4 w-4 text-primary" />
                  Finance Advisor Chat
                  <Badge variant="secondary" className="text-[10px] ml-auto">AI</Badge>
                </CardTitle>
              </CardHeader>

              <ScrollArea className="flex-1 px-4 py-3">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center gap-3 text-center py-10">
                    <div className="p-3 rounded-full bg-primary/10">
                      <Sparkles className="h-6 w-6 text-primary" />
                    </div>
                    <p className="text-sm font-medium">Finance Advisor AI</p>
                    <p className="text-xs text-muted-foreground max-w-xs">
                      Ask about any asset, market trend, economic news, or your portfolio.
                    </p>
                    <div className="grid gap-1.5 w-full max-w-xs mt-2">
                      {[
                        "What's your outlook on Bitcoin this month?",
                        "Explain rising interest rates' impact on crypto",
                        "Which sectors benefit from a strong dollar?",
                      ].map((q) => (
                        <button
                          key={q}
                          onClick={() => sendMessage(q)}
                          className="text-left text-xs px-3 py-2 rounded-lg border hover:bg-muted transition-colors"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn("flex gap-2.5", msg.role === "user" ? "justify-end" : "justify-start")}
                    >
                      {msg.role === "assistant" && (
                        <div className="p-1.5 rounded-full bg-primary/10 h-7 w-7 flex items-center justify-center shrink-0 mt-0.5">
                          <Bot className="h-3.5 w-3.5 text-primary" />
                        </div>
                      )}
                      <div className={cn(
                        "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap leading-relaxed",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-muted rounded-bl-sm"
                      )}>
                        {msg.content}
                      </div>
                      {msg.role === "user" && (
                        <div className="p-1.5 rounded-full bg-muted h-7 w-7 flex items-center justify-center shrink-0 mt-0.5">
                          <User className="h-3.5 w-3.5" />
                        </div>
                      )}
                    </div>
                  ))}

                  {isLoading && messages[messages.length - 1]?.role === "user" && (
                    <div className="flex gap-2.5 justify-start">
                      <div className="p-1.5 rounded-full bg-primary/10 h-7 w-7 flex items-center justify-center shrink-0">
                        <Bot className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div className="bg-muted rounded-2xl rounded-bl-sm px-3.5 py-3">
                        <div className="flex gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>
              </ScrollArea>

              <div className="p-3 border-t shrink-0">
                <div className="flex gap-2 items-end">
                  <Textarea
                    placeholder="Ask about any asset, market, or your portfolio…"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={handleChatKey}
                    rows={1}
                    className="resize-none text-sm min-h-[38px] max-h-[120px]"
                  />
                  <Button
                    size="icon"
                    onClick={handleChatSend}
                    disabled={!chatInput.trim() || isLoading}
                    className="shrink-0 h-9 w-9"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          </div>

        </div>
      </FinancePageShell>
    </FinanceLayout>
  );
}
