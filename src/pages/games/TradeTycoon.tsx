import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { useState, useMemo, useEffect } from "react";
import heroImg from "@/assets/game-tradetycoon.jpg";
import { useMultiplayer } from "@/hooks/useMultiplayer";
import { MultiplayerLobby } from "@/components/multiplayer/MultiplayerLobby";
import { WaitingRoom } from "@/components/multiplayer/WaitingRoom";
import { FinishBanner } from "@/components/multiplayer/OpponentPanel";
import { useAuth } from "@/contexts/AuthContext";
import { seededRng } from "@/systems/multiplayerSystem";

const GOODS = [
  { name: "☕ Coffee", buy: 10, volatility: 8 },
  { name: "🛢️ Oil", buy: 50, volatility: 20 },
  { name: "💎 Diamonds", buy: 200, volatility: 60 },
  { name: "📱 Tech", buy: 80, volatility: 30 },
];

const MAX_DAYS = 10;

function pricesForDay(seed: number, day: number) {
  let prices = GOODS.map((g) => g.buy);
  for (let d = 2; d <= day; d += 1) {
    const rng = seededRng(seed + d * 911);
    prices = GOODS.map((g, i) => Math.max(1, prices[i] + Math.floor((rng() - 0.45) * g.volatility)));
  }
  return prices;
}

function GoodsMarket({
  prices,
  inventory,
  qty,
  onQtyChange,
  onBuy,
  onSell,
  disabled = false,
}: {
  prices: number[];
  inventory: Record<string, number>;
  qty: Record<string, string>;
  onQtyChange: (good: string, value: string) => void;
  onBuy: (idx: number) => void;
  onSell: (idx: number) => void;
  disabled?: boolean;
}) {
  const { t } = useLanguage();
  return (
    <div className="space-y-4">
      {GOODS.map((good, i) => (
        <Card key={good.name}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-lg font-bold">{good.name}</p>
                <p className="text-sm text-muted-foreground">${prices[i]} | {t("tradetycoon.owned")}: {inventory[good.name] || 0}</p>
              </div>
              <div className="flex items-center gap-2">
                <Input type="number" min="1" className="w-20" value={qty[good.name] || ""} onChange={(e) => onQtyChange(good.name, e.target.value)} placeholder="Qty" disabled={disabled} />
                <Button size="sm" onClick={() => onBuy(i)} disabled={disabled}>{t("tradetycoon.buy")}</Button>
                <Button size="sm" variant="secondary" onClick={() => onSell(i)} disabled={disabled}>{t("tradetycoon.sell")}</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function useTrading(initialPrices: number[]) {
  const { playSound } = useSound();
  const [cash, setCash] = useState(1000);
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [qty, setQty] = useState<Record<string, string>>({});

  const totalValue = (prices: number[]) => cash + GOODS.reduce((sum, g, i) => sum + (inventory[g.name] || 0) * prices[i], 0);

  const buy = (idx: number, prices = initialPrices) => {
    const amount = parseInt(qty[GOODS[idx].name] || "0");
    if (!amount || amount <= 0) return;
    const cost = amount * prices[idx];
    if (cost > cash) { playSound("navigate"); return; }
    setCash((c) => c - cost);
    setInventory((inv) => ({ ...inv, [GOODS[idx].name]: (inv[GOODS[idx].name] || 0) + amount }));
    setQty((q) => ({ ...q, [GOODS[idx].name]: "" }));
    playSound("success");
  };

  const sell = (idx: number, prices = initialPrices) => {
    const have = inventory[GOODS[idx].name] || 0;
    if (!have) return;
    setCash((c) => c + have * prices[idx]);
    setInventory((inv) => ({ ...inv, [GOODS[idx].name]: 0 }));
    playSound("success");
  };

  return { cash, inventory, qty, setQty, totalValue, buy, sell };
}

function TradeTycoonSolo() {
  const { t } = useLanguage();
  const { playSound } = useSound();
  const [day, setDay] = useState(1);
  const [prices, setPrices] = useState(() => GOODS.map((g) => g.buy));
  const trading = useTrading(prices);
  const totalValue = trading.totalValue(prices);

  const nextDay = () => {
    setPrices(GOODS.map((g, i) => Math.max(1, prices[i] + Math.floor((Math.random() - 0.45) * g.volatility))));
    setDay((d) => d + 1);
    playSound("start");
  };

  return (
    <>
      <div className="flex justify-center gap-4 mb-6">
        <Badge>💰 ${trading.cash}</Badge>
        <Badge variant="secondary">{t("tradetycoon.day")} {day}</Badge>
        <Badge variant="outline">{t("tradetycoon.netWorth")}: ${totalValue}</Badge>
      </div>
      <GoodsMarket
        prices={prices}
        inventory={trading.inventory}
        qty={trading.qty}
        onQtyChange={(good, value) => trading.setQty((q) => ({ ...q, [good]: value }))}
        onBuy={(idx) => trading.buy(idx, prices)}
        onSell={(idx) => trading.sell(idx, prices)}
      />
      <Button className="w-full mt-6" size="lg" onClick={nextDay}>{t("tradetycoon.nextDay")} →</Button>
    </>
  );
}

function TradeTycoonMulti() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const mp = useMultiplayer("tradetycoon");
  const [day, setDay] = useState(1);
  const [finished, setFinished] = useState(false);
  const gs = mp.session?.game_state as Record<string, unknown> | null;
  const seed = (gs?.seed as number) ?? 3;
  const prices = useMemo(() => pricesForDay(seed, day), [seed, day]);
  const trading = useTrading(prices);
  const totalValue = trading.totalValue(prices);
  const opp = mp.opponents[0];
  const oppScore = mp.session?.players.find((p) => p.id !== user?.id)?.score ?? 0;
  const bothDone = gs && user && opp ? gs[`fin_${user.id}`] === true && gs[`fin_${opp.id}`] === true : false;

  useEffect(() => {
    if (mp.status === "playing") mp.updateMyScore(totalValue, finished);
  }, [totalValue, finished]);

  useEffect(() => {
    if (bothDone && mp.status === "playing") {
      const sorted = [...mp.session!.players].sort((a, b) => b.score - a.score);
      mp.endGame(sorted[0].score !== sorted[1]?.score ? sorted[0].id : undefined);
    }
  }, [bothDone, mp]);

  const nextDay = () => {
    if (day >= MAX_DAYS) {
      setFinished(true);
      mp.updateMyScore(totalValue, true);
      return;
    }
    setDay((d) => d + 1);
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
        <Badge variant="outline">{t("tradetycoon.day")} {day}/{MAX_DAYS}</Badge>
        <div className="text-center"><p className="text-xs text-muted-foreground">{opp?.name ?? "Opponent"}</p><p className="text-xl font-bold">${oppScore}</p></div>
      </div>
      {finished ? (
        <Card><CardContent className="pt-6 text-center space-y-2">
          <p className="text-xl font-bold">Market closed ✅</p>
          <p className="text-muted-foreground">Net worth: ${totalValue} — Waiting for opponent…</p>
        </CardContent></Card>
      ) : (
        <>
          <GoodsMarket
            prices={prices}
            inventory={trading.inventory}
            qty={trading.qty}
            onQtyChange={(good, value) => trading.setQty((q) => ({ ...q, [good]: value }))}
            onBuy={(idx) => trading.buy(idx, prices)}
            onSell={(idx) => trading.sell(idx, prices)}
          />
          <Button className="w-full mt-2" size="lg" onClick={nextDay}>{day >= MAX_DAYS ? "Finish" : `${t("tradetycoon.nextDay")} →`}</Button>
        </>
      )}
    </div>
  );
}

export default function TradeTycoon() {
  const { t } = useLanguage();
  const [mode, setMode] = useState<"solo" | "multi">("solo");

  return (
    <Layout>
      <section className="mx-auto max-w-2xl px-4 py-10">
        <div className="relative mb-6 overflow-hidden rounded-2xl">
          <img src={heroImg} alt="" role="presentation" className="h-40 w-full object-cover sm:h-48" width={800} height={512} loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 text-center">
            <h1 className="text-3xl font-bold">📈 {t("tradetycoon.title")}</h1>
          </div>
        </div>
        <div className="flex rounded-lg overflow-hidden border mb-6">
          <button onClick={() => setMode("solo")} className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "solo" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>🎮 Solo</button>
          <button onClick={() => setMode("multi")} className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "multi" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>👥 Online</button>
        </div>
        {mode === "solo" ? <TradeTycoonSolo /> : <TradeTycoonMulti />}
      </section>
    </Layout>
  );
}
