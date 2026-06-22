import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useGameSounds } from "@/hooks/useGameSounds";
import { useHighScore } from "@/hooks/useHighScore";
import { GameHeader } from "@/components/game/GameHeader";
import { HowToPlay } from "@/components/game/HowToPlay";
import { useState } from "react";
import heroImg from "@/assets/game-fashion.jpg";
import { useGameEconomy } from "@/components/game/GameEconomyGate";

const FABRIC_KEYS = ["silk", "denim", "wool", "cotton", "satin"] as const;
const COLOR_KEYS  = ["red", "blue", "green", "black", "white", "gold"] as const;
const STYLE_KEYS  = ["dress", "suit", "casual", "coat", "traditional"] as const;

// Occasions with their ideal combinations (any of these = perfect match)
const OCCASIONS = [
  {
    key: "wedding",
    perfect: [
      { fabric: "silk",  color: "white", style: "dress" },
      { fabric: "satin", color: "white", style: "dress" },
      { fabric: "silk",  color: "gold",  style: "dress" },
    ],
    good: [
      { fabric: "satin", color: "gold",  style: "dress" },
      { fabric: "silk",  color: "white", style: "suit"  },
      { fabric: "wool",  color: "white", style: "dress" },
    ],
  },
  {
    key: "beach",
    perfect: [
      { fabric: "cotton", color: "blue",  style: "casual" },
      { fabric: "cotton", color: "white", style: "casual" },
      { fabric: "denim",  color: "blue",  style: "casual" },
    ],
    good: [
      { fabric: "cotton", color: "green", style: "casual" },
      { fabric: "denim",  color: "white", style: "casual" },
    ],
  },
  {
    key: "business",
    perfect: [
      { fabric: "wool",  color: "black", style: "suit" },
      { fabric: "wool",  color: "blue",  style: "suit" },
      { fabric: "silk",  color: "black", style: "suit" },
    ],
    good: [
      { fabric: "cotton", color: "black", style: "suit" },
      { fabric: "wool",   color: "black", style: "coat" },
    ],
  },
  {
    key: "sports",
    perfect: [
      { fabric: "cotton", color: "blue",  style: "casual" },
      { fabric: "cotton", color: "green", style: "casual" },
      { fabric: "cotton", color: "red",   style: "casual" },
    ],
    good: [
      { fabric: "denim",  color: "blue",  style: "casual" },
      { fabric: "cotton", color: "black", style: "casual" },
    ],
  },
  {
    key: "gala",
    perfect: [
      { fabric: "silk",  color: "black", style: "dress" },
      { fabric: "satin", color: "gold",  style: "dress" },
      { fabric: "silk",  color: "gold",  style: "dress" },
    ],
    good: [
      { fabric: "wool",  color: "black", style: "suit"  },
      { fabric: "silk",  color: "blue",  style: "dress" },
    ],
  },
];

function scoreDesign(
  occasion: typeof OCCASIONS[number],
  fabric: string,
  color: string,
  style: string,
): { pts: number; level: "perfect" | "good" | "poor" } {
  const perfect = occasion.perfect.some(
    c => c.fabric === fabric && c.color === color && c.style === style
  );
  if (perfect) return { pts: 200, level: "perfect" };

  const good = occasion.good.some(
    c => (c.fabric === fabric || c.color === color || c.style === style)
  );
  if (good) return { pts: 100, level: "good" };

  return { pts: -50, level: "poor" };
}

// ─── Challenge mode ─────────────────────────────────────────────────────────────
function FashionChallenge() {
  const { t } = useLanguage();
  const { fashionSwish, fashionSewing, fashionApproval, fashionWrong } = useGameSounds();
  const { highScore, updateHighScore } = useHighScore("fashion");
  const { settleGameResult } = useGameEconomy();

  const [round, setRound] = useState(0);
  const [fabric, setFabric] = useState<string | null>(null);
  const [color,  setColor]  = useState<string | null>(null);
  const [style,  setStyle]  = useState<string | null>(null);
  const [score,  setScore]  = useState(0);
  const [result, setResult] = useState<{ pts: number; level: "perfect" | "good" | "poor" } | null>(null);
  const [done,   setDone]   = useState(false);
  const [newRecord, setNewRecord] = useState(false);

  const occasion = OCCASIONS[round];

  const create = () => {
    if (!fabric || !color || !style) return;
    const res = scoreDesign(occasion, fabric, color, style);
    setResult(res);
    const ns = score + res.pts;
    setScore(Math.max(0, ns));
    if (res.level === "perfect" || res.level === "good") { fashionSewing(); setTimeout(fashionApproval, 300); }
    else fashionWrong();
  };

  const nextRound = () => {
    const next = round + 1;
    if (next >= OCCASIONS.length) {
      const isNew = updateHighScore(score);
      setNewRecord(isNew);
      setDone(true);
      void settleGameResult(score > 0 ? "win" : "loss", "Fashion Designer");
    } else {
      setRound(next);
      setFabric(null); setColor(null); setStyle(null);
      setResult(null);
    }
  };

  const restart = () => {
    setRound(0); setFabric(null); setColor(null); setStyle(null);
    setScore(0); setResult(null); setDone(false); setNewRecord(false);
  };

  if (done) {
    return (
      <Card><CardContent className="pt-6 text-center space-y-4">
        <p className="text-5xl">👗</p>
        {newRecord && <p className="text-primary font-bold animate-bounce">{t("games.newRecord")}</p>}
        <p className="text-2xl font-bold">⭐ {score}</p>
        <p className="text-muted-foreground">{t("games.highScore")}: {highScore}</p>
        <Button size="lg" onClick={restart}>{t("fashion.restart")}</Button>
      </CardContent></Card>
    );
  }

  const resultMsg = result
    ? result.level === "perfect"
        ? t("fashion.perfect").replace("{pts}", "200")
        : result.level === "good"
        ? t("fashion.good").replace("{pts}", "100")
        : t("fashion.poor").replace("{pts}", "50")
    : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-2 rounded-lg border p-3">
        <Badge>⭐ {score}</Badge>
        <Badge variant="secondary">{t("fashion.roundOf").replace("{n}", String(round + 1)).replace("{total}", String(OCCASIONS.length))}</Badge>
      </div>

      {/* Occasion card */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="py-4 text-center">
          <p className="text-sm text-muted-foreground">{t("fashion.target")}</p>
          <p className="text-2xl font-bold mt-1">{t(`fashion.occasion.${occasion.key}`)}</p>
        </CardContent>
      </Card>

      {/* Result feedback */}
      {result && resultMsg && (
        <div className={`rounded-xl p-3 text-center font-bold animate-in zoom-in-95 duration-200 ${
          result.level === "perfect" ? "bg-green-500/10 text-green-600 border border-green-400/40"
          : result.level === "good"  ? "bg-blue-500/10 text-blue-600 border border-blue-400/40"
          : "bg-red-500/10 text-destructive border border-red-400/40"
        }`}>
          {resultMsg}
        </div>
      )}

      {!result ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card><CardContent className="pt-4">
              <p className="font-bold mb-2 text-center text-sm">{t("fashion.fabric")}</p>
              <div className="flex flex-col gap-1">
                {FABRIC_KEYS.map(f => (
                  <Button key={f} size="sm" variant={fabric === f ? "default" : "outline"}
                    onClick={() => { setFabric(f); fashionSwish(); }}>
                    {t(`fashion.fabric.${f}`)}
                  </Button>
                ))}
              </div>
            </CardContent></Card>
            <Card><CardContent className="pt-4">
              <p className="font-bold mb-2 text-center text-sm">{t("fashion.color")}</p>
              <div className="flex flex-col gap-1">
                {COLOR_KEYS.map(c => (
                  <Button key={c} size="sm" variant={color === c ? "default" : "outline"}
                    onClick={() => { setColor(c); fashionSwish(); }}>
                    {t(`fashion.color.${c}`)}
                  </Button>
                ))}
              </div>
            </CardContent></Card>
            <Card><CardContent className="pt-4">
              <p className="font-bold mb-2 text-center text-sm">{t("fashion.style")}</p>
              <div className="flex flex-col gap-1">
                {STYLE_KEYS.map(s => (
                  <Button key={s} size="sm" variant={style === s ? "default" : "outline"}
                    onClick={() => { setStyle(s); fashionSwish(); }}>
                    {t(`fashion.style.${s}`)}
                  </Button>
                ))}
              </div>
            </CardContent></Card>
          </div>
          <Button className="w-full" size="lg" onClick={create}
            disabled={!fabric || !color || !style}>
            {t("fashion.create")}
          </Button>
        </>
      ) : (
        <Button className="w-full" size="lg" onClick={nextRound}>
          {round + 1 >= OCCASIONS.length ? "🏆 " + t("fashion.showScore") : t("fashion.nextOccasion")}
        </Button>
      )}
    </div>
  );
}

// ─── Free mode ──────────────────────────────────────────────────────────────────
function FashionFree() {
  const { t } = useLanguage();
  const { fashionSwish, fashionSewing, fashionApproval } = useGameSounds();
  const [fabric, setFabric] = useState<string | null>(null);
  const [color,  setColor]  = useState<string | null>(null);
  const [style,  setStyle]  = useState<string | null>(null);
  const [designs, setDesigns] = useState<string[]>([]);

  const create = () => {
    if (!fabric || !color || !style) return;
    const design = t("fashion.designLabel")
      .replace("{style}",  t(`fashion.style.${style}`))
      .replace("{color}",  t(`fashion.color.${color}`))
      .replace("{fabric}", t(`fashion.fabric.${fabric}`));
    setDesigns([design, ...designs]);
    setFabric(null); setColor(null); setStyle(null);
    fashionSewing(); setTimeout(fashionApproval, 400);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="pt-4">
          <p className="font-bold mb-2 text-center text-sm">{t("fashion.fabric")}</p>
          <div className="flex flex-col gap-1">
            {FABRIC_KEYS.map(f => (
              <Button key={f} size="sm" variant={fabric === f ? "default" : "outline"}
                onClick={() => { setFabric(f); fashionSwish(); }}>
                {t(`fashion.fabric.${f}`)}
              </Button>
            ))}
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="font-bold mb-2 text-center text-sm">{t("fashion.color")}</p>
          <div className="flex flex-col gap-1">
            {COLOR_KEYS.map(c => (
              <Button key={c} size="sm" variant={color === c ? "default" : "outline"}
                onClick={() => { setColor(c); fashionSwish(); }}>
                {t(`fashion.color.${c}`)}
              </Button>
            ))}
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="font-bold mb-2 text-center text-sm">{t("fashion.style")}</p>
          <div className="flex flex-col gap-1">
            {STYLE_KEYS.map(s => (
              <Button key={s} size="sm" variant={style === s ? "default" : "outline"}
                onClick={() => { setStyle(s); fashionSwish(); }}>
                {t(`fashion.style.${s}`)}
              </Button>
            ))}
          </div>
        </CardContent></Card>
      </div>
      <Button className="w-full" size="lg" onClick={create} disabled={!fabric || !color || !style}>
        {t("fashion.create")}
      </Button>
      {designs.length > 0 && (
        <Card><CardContent className="pt-4">
          <p className="font-bold mb-3 text-sm">{t("fashion.collection")}: ({designs.length})</p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {designs.map((d, i) => (
              <Badge key={i} variant="secondary" className="block py-2 text-sm">{d}</Badge>
            ))}
          </div>
        </CardContent></Card>
      )}
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────────
export default function FashionDesigner() {
  const { t } = useLanguage();
  const { highScore } = useHighScore("fashion");
  const [mode, setMode] = useState<"challenge" | "free">("challenge");

  return (
    <Layout>
      <section className="mx-auto max-w-3xl px-4 py-10">
        <div className="relative mb-6 overflow-hidden rounded-2xl">
          <img src={heroImg} alt="" role="presentation" className="h-40 w-full object-cover sm:h-48" width={800} height={512} loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute bottom-4 start-4 end-4 text-center">
            <h1 className="text-3xl font-bold">👗 {t("fashion.title")}</h1>
          </div>
        </div>
        <GameHeader
          title={t("fashion.title")}
          highScore={highScore}
          extra={
            <HowToPlay
              titleKey="fashion.title"
              steps={["fashion.howTo.1","fashion.howTo.2","fashion.howTo.3","fashion.howTo.4"]}
            />
          }
        />
        <div className="flex rounded-lg overflow-hidden border mb-6">
          <button onClick={() => setMode("challenge")} className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "challenge" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
            🏆 {t("fashion.challengeMode")}
          </button>
          <button onClick={() => setMode("free")} className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "free" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
            🎨 {t("fashion.freeMode")}
          </button>
        </div>
        {mode === "challenge" ? <FashionChallenge /> : <FashionFree />}
      </section>
    </Layout>
  );
}
