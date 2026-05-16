import { useCallback, useRef } from "react";
import { useSound } from "@/contexts/SoundContext";

// ─── Low-level Web Audio helpers (mirrors SoundContext internals) ─────────────
let _ctx: AudioContext | null = null;
function getCtx(): AudioContext {
  if (!_ctx) _ctx = new AudioContext();
  if (_ctx.state === "suspended") _ctx.resume();
  return _ctx;
}
function tone(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.12) {
  try {
    const ctx = getCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, ctx.currentTime);
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + dur);
  } catch {}
}
function chord(freqs: number[], dur: number, type: OscillatorType = "sine", vol = 0.08) {
  freqs.forEach((f, i) => setTimeout(() => tone(f, dur, type, vol), i * 40));
}
function noise(dur: number, vol = 0.06) {
  try {
    const ctx = getCtx();
    const sr = ctx.sampleRate;
    const buf = ctx.createBuffer(1, Math.ceil(sr * dur), sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(g).connect(ctx.destination);
    src.start(); src.stop(ctx.currentTime + dur);
  } catch {}
}
function filteredNoise(dur: number, cutoff: number, vol = 0.08) {
  try {
    const ctx = getCtx();
    const sr = ctx.sampleRate;
    const buf = ctx.createBuffer(1, Math.ceil(sr * dur), sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(filter).connect(g).connect(ctx.destination);
    src.start(); src.stop(ctx.currentTime + dur);
  } catch {}
}
function sweep(startFreq: number, endFreq: number, dur: number, type: OscillatorType = "sawtooth", vol = 0.08) {
  try {
    const ctx = getCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(startFreq, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + dur);
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + dur);
  } catch {}
}

// ─── Game sound definitions ───────────────────────────────────────────────────

/** Domino heavy tile clack when placed on board */
export function dominoThud() {
  filteredNoise(0.08, 600, 0.18);
  tone(120, 0.12, "sine", 0.15);
}
/** Domino invalid move buzz */
export function dominoInvalid() {
  tone(200, 0.15, "square", 0.07);
  setTimeout(() => tone(160, 0.2, "square", 0.07), 120);
}
/** Domino tile slide / deal */
export function dominoSlide() {
  filteredNoise(0.05, 1200, 0.06);
  setTimeout(() => filteredNoise(0.04, 1000, 0.05), 60);
}

/** Card flip — short snappy crack */
export function cardFlip() {
  filteredNoise(0.04, 2000, 0.12);
  tone(900, 0.03, "square", 0.04);
}
/** Card shuffle — rapid sequence of flips */
export function cardShuffle() {
  for (let i = 0; i < 6; i++) {
    setTimeout(() => { filteredNoise(0.03, 1800 + i * 100, 0.08); }, i * 60);
  }
}
/** Card deal — flick sound */
export function cardDeal() {
  filteredNoise(0.06, 1500, 0.1);
  setTimeout(() => tone(700, 0.04, "sine", 0.04), 50);
}
/** Card win trick */
export function cardWin() {
  chord([523, 659, 784], 0.3, "sine", 0.1);
}
/** Card lose trick */
export function cardLose() {
  tone(300, 0.2, "sine", 0.08);
  setTimeout(() => tone(250, 0.25, "square", 0.06), 150);
}

/** Dice roll — rattling clatter */
export function diceRoll() {
  for (let i = 0; i < 8; i++) {
    setTimeout(() => {
      filteredNoise(0.04, 800 + Math.random() * 400, 0.07);
      tone(120 + Math.random() * 80, 0.04, "sine", 0.06);
    }, i * 60);
  }
}
/** Dice settle on table */
export function diceSettle() {
  filteredNoise(0.07, 500, 0.1);
  tone(100, 0.1, "sine", 0.08);
}
/** Dice score — coins */
export function diceScore() {
  chord([659, 784, 1047], 0.3, "sine", 0.09);
}
/** Farkle (bust) — losing roll */
export function farkleBust() {
  tone(250, 0.2, "sawtooth", 0.08);
  setTimeout(() => tone(200, 0.25, "square", 0.08), 150);
}

/** Hangman letter correct pop */
export function hangmanCorrect() {
  tone(880, 0.12, "sine", 0.1);
  setTimeout(() => tone(1100, 0.1, "sine", 0.08), 80);
}
/** Hangman letter wrong — buzzer */
export function hangmanWrong() {
  tone(220, 0.25, "sawtooth", 0.09);
  setTimeout(() => tone(180, 0.3, "square", 0.07), 120);
}
/** Hangman win */
export function hangmanWin() {
  chord([523, 659, 784, 1047], 0.5, "sine", 0.1);
}
/** Hangman lose — game over */
export function hangmanGameOver() {
  tone(300, 0.15, "square", 0.09);
  setTimeout(() => tone(250, 0.15, "square", 0.09), 120);
  setTimeout(() => tone(200, 0.3, "sawtooth", 0.1), 250);
}

/** LogiQuest correct chime */
export function logiCorrect() {
  tone(880, 0.1, "sine", 0.1);
  setTimeout(() => tone(1100, 0.12, "sine", 0.1), 80);
}
/** LogiQuest wrong buzz */
export function logiWrong() {
  tone(200, 0.15, "square", 0.08);
}
/** LogiQuest timer tick */
export function logiTick() {
  tone(1200, 0.03, "square", 0.04);
}
/** LogiQuest time running out warning */
export function logiTimerWarn() {
  tone(800, 0.05, "square", 0.06);
  setTimeout(() => tone(900, 0.05, "square", 0.06), 120);
}

/** Jungle leaf/ambience swish */
export function jungleSwish() {
  filteredNoise(0.15, 600, 0.07);
  setTimeout(() => filteredNoise(0.1, 400, 0.04), 80);
}
/** Jungle danger warning — low pulse */
export function jungleDanger() {
  tone(100, 0.2, "sawtooth", 0.1);
  setTimeout(() => tone(90, 0.25, "sawtooth", 0.08), 200);
}
/** Jungle correct path */
export function jungleSuccess() {
  tone(660, 0.1, "sine", 0.08);
  setTimeout(() => tone(880, 0.15, "sine", 0.09), 90);
  setTimeout(() => tone(1100, 0.2, "sine", 0.08), 180);
}
/** Jungle fail / trap */
export function jungleFail() {
  tone(300, 0.12, "sawtooth", 0.09);
  setTimeout(() => tone(220, 0.2, "square", 0.08), 100);
}

/** Neon Breach electronic beep sequence */
export function neonBeep() {
  tone(1400, 0.04, "square", 0.07);
  setTimeout(() => tone(1600, 0.04, "square", 0.06), 70);
}
/** Neon Breach wrong sequence — glitch */
export function neonGlitch() {
  for (let i = 0; i < 4; i++) {
    setTimeout(() => noise(0.04, 0.06), i * 40);
  }
  tone(150, 0.2, "square", 0.05);
}
/** Neon Breach success hack */
export function neonHack() {
  const freqs = [800, 1000, 1200, 1600, 2000];
  freqs.forEach((f, i) => setTimeout(() => tone(f, 0.06, "square", 0.07), i * 50));
}
/** Neon Breach access granted */
export function neonGranted() {
  chord([523, 659, 784], 0.3, "sine", 0.09);
  setTimeout(() => chord([784, 1047], 0.4, "sine", 0.1), 200);
}

/** Tactical Strike target hit ping */
export function tacticalHit() {
  tone(1200, 0.08, "sine", 0.1);
  setTimeout(() => tone(900, 0.1, "sine", 0.07), 70);
}
/** Tactical Strike miss — whoosh */
export function tacticalMiss() {
  sweep(600, 200, 0.15, "sine", 0.07);
}
/** Tactical Strike explosion rumble */
export function tacticalExplosion() {
  filteredNoise(0.3, 400, 0.15);
  tone(80, 0.25, "sawtooth", 0.12);
  setTimeout(() => filteredNoise(0.2, 300, 0.08), 100);
}
/** Tactical Strike victory */
export function tacticalVictory() {
  chord([523, 659, 784, 1047], 0.5, "sine", 0.1);
}

/** StarChef sizzle on pan */
export function chefSizzle() {
  filteredNoise(0.4, 3000, 0.1);
  setTimeout(() => filteredNoise(0.3, 2500, 0.06), 150);
}
/** StarChef plate ding */
export function chefPlate() {
  tone(1400, 0.3, "sine", 0.09);
  setTimeout(() => tone(700, 0.2, "sine", 0.05), 100);
}
/** StarChef timer ding */
export function chefTimer() {
  tone(1047, 0.2, "sine", 0.1);
  setTimeout(() => tone(1047, 0.2, "sine", 0.1), 250);
  setTimeout(() => tone(1047, 0.3, "sine", 0.12), 500);
}
/** StarChef correct recipe */
export function chefSuccess() {
  chord([523, 659, 784], 0.35, "sine", 0.09);
}
/** StarChef wrong ingredient */
export function chefWrong() {
  tone(250, 0.2, "square", 0.07);
}

/** VelocityX engine rev — rising pitch */
export function racingRev() {
  sweep(200, 600, 0.3, "sawtooth", 0.1);
  setTimeout(() => sweep(600, 1200, 0.2, "sawtooth", 0.08), 280);
}
/** VelocityX tire screech */
export function racingScreech() {
  filteredNoise(0.25, 2000, 0.12);
  sweep(1200, 400, 0.2, "sawtooth", 0.06);
}
/** VelocityX checkpoint beep */
export function racingCheckpoint() {
  tone(880, 0.08, "sine", 0.09);
  setTimeout(() => tone(1100, 0.1, "sine", 0.09), 70);
}
/** VelocityX finish line fanfare */
export function racingFinish() {
  const melody = [523, 659, 784, 1047, 784, 1047, 1319];
  melody.forEach((f, i) => setTimeout(() => tone(f, 0.18, "sine", 0.1), i * 120));
}
/** VelocityX wrong direction / crash */
export function racingCrash() {
  filteredNoise(0.3, 800, 0.14);
  tone(150, 0.25, "sawtooth", 0.1);
}

/** MusicEarMaster play a musical note (MIDI note number) */
export function musicNote(midi: number) {
  const freq = 440 * Math.pow(2, (midi - 69) / 12);
  tone(freq, 0.6, "sine", 0.12);
  setTimeout(() => tone(freq * 2, 0.4, "sine", 0.04), 0);
}
/** MusicEarMaster correct answer */
export function musicCorrect() {
  chord([523, 659, 784], 0.3, "sine", 0.1);
}
/** MusicEarMaster wrong answer */
export function musicWrong() {
  tone(220, 0.2, "square", 0.08);
}

/** LaptopTech keyboard click */
export function techClick() {
  filteredNoise(0.03, 3000, 0.09);
  tone(1000, 0.02, "square", 0.05);
}
/** LaptopTech repair complete beep */
export function techRepair() {
  tone(880, 0.1, "sine", 0.08);
  setTimeout(() => tone(1100, 0.12, "sine", 0.09), 90);
  setTimeout(() => tone(1320, 0.15, "sine", 0.08), 180);
}
/** LaptopTech boot chime */
export function techBoot() {
  chord([523, 659, 784, 1047], 0.6, "sine", 0.1);
}
/** LaptopTech error */
export function techError() {
  tone(300, 0.1, "square", 0.08);
  setTimeout(() => tone(250, 0.15, "square", 0.07), 100);
}

/** TradeTycoon coin clink (metallic high ping) */
export function tradeCoin() {
  tone(1800, 0.15, "sine", 0.08);
  setTimeout(() => tone(1600, 0.12, "sine", 0.05), 60);
}
/** TradeTycoon cash register ding */
export function tradeCashRegister() {
  tone(1047, 0.1, "sine", 0.1);
  setTimeout(() => tone(1320, 0.15, "sine", 0.09), 80);
  setTimeout(() => tone(1047, 0.2, "sine", 0.07), 180);
}
/** TradeTycoon market rise */
export function tradeMarketRise() {
  sweep(400, 900, 0.2, "sine", 0.08);
}
/** TradeTycoon market fall */
export function tradeMarketFall() {
  sweep(700, 300, 0.2, "sine", 0.08);
}
/** TradeTycoon bankruptcy / loss */
export function tradeLoss() {
  tone(400, 0.1, "sawtooth", 0.07);
  setTimeout(() => tone(300, 0.15, "sawtooth", 0.08), 100);
  setTimeout(() => tone(200, 0.3, "square", 0.08), 220);
}

/** DreamHome construction knock */
export function homeKnock() {
  filteredNoise(0.06, 400, 0.12);
  tone(180, 0.08, "sine", 0.1);
  setTimeout(() => { filteredNoise(0.05, 350, 0.09); tone(160, 0.06, "sine", 0.08); }, 120);
}
/** DreamHome approval chime */
export function homeApproval() {
  chord([523, 659, 784], 0.35, "sine", 0.1);
}
/** DreamHome wrong placement */
export function homeWrong() {
  tone(280, 0.15, "square", 0.07);
}
/** DreamHome room complete */
export function homeComplete() {
  const melody = [523, 659, 784, 1047];
  melody.forEach((f, i) => setTimeout(() => tone(f, 0.2, "sine", 0.1), i * 100));
}

/** FashionDesigner fabric swish */
export function fashionSwish() {
  filteredNoise(0.1, 2500, 0.06);
  setTimeout(() => filteredNoise(0.08, 2000, 0.04), 60);
}
/** FashionDesigner sewing machine rapid clicks */
export function fashionSewing() {
  for (let i = 0; i < 6; i++) {
    setTimeout(() => { filteredNoise(0.02, 2000, 0.05); tone(800, 0.02, "square", 0.03); }, i * 45);
  }
}
/** FashionDesigner outfit approval */
export function fashionApproval() {
  chord([659, 784, 1047], 0.35, "sine", 0.1);
}
/** FashionDesigner wrong combo */
export function fashionWrong() {
  tone(350, 0.15, "square", 0.06);
}

/** Akinator mystical harp reveal */
export function akinatorReveal() {
  const notes = [523, 659, 784, 1047, 1319, 1568];
  notes.forEach((f, i) => setTimeout(() => tone(f, 0.35, "sine", 0.08), i * 80));
}
/** Akinator thinking tone — mysterious */
export function akinatorThink() {
  tone(330, 0.12, "sine", 0.05);
  setTimeout(() => tone(370, 0.1, "sine", 0.04), 100);
  setTimeout(() => tone(350, 0.15, "sine", 0.05), 200);
}
/** Akinator correct guess */
export function akinatorCorrect() {
  chord([523, 659, 784, 1047], 0.5, "sine", 0.1);
}
/** Akinator wrong guess */
export function akinatorWrong() {
  tone(280, 0.2, "square", 0.07);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export type GameSoundFn = () => void;

export function useGameSounds() {
  const { enabled } = useSound();
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const wrap = useCallback((fn: GameSoundFn): GameSoundFn => {
    return () => { if (enabledRef.current) fn(); };
  }, []);

  return {
    // Dominoes
    dominoThud:    wrap(dominoThud),
    dominoInvalid: wrap(dominoInvalid),
    dominoSlide:   wrap(dominoSlide),
    // Cards (Briscola, Card99, UnoUltra)
    cardFlip:    wrap(cardFlip),
    cardShuffle: wrap(cardShuffle),
    cardDeal:    wrap(cardDeal),
    cardWin:     wrap(cardWin),
    cardLose:    wrap(cardLose),
    // Farkle
    diceRoll:   wrap(diceRoll),
    diceSettle: wrap(diceSettle),
    diceScore:  wrap(diceScore),
    farkleBust: wrap(farkleBust),
    // Hangman
    hangmanCorrect:  wrap(hangmanCorrect),
    hangmanWrong:    wrap(hangmanWrong),
    hangmanWin:      wrap(hangmanWin),
    hangmanGameOver: wrap(hangmanGameOver),
    // LogiQuest
    logiCorrect:   wrap(logiCorrect),
    logiWrong:     wrap(logiWrong),
    logiTick:      wrap(logiTick),
    logiTimerWarn: wrap(logiTimerWarn),
    // JungleSurvival
    jungleSwish:   wrap(jungleSwish),
    jungleDanger:  wrap(jungleDanger),
    jungleSuccess: wrap(jungleSuccess),
    jungleFail:    wrap(jungleFail),
    // NeonBreach
    neonBeep:    wrap(neonBeep),
    neonGlitch:  wrap(neonGlitch),
    neonHack:    wrap(neonHack),
    neonGranted: wrap(neonGranted),
    // TacticalStrike
    tacticalHit:       wrap(tacticalHit),
    tacticalMiss:      wrap(tacticalMiss),
    tacticalExplosion: wrap(tacticalExplosion),
    tacticalVictory:   wrap(tacticalVictory),
    // StarChef
    chefSizzle:  wrap(chefSizzle),
    chefPlate:   wrap(chefPlate),
    chefTimer:   wrap(chefTimer),
    chefSuccess: wrap(chefSuccess),
    chefWrong:   wrap(chefWrong),
    // VelocityXRacing
    racingRev:        wrap(racingRev),
    racingScreech:    wrap(racingScreech),
    racingCheckpoint: wrap(racingCheckpoint),
    racingFinish:     wrap(racingFinish),
    racingCrash:      wrap(racingCrash),
    // MusicEarMaster
    musicNote:    (midi: number) => { if (enabledRef.current) musicNote(midi); },
    musicCorrect: wrap(musicCorrect),
    musicWrong:   wrap(musicWrong),
    // LaptopTechMaster
    techClick:  wrap(techClick),
    techRepair: wrap(techRepair),
    techBoot:   wrap(techBoot),
    techError:  wrap(techError),
    // TradeTycoon
    tradeCoin:         wrap(tradeCoin),
    tradeCashRegister: wrap(tradeCashRegister),
    tradeMarketRise:   wrap(tradeMarketRise),
    tradeMarketFall:   wrap(tradeMarketFall),
    tradeLoss:         wrap(tradeLoss),
    // DreamHome
    homeKnock:    wrap(homeKnock),
    homeApproval: wrap(homeApproval),
    homeWrong:    wrap(homeWrong),
    homeComplete: wrap(homeComplete),
    // FashionDesigner
    fashionSwish:    wrap(fashionSwish),
    fashionSewing:   wrap(fashionSewing),
    fashionApproval: wrap(fashionApproval),
    fashionWrong:    wrap(fashionWrong),
    // Akinator
    akinatorReveal:  wrap(akinatorReveal),
    akinatorThink:   wrap(akinatorThink),
    akinatorCorrect: wrap(akinatorCorrect),
    akinatorWrong:   wrap(akinatorWrong),
  };
}
