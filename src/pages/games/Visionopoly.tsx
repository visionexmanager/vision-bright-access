import { useEffect, useMemo, useRef, useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import { useGameEconomy } from "@/components/game/GameEconomyGate";
import { Building2, Dice5, Hotel, RotateCcw, Save, ShieldAlert, Sparkles, Trophy, Users } from "lucide-react";
import {
  BOARD, BoardSpace, GameState, buildOn, buyPending, canBuild, createGame,
  declinePending, endTurn, isValidSavedGame, netWorth, rollDice, sellBuilding,
  toggleMortgage, tradeProperty, leaveJail,
} from "@/lib/games/visionopolyEngine";

const STORAGE_KEY = "visionex-visionopoly-save-v1";
const GROUP_COLORS: Record<string, string> = {
  brown: "#92400e", sky: "#38bdf8", pink: "#ec4899", orange: "#f97316",
  red: "#ef4444", yellow: "#eab308", green: "#16a34a", navy: "#1e3a8a",
};

function gridPosition(index: number) {
  if (index <= 10) return { row: 11, col: 11 - index };
  if (index <= 20) return { row: 21 - index, col: 1 };
  if (index <= 30) return { row: 1, col: index - 19 };
  return { row: index - 29, col: 11 };
}

function money(value: number) {
  return `$${Math.max(0, value).toLocaleString()}`;
}

export default function Visionopoly() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { settleGameResult } = useGameEconomy();
  const [state, setState] = useState<GameState | null>(null);
  const [botCount, setBotCount] = useState(3);
  const [quick, setQuick] = useState(true);
  const [hasSave, setHasSave] = useState(false);
  const [notice, setNotice] = useState("");
  const settled = useRef(false);

  const text = useMemo(() => ar ? {
    title: "مونوبولي VisionEx", subtitle: "اشترِ المدن، ابنِ المشاريع، فاوض المنافسين واصنع إمبراطوريتك.",
    newGame: "لعبة جديدة", resume: "متابعة اللعبة", quick: "سريعة — 50 جولة", classic: "كلاسيكية — حتى الإفلاس",
    opponents: "عدد المنافسين", start: "ابدأ اللعب", roll: "ارمِ النرد", end: "إنهاء الدور",
    buy: "شراء", skip: "تخطي", properties: "العقارات", trade: "التجارة", activity: "سجل الأحداث",
    build: "بناء", sell: "بيع بناء", mortgage: "رهن", unmortgage: "فك الرهن", offer: "شراء من المنافس",
    jail: "أنت محتجز", pay: "ادفع $50", card: "استخدم بطاقة الخروج", save: "تم حفظ اللعبة",
    restart: "لعبة جديدة", winner: "الفائز", round: "الجولة", cash: "الرصيد", worth: "الثروة",
    waiting: "جاري تنفيذ دور المنافس…", hotel: "فندق", house: "منزل", owned: "مملوك", bankrupt: "مفلس",
  } : {
    title: "VisionEx Monopoly", subtitle: "Buy cities, develop property, trade with rivals, and build your empire.",
    newGame: "New game", resume: "Resume game", quick: "Quick — 50 rounds", classic: "Classic — until bankruptcy",
    opponents: "Opponents", start: "Start game", roll: "Roll dice", end: "End turn",
    buy: "Buy", skip: "Skip", properties: "Properties", trade: "Trade", activity: "Activity",
    build: "Build", sell: "Sell building", mortgage: "Mortgage", unmortgage: "Unmortgage", offer: "Buy from rival",
    jail: "You are detained", pay: "Pay $50", card: "Use release card", save: "Game saved",
    restart: "New game", winner: "Winner", round: "Round", cash: "Cash", worth: "Net worth",
    waiting: "Opponent is playing…", hotel: "Hotel", house: "House", owned: "Owned", bankrupt: "Bankrupt",
  }, [ar]);

  useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
      setHasSave(isValidSavedGame(parsed) && parsed.status === "playing");
    } catch { setHasSave(false); }
  }, []);

  useEffect(() => {
    if (!state || state.status !== "playing") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setHasSave(true);
  }, [state]);

  useEffect(() => {
    if (!state || state.status !== "playing") return;
    const player = state.players[state.currentPlayer];
    if (!player.isBot) return;
    const timer = window.setTimeout(() => {
      setState((current) => {
        if (!current || current.status !== "playing" || !current.players[current.currentPlayer].isBot) return current;
        const bot = current.players[current.currentPlayer];
        if (current.pending) {
          const space = BOARD[current.pending.spaceIndex];
          return space.price && bot.cash >= space.price + 250 ? buyPending(current) : declinePending(current);
        }
        if (current.dice[0] === 0) {
          if (bot.inJail && bot.cash > 350) return leaveJail(current, "pay");
          return rollDice(current);
        }
        const buildable = Object.keys(current.properties).map(Number).find((index) =>
          canBuild(current, bot.id, index) && bot.cash > (BOARD[index].buildCost ?? 0) + 350
        );
        if (buildable !== undefined) return buildOn(current, buildable);
        return endTurn(current);
      });
    }, 650);
    return () => window.clearTimeout(timer);
  }, [state]);

  useEffect(() => {
    if (!state || state.status !== "finished" || state.winnerId === null || settled.current) return;
    settled.current = true;
    void settleGameResult(state.winnerId === 0 ? "win" : "loss", "Visionopoly");
    localStorage.removeItem(STORAGE_KEY);
    setHasSave(false);
  }, [settleGameResult, state]);

  const start = () => {
    settled.current = false;
    setState(createGame(botCount, quick ? 50 : null));
  };

  const resume = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
      if (isValidSavedGame(parsed)) setState(parsed);
    } catch { setHasSave(false); }
  };

  const saveNow = () => {
    if (!state) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setNotice(text.save);
    window.setTimeout(() => setNotice(""), 1800);
  };

  if (!state) {
    return (
      <Layout>
        <section className="section-container max-w-3xl py-12">
          <Card className="overflow-hidden border-violet-500/30">
            <div className="bg-gradient-to-br from-violet-950 via-indigo-900 to-emerald-900 p-8 text-center text-white">
              <div className="text-7xl">🎩</div>
              <h1 className="mt-3 text-3xl font-black">{text.title}</h1>
              <p className="mx-auto mt-2 max-w-xl text-violet-100">{text.subtitle}</p>
            </div>
            <CardContent className="space-y-6 p-6">
              <div>
                <p className="mb-3 font-semibold">{text.opponents}</p>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map((count) => <Button key={count} variant={botCount === count ? "default" : "outline"} onClick={() => setBotCount(count)}><Users className="me-2 h-4 w-4" />{count}</Button>)}
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button variant={quick ? "default" : "outline"} onClick={() => setQuick(true)}>{text.quick}</Button>
                <Button variant={!quick ? "default" : "outline"} onClick={() => setQuick(false)}>{text.classic}</Button>
              </div>
              <Button size="lg" className="w-full" onClick={start}><Dice5 className="me-2" />{text.start}</Button>
              {hasSave && <Button size="lg" variant="secondary" className="w-full" onClick={resume}><Save className="me-2" />{text.resume}</Button>}
            </CardContent>
          </Card>
        </section>
      </Layout>
    );
  }

  const current = state.players[state.currentPlayer];
  const humanTurn = current.id === 0 && current.active;
  const pendingSpace = state.pending ? BOARD[state.pending.spaceIndex] : null;
  const winner = state.winnerId === null ? null : state.players[state.winnerId];

  return (
    <Layout>
      <section className="section-container py-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div><h1 className="text-2xl font-black">🎩 {text.title}</h1><p className="text-sm text-muted-foreground">{text.round} {state.round}{state.maxRounds ? ` / ${state.maxRounds}` : ""}</p></div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={saveNow}><Save className="me-1 h-4 w-4" />{notice || "Save"}</Button>
            <Button size="sm" variant="outline" onClick={() => { localStorage.removeItem(STORAGE_KEY); setState(null); }}><RotateCcw className="me-1 h-4 w-4" />{text.restart}</Button>
          </div>
        </div>

        <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {state.players.map((player) => (
            <Card key={player.id} className={`${state.currentPlayer === player.id ? "ring-2 ring-primary" : ""} ${!player.active ? "opacity-50" : ""}`}>
              <CardContent className="flex items-center justify-between p-3">
                <div><p className="font-bold">{player.token} {player.id === 0 && ar ? "أنت" : player.name}</p><p className="text-xs text-muted-foreground">{player.active ? `${text.worth}: ${money(netWorth(state, player.id))}` : text.bankrupt}</p></div>
                <Badge variant={player.cash < 200 ? "destructive" : "secondary"}>{money(player.cash)}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>

        {winner ? (
          <Card className="mb-5 border-amber-400 bg-amber-500/10"><CardContent className="space-y-4 p-8 text-center">
            <Trophy className="mx-auto h-14 w-14 text-amber-500" /><h2 className="text-3xl font-black">{text.winner}: {winner.token} {winner.id === 0 && ar ? "أنت" : winner.name}</h2>
            <p>{text.worth}: {money(netWorth(state, winner.id))}</p><Button onClick={() => setState(null)}>{text.restart}</Button>
          </CardContent></Card>
        ) : (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="overflow-x-auto rounded-xl border bg-emerald-950/10 p-2">
              <div className="relative mx-auto grid min-h-[760px] min-w-[760px] grid-cols-11 grid-rows-11 gap-px bg-slate-800 p-px shadow-2xl">
                {BOARD.map((space) => {
                  const pos = gridPosition(space.index);
                  const owned = state.properties[space.index];
                  const tokens = state.players.filter((player) => player.active && player.position === space.index);
                  return (
                    <div key={space.index} style={{ gridRow: pos.row, gridColumn: pos.col }} className="relative flex min-h-[68px] min-w-[68px] flex-col overflow-hidden bg-card p-1 text-center text-[9px]">
                      {space.group && <div className="absolute inset-x-0 top-0 h-2" style={{ background: GROUP_COLORS[space.group] }} />}
                      <p className={`mt-2 line-clamp-2 font-bold leading-tight ${space.kind === "goToJail" ? "text-destructive" : ""}`}>{ar ? space.nameAr : space.name}</p>
                      {space.price && <span className="mt-auto text-[8px] text-muted-foreground">{money(space.price)}</span>}
                      {owned && <span className="absolute bottom-0 start-0 rounded-tr bg-slate-900 px-1 text-[8px] text-white">{state.players[owned.ownerId].token}{owned.mortgaged ? "🔒" : owned.buildings === 5 ? "🏨" : "🏠".repeat(owned.buildings)}</span>}
                      {tokens.length > 0 && <div className="absolute end-0 top-1/2 flex max-w-[42px] flex-wrap justify-end text-sm">{tokens.map((player) => <span key={player.id}>{player.token}</span>)}</div>}
                    </div>
                  );
                })}
                <div className="col-start-2 col-end-11 row-start-2 row-end-11 flex flex-col items-center justify-center bg-gradient-to-br from-emerald-50 to-violet-100 p-8 text-center text-slate-900">
                  <Sparkles className="h-12 w-12 text-violet-700" /><p className="mt-2 text-4xl font-black text-violet-900">VISIONOPOLY</p>
                  <p className="mt-1 text-sm font-semibold text-emerald-800">BUILD • TRADE • WIN</p>
                  <div className="mt-8 flex items-center gap-4"><span className="rounded-xl bg-white p-4 text-4xl shadow">{state.dice[0] || "–"}</span><span className="rounded-xl bg-white p-4 text-4xl shadow">{state.dice[1] || "–"}</span></div>
                  <p className="mt-5 font-bold">{current.token} {current.id === 0 && ar ? "دورك" : `${current.name}'s turn`}</p>
                  {humanTurn && current.inJail && <div className="mt-4 rounded-lg bg-red-100 p-3"><p className="mb-2 font-bold text-red-700"><ShieldAlert className="me-1 inline h-4 w-4" />{text.jail}</p><div className="flex gap-2"><Button size="sm" onClick={() => setState(leaveJail(state, "pay"))} disabled={current.cash < 50}>{text.pay}</Button>{current.getOutCards > 0 && <Button size="sm" variant="outline" onClick={() => setState(leaveJail(state, "card"))}>{text.card}</Button>}</div></div>}
                  {humanTurn && pendingSpace && <div className="mt-4 rounded-lg bg-white p-4 shadow"><p className="font-bold">{ar ? pendingSpace.nameAr : pendingSpace.name} — {money(pendingSpace.price ?? 0)}</p><div className="mt-2 flex justify-center gap-2"><Button onClick={() => setState(buyPending(state))} disabled={current.cash < (pendingSpace.price ?? 0)}>{text.buy}</Button><Button variant="outline" onClick={() => setState(declinePending(state))}>{text.skip}</Button></div></div>}
                  {humanTurn && !state.pending && <div className="mt-5">{state.dice[0] === 0 ? <Button size="lg" onClick={() => setState(rollDice(state))}><Dice5 className="me-2" />{text.roll}</Button> : <Button size="lg" onClick={() => setState(endTurn(state))}>{text.end}</Button>}</div>}
                  {!humanTurn && <p className="mt-5 animate-pulse text-sm text-violet-700">{text.waiting}</p>}
                </div>
              </div>
            </div>

            <Tabs defaultValue="properties">
              <TabsList className="grid w-full grid-cols-3"><TabsTrigger value="properties">{text.properties}</TabsTrigger><TabsTrigger value="trade">{text.trade}</TabsTrigger><TabsTrigger value="log">{text.activity}</TabsTrigger></TabsList>
              <TabsContent value="properties" className="space-y-2">
                {Object.entries(state.properties).filter(([, owned]) => owned.ownerId === 0).length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">—</p>}
                {Object.entries(state.properties).filter(([, owned]) => owned.ownerId === 0).map(([indexValue, owned]) => {
                  const index = Number(indexValue); const space = BOARD[index];
                  return <Card key={index}><CardHeader className="p-3 pb-1"><CardTitle className="flex items-center justify-between text-sm"><span>{ar ? space.nameAr : space.name}</span><Badge variant="outline">{owned.mortgaged ? "🔒" : owned.buildings === 5 ? `🏨 ${text.hotel}` : `${"🏠".repeat(owned.buildings)} ${owned.buildings}`}</Badge></CardTitle></CardHeader><CardContent className="flex flex-wrap gap-1 p-3 pt-2">
                    <Button size="sm" onClick={() => setState(buildOn(state, index))} disabled={!humanTurn || !canBuild(state, 0, index) || current.cash < (space.buildCost ?? 0)}><Building2 className="me-1 h-3 w-3" />{text.build} {space.buildCost ? money(space.buildCost) : ""}</Button>
                    <Button size="sm" variant="secondary" onClick={() => setState(sellBuilding(state, index))} disabled={!humanTurn || owned.buildings === 0}>{text.sell}</Button>
                    <Button size="sm" variant="outline" onClick={() => setState(toggleMortgage(state, index))} disabled={!humanTurn || owned.buildings > 0}>{owned.mortgaged ? text.unmortgage : text.mortgage}</Button>
                  </CardContent></Card>;
                })}
              </TabsContent>
              <TabsContent value="trade" className="space-y-2">
                <p className="px-1 text-xs text-muted-foreground">{ar ? "اشترِ عقاراً غير مطوّر من منافس بعرض عادل." : "Buy an undeveloped rival property with a fair offer."}</p>
                {Object.entries(state.properties).filter(([, owned]) => owned.ownerId !== 0 && !owned.mortgaged && owned.buildings === 0).map(([indexValue, owned]) => {
                  const index = Number(indexValue); const space = BOARD[index]; const offer = Math.ceil((space.price ?? 0) * 1.25);
                  return <Card key={index}><CardContent className="flex items-center justify-between gap-2 p-3"><div><p className="text-sm font-bold">{state.players[owned.ownerId].token} {ar ? space.nameAr : space.name}</p><p className="text-xs text-muted-foreground">{money(offer)}</p></div><Button size="sm" onClick={() => setState(tradeProperty(state, 0, index, offer))} disabled={!humanTurn || state.players[0].cash < offer}>{text.offer}</Button></CardContent></Card>;
                })}
              </TabsContent>
              <TabsContent value="log"><Card><CardContent className="max-h-[620px] space-y-2 overflow-y-auto p-4">{state.log.map((entry, index) => <p key={`${entry}-${index}`} className="border-b pb-2 text-xs">{entry}</p>)}</CardContent></Card></TabsContent>
            </Tabs>
          </div>
        )}
      </section>
    </Layout>
  );
}
