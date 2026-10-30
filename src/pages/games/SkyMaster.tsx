import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { GameHeader } from "@/components/game/GameHeader";
import { GameInstructions } from "@/components/game/GameInstructions";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { useGameEconomy } from "@/components/game/GameEconomyGate";
import { playProductionSound } from "@/features/arcade/audio/playProductionSound";
import { Fuel, Plane, PlaneTakeoff, RotateCcw, Star } from "lucide-react";
import {
  Action, CRUISE_ALTITUDE, Missing, Notice, State,
  applyAction, createGame, crossedMilestone, isMoving, score, stars,
} from "@/lib/games/skyMasterEngine";

const TICK_MS = 250;

export default function SkyMaster() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { playSound } = useSound();
  const { settleGameResult } = useGameEconomy();

  const [game, setGame] = useState<State>(() => createGame());
  const [status, setStatus] = useState("");
  const settled = useRef(false);

  const text = useMemo(() => (ar ? {
    title: "قائد السماء",
    subtitle: "أنجز قائمة ما قبل الإقلاع بالترتيب الصحيح، اصعد إلى ارتفاع الرحلة، قدّم الخدمة للركاب ثم اهبط بسلام. لا يوجد خاسر: الترتيب الخاطئ يكلفك وقوداً فقط.",
    altitude: "الارتفاع",
    feet: "قدم",
    fuel: "الوقود",
    mistakes: "الأخطاء",
    phase: {
      preflight: "فحص ما قبل الإقلاع", climb: "صعود", cruise: "ارتفاع الرحلة", descent: "هبوط", landed: "تم الهبوط",
    } as Record<State["phase"], string>,
    systems: "الأنظمة",
    cabin: "خدمة المقصورة",
    power: "الطاقة الرئيسية",
    engine: "تشغيل المحرك",
    flaps: "الجنيحات ١٥°",
    rotate: "إقلاع",
    meal: "تقديم الوجبات",
    drink: "عربة المشروبات",
    announce: "إعلان للركاب وبدء الهبوط",
    on: "مفعّل",
    off: "متوقف",
    done: "تم",
    restart: "رحلة جديدة",
    stars: "نجوم",
    score: "النتيجة",
    landedTitle: "هبطت بسلام في المطار الدولي!",
    howTo: "كيف تلعب",
    steps: [
      "شغّل الطاقة الرئيسية أولاً، ثم المحرك، ثم افتح الجنيحات. المحرك لا يعمل بلا طاقة.",
      "اضغط «إقلاع» عندما تكتمل القائمة. إذا نقص شيء فستسمع ما هو.",
      "يصعد الطيار تلقائياً إلى ١٠٬٠٠٠ قدم، ويُعلن الارتفاع كل ٢٬٥٠٠ قدم.",
      "عند ارتفاع الرحلة قدّم الوجبات والمشروبات، ثم اضغط الإعلان لبدء الهبوط.",
      "كل خطأ يكلف وقوداً. الوقود الأكثر المتبقي ونقص الأخطاء يعنيان نجوماً أكثر.",
    ],
  } : {
    title: "Sky Master",
    subtitle: "Run the pre-flight checklist in the right order, climb to cruise, look after the passengers, then land. Nobody loses: a wrong order only costs fuel.",
    altitude: "Altitude",
    feet: "ft",
    fuel: "Fuel",
    mistakes: "Mistakes",
    phase: {
      preflight: "Pre-flight check", climb: "Climbing", cruise: "Cruise altitude", descent: "Descending", landed: "Landed",
    } as Record<State["phase"], string>,
    systems: "Systems",
    cabin: "Cabin service",
    power: "Master power",
    engine: "Engine start",
    flaps: "Flaps 15°",
    rotate: "Rotate and take off",
    meal: "Serve meals",
    drink: "Drinks cart",
    announce: "Announce to passengers and begin descent",
    on: "on",
    off: "off",
    done: "done",
    restart: "New flight",
    stars: "stars",
    score: "Score",
    landedTitle: "You landed safely at the international hub!",
    howTo: "How to play",
    steps: [
      "Switch on master power first, then start the engine, then extend the flaps. The engine will not start without power.",
      "Press Rotate when the checklist is complete. If something is missing you will hear what.",
      "The aircraft climbs to 10,000 feet by itself and announces its altitude every 2,500 feet.",
      "At cruise serve the meals and drinks, then make the announcement to begin the descent.",
      "Every mistake costs fuel. More fuel left and fewer mistakes earn more stars.",
    ],
  }), [ar]);

  const say = useCallback((notice: Notice, missing: Missing[]): string => {
    const names: Record<Missing, string> = {
      power: ar ? "الطاقة" : "power",
      engine: ar ? "المحرك" : "engine",
      flaps: ar ? "الجنيحات" : "flaps",
    };
    const list = missing.map((m) => names[m]).join(ar ? "، " : ", ");
    const lines: Record<Exclude<Notice, null>, string> = ar ? {
      powerOn: "الطاقة تعمل.",
      powerOff: "الطاقة متوقفة.",
      powerLocked: "لا يمكن إيقاف الطاقة والمحرك يعمل.",
      needPower: "شغّل الطاقة الرئيسية أولاً.",
      engineOn: "تم تشغيل المحرك.",
      engineRunning: "المحرك يعمل بالفعل.",
      flapsOut: "الجنيحات مفتوحة.",
      flapsIn: "الجنيحات مغلقة.",
      notReady: `لا يمكن الإقلاع بعد. ينقص: ${list}.`,
      takeoff: "بدء الإقلاع!",
      cruise: "وصلنا إلى ارتفاع الرحلة. يمكنك خدمة الركاب.",
      cruiseFlapsDrag: "وصلنا إلى ارتفاع الرحلة، لكن الجنيحات كانت مفتوحة وكلفتنا وقوداً.",
      waitCruise: "انتظر حتى ارتفاع الرحلة.",
      served: "جارٍ خدمة الركاب.",
      alreadyServed: "تمت هذه الخدمة بالفعل.",
      serveFirst: "قدّم الوجبات والمشروبات أولاً.",
      descent: "بدء الهبوط التدريجي.",
      landed: "تم الهبوط بسلام.",
    } : {
      powerOn: "Power online.",
      powerOff: "Power off.",
      powerLocked: "Power cannot be switched off while the engine is running.",
      needPower: "Switch on master power first.",
      engineOn: "Engine started.",
      engineRunning: "The engine is already running.",
      flapsOut: "Flaps extended.",
      flapsIn: "Flaps retracted.",
      notReady: `Not ready for take-off. Missing: ${list}.`,
      takeoff: "Taking off!",
      cruise: "Cruise altitude reached. You can serve the passengers.",
      cruiseFlapsDrag: "Cruise altitude reached, but the flaps were still out and cost fuel.",
      waitCruise: "Wait for cruise altitude.",
      served: "Serving passengers.",
      alreadyServed: "That service is already done.",
      serveFirst: "Serve the meals and drinks first.",
      descent: "Descent initiated.",
      landed: "Landed safely.",
    };
    return notice ? lines[notice] : "";
  }, [ar]);

  // The latest state lives in a ref so an action is computed once, outside React's updater,
  // and its sounds and announcement fire exactly once even under StrictMode double-invocation.
  const gameRef = useRef(game);
  const latest = useRef({ say, text, ar, playSound });
  latest.current = { say, text, ar, playSound };

  const act = useCallback((action: Action) => {
    const current = gameRef.current;
    const { state, notice, missing } = applyAction(current, action);
    if (state === current && !notice) return;
    gameRef.current = state;
    setGame(state);

    const { say: describe, text: words, ar: arabic, playSound: play } = latest.current;
    if (action.kind === "tick") {
      const milestone = crossedMilestone(current.altitude, state.altitude);
      if (notice) setStatus(describe(notice, missing));
      else if (milestone !== null && milestone > 0) {
        setStatus(`${words.altitude} ${milestone.toLocaleString(arabic ? "ar" : "en")} ${words.feet}.`);
      }
      if (notice === "landed") void playProductionSound("natural-victory", { volume: 0.58 });
      return;
    }
    if (!notice) return;
    setStatus(describe(notice, missing));
    if (state.mistakes > current.mistakes) {
      play("error");
      void playProductionSound("natural-failure", { volume: 0.4 });
    } else if (notice === "takeoff") {
      play("start");
      void playProductionSound("puzzle-success", { playbackRate: 1.1, volume: 0.7 });
    } else {
      play("click");
      void playProductionSound("puzzle-place", { volume: 0.55 });
    }
  }, []);

  // Time only moves the aircraft through climb and descent; everything else is a button press.
  const moving = isMoving(game);
  useEffect(() => {
    if (!moving) return;
    const timer = window.setInterval(() => act({ kind: "tick" }), TICK_MS);
    return () => window.clearInterval(timer);
  }, [moving, act]);

  useEffect(() => {
    if (game.phase !== "landed" || settled.current) return;
    settled.current = true;
    void settleGameResult("win", "Sky Master");
  }, [game.phase, settleGameResult]);

  const restart = () => {
    const fresh = createGame();
    gameRef.current = fresh;
    setGame(fresh);
    setStatus("");
    settled.current = false;
    playSound("start");
  };

  const earned = stars(game);
  const toggle = (active: boolean) => `${active ? text.on : text.off}`;
  const preflight = game.phase === "preflight";
  const cabinClosed = game.phase === "landed";

  return (
    <Layout>
      <section className="section-container max-w-3xl py-8">
        <GameHeader
          title={text.title}
          extra={
            <Badge variant="secondary" className="gap-1">
              <Fuel className="h-3 w-3" aria-hidden="true" />
              {text.fuel} {Math.round(game.fuel)}%
            </Badge>
          }
        />

        <p className="mb-4 text-sm text-muted-foreground">{text.subtitle}</p>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge variant="outline">{text.phase[game.phase]}</Badge>
          <Badge variant="outline">{text.mistakes} {game.mistakes}</Badge>
          <Button size="sm" variant="ghost" onClick={restart} className="gap-1.5">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />{text.restart}
          </Button>
        </div>

        <p role="status" aria-live="polite" className="mb-3 min-h-5 text-sm font-medium text-primary">
          {status}
        </p>

        <Card>
          <CardContent className="grid gap-4 p-4 sm:grid-cols-3 sm:p-6">
            <div className="flex flex-col gap-2" role="group" aria-label={text.systems}>
              <h2 className="text-sm font-semibold">{text.systems}</h2>
              <Button
                variant={game.power ? "default" : "outline"}
                aria-pressed={game.power}
                disabled={!preflight}
                onClick={() => act({ kind: "power" })}
              >
                {text.power} — {toggle(game.power)}
              </Button>
              <Button
                variant={game.engine ? "default" : "outline"}
                aria-pressed={game.engine}
                disabled={!preflight}
                onClick={() => act({ kind: "engine" })}
              >
                {text.engine} — {toggle(game.engine)}
              </Button>
              <Button
                variant={game.flaps ? "default" : "outline"}
                aria-pressed={game.flaps}
                disabled={game.phase === "descent" || game.phase === "landed"}
                onClick={() => act({ kind: "flaps" })}
              >
                {text.flaps} — {toggle(game.flaps)}
              </Button>
            </div>

            <div className="flex flex-col items-center justify-center gap-3 rounded-lg bg-muted/40 p-4 text-center">
              <Plane className="h-8 w-8 text-primary" aria-hidden="true" />
              <div className="text-xs text-muted-foreground">{text.altitude}</div>
              <div className="text-4xl font-black tabular-nums" dir="ltr">
                {game.altitude.toString().padStart(5, "0")}
                <span className="sr-only"> {text.feet}</span>
              </div>
              <div
                role="progressbar"
                aria-label={text.altitude}
                aria-valuemin={0}
                aria-valuemax={CRUISE_ALTITUDE}
                aria-valuenow={game.altitude}
                aria-valuetext={`${game.altitude} ${text.feet}`}
                className="h-2 w-full overflow-hidden rounded-full bg-muted"
              >
                <div className="h-full bg-primary transition-[width] duration-200" style={{ width: `${(game.altitude / CRUISE_ALTITUDE) * 100}%` }} />
              </div>
              {preflight && (
                <Button className="w-full gap-1.5" onClick={() => act({ kind: "rotate" })}>
                  <PlaneTakeoff className="h-4 w-4" aria-hidden="true" />{text.rotate}
                </Button>
              )}
            </div>

            <div className="flex flex-col gap-2" role="group" aria-label={text.cabin}>
              <h2 className="text-sm font-semibold">{text.cabin}</h2>
              <Button disabled={cabinClosed} variant={game.served.meal ? "default" : "outline"} onClick={() => act({ kind: "serve", item: "meal" })}>
                {text.meal}{game.served.meal ? ` — ${text.done}` : ""}
              </Button>
              <Button disabled={cabinClosed} variant={game.served.drink ? "default" : "outline"} onClick={() => act({ kind: "serve", item: "drink" })}>
                {text.drink}{game.served.drink ? ` — ${text.done}` : ""}
              </Button>
              <Button disabled={cabinClosed} variant="outline" onClick={() => act({ kind: "announce" })}>
                {text.announce}
              </Button>
            </div>
          </CardContent>
        </Card>

        {game.phase === "landed" && (
          <Card className="mt-4">
            <CardContent className="flex flex-col items-center gap-2 p-6 text-center">
              <h2 className="text-lg font-bold">{text.landedTitle}</h2>
              <p className="flex items-center gap-1 text-sm">
                {Array.from({ length: 3 }, (_, i) => (
                  <Star key={i} className={`h-5 w-5 ${i < earned ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} aria-hidden="true" />
                ))}
                <span>{earned} {text.stars}</span>
              </p>
              <p className="text-sm text-muted-foreground">{text.score}: {score(game)}</p>
              <Button onClick={restart} className="mt-2 gap-1.5">
                <RotateCcw className="h-4 w-4" aria-hidden="true" />{text.restart}
              </Button>
            </CardContent>
          </Card>
        )}

        <GameInstructions title={text.howTo} steps={text.steps} />
      </section>
    </Layout>
  );
}
