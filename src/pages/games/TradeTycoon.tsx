import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { useGameSounds } from "@/hooks/useGameSounds";
import { useHighScore } from "@/hooks/useHighScore";
import { GameHeader } from "@/components/game/GameHeader";
import { HowToPlay } from "@/components/game/HowToPlay";
import { useState, useMemo, useEffect } from "react";
import heroImg from "@/assets/game-tradetycoon.jpg";
import { useMultiplayer } from "@/hooks/useMultiplayer";
import { MultiplayerLobby } from "@/components/multiplayer/MultiplayerLobby";
import { WaitingRoom } from "@/components/multiplayer/WaitingRoom";
import { FinishBanner } from "@/components/multiplayer/OpponentPanel";
import { useAuth } from "@/contexts/AuthContext";
import { seededRng } from "@/systems/multiplayerSystem";

// 8 goods with i18n keys
const GOODS = [
  { key: "coffee",   buy: 10,  volatility: 8  },
  { key: "oil",      buy: 50,  volatility: 20 },
  { key: "diamonds", buy: 200, volatility: 60 },
  { key: "tech",     buy: 80,  volatility: 30 },
  { key: "grain",    buy: 15,  volatility: 6  },
  { key: "gold",     buy: 120, volatility: 25 },
  { key: "medicine", buy: 60,  volatility: 15 },
  { key: "lumber",   buy: 25,  volatility: 10 },
];

const NEWS_COUNT = 11;
const MAX_DAYS = 10;
const STARTING_CASH = 1000;

// News events slightly boost/reduce the corresponding good
const NEWS_EFFECTS: Record<number, { good: number; delta: number }> = {
  0: { good: 3, delta:  15 }, // tech up
  1: { good: 1, delta:  18 }, // oil up
  2: { good: 0, delta:  12 }, // coffee up
  3: { good: 6, delta:  20 }, // medicine up
  4: { good: 4, delta: -10 }, // grain down
  5: { good: 2, delta: -25 }, // diamonds down
  6: { good: 5, delta:  15 }, // gold up
  7: { good: 7, delta:  18 }, // lumber up
  8: { good: -1, delta:  0 }, // neutral
  9: { good: 1, delta:  10 }, // oil+tech
  10:{ good: -1, delta:  5 }, // all up slightly
};

function pricesForDay(seed: number, day: number, newsEvents: number[]): number[] {
  let prices = GOODS.map(g => g.buy);
  for (let d = 2; d <= day; d++) {
    const rng = seededRng(seed + d * 911);
    const newsIdx = newsEvents[d - 2] ?? -1;
    const effect = NEWS_EFFECTS[newsIdx];
    prices = GOODS.map((g, i) => {
      let base = Math.max(1, prices[i] + Math.floor((rng() - 0.45) * g.volatility));
      if (effect && (effect.good === i || effect.good === -1)) base += effect.delta;
      return Math.max(1, base);
    });
  }
  return prices;
}

function useTrading(prices: number[]) {
  const { tradeCashRegister, tradeMarketFall } = useGameSounds();
  const [cash, setCash] = useState(STARTING_CASH);
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [qty, setQty] = useState<Record<string, string>>({});

  const totalValue = (p: number[]) =>
    cash + GOODS.reduce((sum, g, i) => sum + (inventory[g.key] || 0) * p[i], 0);

  const buy = (idx: number, p = prices) => {
    const amount = parseInt(qty[GOODS[idx].key] || "0");
    if (!amount || amount <= 0) return;
    const cost = amount * p[idx];
    if (cost > cash) { tradeMarketFall(); return; }
    setCash(c => c - cost);
    setInventory(inv => ({ ...inv, [GOODS[idx].key]: (inv[GOODS[idx].key] || 0) + amount }));
    setQty(q => ({ ...q, [GOODS[idx].key]: "" }));
    tradeCashRegister();
  };

  const sell = (idx: number, p = prices) => {
    const have = inventory[GOODS[idx].key] || 0;
    if (!have) return;
    setCash(c => c + have * p[idx]);
    setInventory(inv => ({ ...inv, [GOODS[idx].key]: 0 }));
    tradeCashRegister();
  };

  return { cash, inventory, qty, setQty, totalValue, buy, sell };
}

// ─── Solo ──────────────────────────────────────────────────────────────────────
function TradeTycoonSolo() {
  const { t } = useLanguage();
  const { tradeMarketRise, tradeLoss } = useGameSounds();
  const { highScore, updateHighScore } = useHighScore("tradetycoon");

  const seed = useMemo(() => Math.floor(Math.random() * 999999), []);
  const [day, setDay] = useState(1);
  const [newsEvents] = useState<number[]>(() =>
    Array.from({ length: MAX_DAYS - 1 }, () => Math.floor(Math.random() * NEWS_COUNT))
  );
  const [currentNews, setCurrentNews] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const [newRecord, setNewRecord] = useState(false);

  const prices = useMemo(() => pricesForDay(seed, day, newsEvents), [seed, day, newsEvents]);
  const prevPrices = useMemo(() => day > 1 ? pricesForDay(seed, day - 1, newsEvents) : prices, [seed, day, newsEvents, prices]);
  const trading = useTrading(prices);
  const totalValue = trading.totalValue(prices);
  const profitLoss = totalValue - STARTING_CASH;

  const nextDay = () => {
    if (day >= MAX_DAYS) {
      const isNew = updateHighScore(totalValue);
      setNewRecord(isNew);
      setDone(true);
      return;
    }
    const news = newsEvents[day - 1];
    setCurrentNews(news);
    setDay(d => d + 1);
    profitLoss > 0 ? tradeMarketRise() : tradeLoss();
  };

  if (done) {
    return (
      <Card><CardContent className="pt-6 text-center space-y-4">
        <p className="text-5xl">🏆</p>
        {newRecord && <p className="text-primary font-bold animate-bounce">{t("games.newRecord")}</p>}
        <p className="text-2xl font-bold">{t("tradetycoon.netWorth")}: ${totalValue.toLocaleString()}</p>
        <p className={`font-semibold ${profitLoss >= 0 ? "text-green-500" : "text-destructive"}`}>
          {profitLoss >= 0 ? "+" : ""}{profitLoss.toLocaleString()} vs start
        </p>
        <p className="text-muted-foreground">{t("games.highScore")}: ${highScore.toLocaleString()}</p>
        <Button size="lg" onClick={() => window.location.reload()}>{t("tradetycoon.restart")}</Button>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className="flex flex-wrap justify-between items-center gap-2 rounded-lg border p-3">
        <Badge className="gap-1">💰 ${trading.cash.toLocaleString()}</Badge>
        <Badge variant="secondary">{t("tradetycoon.day").replace("{n}", String(day)).replace("{total}", String(MAX_DAYS))}</Badge>
        <Badge variant="outline">{t("tradetycoon.netWorth")}: ${totalValue.toLocaleString()}</Badge>
        <Badge className={profitLoss >= 0 ? "bg-green-500/20 text-green-600" : "bg-red-500/20 text-destructive"}>
          {profitLoss >= 0 ? "+" : ""}{profitLoss.toLocaleString()}
        </Badge>
      </div>

      {/* Market News */}
      {currentNews !== null && (
        <Card className="border-amber-400/40 bg-amber-50/50 dark:bg-amber-950/20 animate-in slide-in-from-top-2 duration-300">
          <CardContent className="py-3 flex items-center gap-2">
            <span className="text-2xl">📰</span>
            <p className="text-sm font-semibold">{t(`tradetycoon.news.${currentNews}`)}</p>
          </CardContent>
        </Card>
      )}

      {/* Goods market */}
      <div className="space-y-3">
        {GOODS.map((good, i) => {
          const prevPrice = prevPrices[i];
          const curPrice = prices[i];
          const delta = curPrice - prevPrice;
          return (
            <Card key={good.key}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="font-bold">{t(`tradetycoon.good.${good.key}`)}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-lg font-bold">${curPrice}</p>
                      {day > 1 && (
                        <span className={`text-xs font-semibold ${delta > 0 ? "text-green-500" : delta < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                          {delta > 0 ? "▲" : delta < 0 ? "▼" : "—"}{Math.abs(delta)}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">{t("tradetycoon.owned")}: {trading.inventory[good.key] || 0}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number" min="1" className="w-16 h-8 text-sm"
                      value={trading.qty[good.key] || ""}
                      onChange={e => trading.setQty(q => ({ ...q, [good.key]: e.target.value }))}
                      placeholder="Qty"
                    />
                    <Button size="sm" className="h-8" onClick={() => trading.buy(i, prices)}>{t("tradetycoon.buy")}</Button>
                    <Button size="sm" variant="secondary" className="h-8" onClick={() => trading.sell(i, prices)}
                      disabled={!trading.inventory[good.key]}>{t("tradetycoon.sell")}</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Button className="w-full" size="lg" onClick={nextDay}>
        {day >= MAX_DAYS ? "📊 " + t("tradetycoon.finalDay") : t("tradetycoon.nextDay") + " →"}
      </Button>
    </div>
  );
}

// ─── Multiplayer ────────────────────────────────────────────────────────────────
function TradeTycoonMulti() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const mp = useMultiplayer("tradetycoon");
  const [day, setDay] = useState(1);
  const [finished, setFinished] = useState(false);
  const [newsEvents] = useState<number[]>(() =>
    Array.from({ length: MAX_DAYS - 1 }, () => Math.floor(Math.random() * NEWS_COUNT))
  );
  const gs = mp.session?.game_state as Record<string, unknown> | null;
  const seed = (gs?.seed as number) ?? 3;
  const prices = useMemo(() => pricesForDay(seed, day, newsEvents), [seed, day, newsEvents]);
  const trading = useTrading(prices);
  const totalValue = trading.totalValue(prices);
  const opp = mp.opponents[0];
  const oppScore = mp.session?.players.find(p => p.id !== user?.id)?.score ?? 0;
  const bothDone = gs && user && opp
    ? gs[`fin_${user.id}`] === true && gs[`fin_${opp.id}`] === true : false;

  useEffect(() => {
    if (mp.status === "playing") mp.updateMyScore(totalValue, finished);
  }, [totalValue, finished]);

  useEffect(() => {
    if (bothDone && mp.status === "playing") {
      const sorted = [...mp.session!.players].sort((a, b) => b.score - a.score);
      mp.endGame(sorted[0].score !== sorted[1]?.score ? sorted[0].id : undefined);
    }
  }, [bothDone]);

  const nextDay = () => {
    if (day >= MAX_DAYS) { setFinished(true); mp.updateMyScore(totalValue, true); return; }
    setDay(d => d + 1);
  };

  if (mp.status === "idle")
    return <MultiplayerLobby gameType="tradetycoon" loading={mp.loading} onCreateRoom={mp.createRoom} onJoinRoom={mp.joinRoom} />;
  if (mp.status === "waiting")
    return <WaitingRoom session={mp.session!} isHost={mp.isHost} onStart={() => mp.startGame({ seed: Math.floor(Math.random() * 999999) })} onLeave={mp.leaveRoom} />;
  if (mp.status === "finished")
    return <FinishBanner winnerId={mp.session!.winner_id} myId={user?.id ?? ""} players={mp.session!.players} onRematch={mp.leaveRoom} />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between rounded-lg border p-3 text-sm">
        <div className="text-center"><p className="text-xs text-muted-foreground">You</p><p className="text-xl font-bold text-primary">${totalValue}</p></div>
        <Badge variant="outline">Day {day}/{MAX_DAYS}</Badge>
        <div className="text-center"><p className="text-xs text-muted-foreground">{opp?.name}</p><p className="text-xl font-bold">${oppScore}</p></div>
      </div>
      {finished ? (
        <Card><CardContent className="pt-6 text-center"><p className="font-bold">Market closed ✅ Waiting…</p></CardContent></Card>
      ) : (
        <>
          <div className="space-y-2">
            {GOODS.map((good, i) => (
              <Card key={good.key}><CardContent className="pt-3 pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="font-semibold text-sm">{t(`tradetycoon.good.${good.key}`)}</p>
                    <p className="text-base font-bold">${prices[i]}</p>
                  </div>
                  <div className="flex gap-1">
                    <Input type="number" className="w-14 h-7 text-xs"
                      value={trading.qty[good.key] || ""}
                      onChange={e => trading.setQty(q => ({ ...q, [good.key]: e.target.value }))} placeholder="Qty" />
                    <Button size="sm" className="h-7 text-xs" onClick={() => trading.buy(i, prices)}>{t("tradetycoon.buy")}</Button>
                    <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => trading.sell(i, prices)}>{t("tradetycoon.sell")}</Button>
                  </div>
                </div>
              </CardContent></Card>
            ))}
          </div>
          <Button className="w-full" size="lg" onClick={nextDay}>{day >= MAX_DAYS ? "Finish" : `Next Day →`}</Button>
        </>
      )}
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────────
export default function TradeTycoon() {
  const { t } = useLanguage();
  const { highScore } = useHighScore("tradetycoon");
  const [mode, setMode] = useState<"solo" | "multi">("solo");

  return (
    <Layout>
      <section className="mx-auto max-w-2xl px-4 py-10">
        <div className="relative mb-6 overflow-hidden rounded-2xl">
          <img src={heroImg} alt="" role="presentation" className="h-40 w-full object-cover sm:h-48" width={800} height={512} loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute bottom-4 start-4 end-4 text-center">
            <h1 className="text-3xl font-bold">📈 {t("tradetycoon.title")}</h1>
          </div>
        </div>
        <GameHeader
          title={t("tradetycoon.title")}
          highScore={highScore}
          extra={
            <HowToPlay
              titleKey="tradetycoon.title"
              steps={["tradetycoon.howTo.1","tradetycoon.howTo.2","tradetycoon.howTo.3","tradetycoon.howTo.4"]}
            />
          }
        />
        <div className="flex rounded-lg overflow-hidden border mb-6">
          <button onClick={() => setMode("solo")}  className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "solo"  ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>🎮 Solo</button>
          <button onClick={() => setMode("multi")} className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "multi" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>👥 Online</button>
        </div>
        {mode === "solo" ? <TradeTycoonSolo /> : <TradeTycoonMulti />}
      </section>
    </Layout>
  );
}
