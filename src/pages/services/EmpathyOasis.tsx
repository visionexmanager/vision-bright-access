import { useState, useRef, useEffect, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { AnimatedSection, scaleFade } from "@/components/AnimatedSection";
import {
  Heart, Volume2, VolumeX, Wind, Sparkles,
  Play, Pause, RotateCcw, ChevronRight,
} from "lucide-react";
import { Link } from "react-router-dom";

// 4-7-8 breathing technique
const PHASES = [
  { en: "Inhale",  ar: "استنشق", duration: 4, expand: true  },
  { en: "Hold",    ar: "أمسك",   duration: 7, expand: true  },
  { en: "Exhale",  ar: "أخرج",  duration: 8, expand: false },
];

const AFFIRMATIONS_EN = [
  "You are capable of amazing things.",
  "Every challenge makes you stronger.",
  "You deserve peace and happiness.",
  "Your presence matters to the world.",
  "Take one breath at a time — you've got this.",
  "You are seen, valued, and loved.",
  "Progress, not perfection.",
  "Your journey is uniquely yours.",
  "Rest is part of the process.",
  "You have overcome so much already.",
];

const AFFIRMATIONS_AR = [
  "أنت قادر على أشياء رائعة.",
  "كل تحدٍّ يجعلك أقوى.",
  "تستحق السلام والسعادة.",
  "وجودك مهم لهذا العالم.",
  "خطوة واحدة في كل مرة — أنت قادر.",
  "أنت مرئي ومُقدَّر ومحبوب.",
  "التقدم، لا الكمال.",
  "رحلتك فريدة من نوعها.",
  "الراحة جزء من العملية.",
  "لقد تجاوزت الكثير بالفعل.",
];

const TONES = {
  calm:    { freq: 432, emoji: "🌊", en: "Calm (432 Hz)",       ar: "هدوء ٤٣٢ هرتز"    },
  focus:   { freq: 528, emoji: "🎯", en: "Focus (528 Hz)",      ar: "تركيز ٥٢٨ هرتز"   },
  ground:  { freq: 174, emoji: "🌿", en: "Grounding (174 Hz)",  ar: "تأريض ١٧٤ هرتز"   },
} as const;
type ToneKey = keyof typeof TONES;

export default function EmpathyOasis() {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const isAr = lang === "ar";

  // ── Breathing ──────────────────────────────────────────────────
  const [breathActive, setBreathActive] = useState(false);
  const [phaseIdx, setPhaseIdx]         = useState(0);
  const [phaseSec, setPhaseSec]         = useState(0);
  const [cycles, setCycles]             = useState(0);
  const intervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseIdxRef   = useRef(0);
  const phaseSecRef   = useRef(0);
  const sessionSecRef = useRef(0);

  const stopBreathing = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setBreathActive(false);
    setPhaseIdx(0); setPhaseSec(0); setCycles(0);
    phaseIdxRef.current = 0; phaseSecRef.current = 0;
  }, []);

  const startBreathing = useCallback(() => {
    stopBreathing();
    sessionSecRef.current = 0;
    setBreathActive(true);
    setCycles(0);

    intervalRef.current = setInterval(() => {
      phaseSecRef.current += 1;
      sessionSecRef.current += 1;
      setPhaseSec(phaseSecRef.current);

      if (phaseSecRef.current >= PHASES[phaseIdxRef.current].duration) {
        phaseSecRef.current = 0;
        setPhaseSec(0);
        phaseIdxRef.current = (phaseIdxRef.current + 1) % PHASES.length;
        setPhaseIdx(phaseIdxRef.current);
        if (phaseIdxRef.current === 0) setCycles(c => c + 1);
      }
    }, 1000);
  }, [stopBreathing]);

  const handleStopBreathing = useCallback(() => {
    if (user && sessionSecRef.current > 0) {
      supabase.from("oasis_sessions").insert({
        user_id: user.id, session_type: "breathing",
        duration_seconds: sessionSecRef.current,
      });
    }
    stopBreathing();
  }, [user, stopBreathing]);

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  const currentPhase = PHASES[phaseIdx];
  const isExpanded   = breathActive && currentPhase.expand;

  // ── Ambient tones (Web Audio API) ──────────────────────────────
  const [activeTone, setActiveTone] = useState<ToneKey | null>(null);
  const audioCtxRef  = useRef<AudioContext | null>(null);
  const oscRef       = useRef<OscillatorNode | null>(null);
  const gainRef      = useRef<GainNode | null>(null);
  const toneSec      = useRef(0);
  const toneInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTone = useCallback(() => {
    if (toneInterval.current) clearInterval(toneInterval.current);
    if (gainRef.current && audioCtxRef.current) {
      gainRef.current.gain.linearRampToValueAtTime(0, audioCtxRef.current.currentTime + 0.8);
      setTimeout(() => { oscRef.current?.stop(); audioCtxRef.current?.close(); oscRef.current = null; audioCtxRef.current = null; }, 900);
    }
    if (user && toneSec.current > 0) {
      supabase.from("oasis_sessions").insert({
        user_id: user.id, session_type: "sound",
        duration_seconds: toneSec.current,
      });
    }
    setActiveTone(null);
  }, [user]);

  const playTone = useCallback((key: ToneKey) => {
    if (activeTone) stopTone();
    toneSec.current = 0;
    const ctx  = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = TONES[key].freq;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.07, ctx.currentTime + 2);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start();
    audioCtxRef.current = ctx; oscRef.current = osc; gainRef.current = gain;
    toneInterval.current = setInterval(() => { toneSec.current += 1; }, 1000);
    setActiveTone(key);
  }, [activeTone, stopTone]);

  useEffect(() => () => { oscRef.current?.stop(); audioCtxRef.current?.close(); }, []);

  // ── Affirmations (TTS) ─────────────────────────────────────────
  const affirmations = isAr ? AFFIRMATIONS_AR : AFFIRMATIONS_EN;
  const [affIdx, setAffIdx]   = useState(0);
  const [speaking, setSpeaking] = useState(false);

  const speak = useCallback((text: string) => {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang  = isAr ? "ar-SA" : "en-US";
    utter.rate  = 0.85;
    utter.onstart = () => setSpeaking(true);
    utter.onend   = () => {
      setSpeaking(false);
      if (user) {
        supabase.from("oasis_sessions").insert({
          user_id: user.id, session_type: "affirmation", duration_seconds: 5,
        });
      }
    };
    window.speechSynthesis.speak(utter);
  }, [isAr, user]);

  const nextAffirmation = useCallback(() => {
    const next = (affIdx + 1) % affirmations.length;
    setAffIdx(next);
    speak(affirmations[next]);
  }, [affIdx, affirmations, speak]);

  return (
    <Layout>
      <section className="mx-auto max-w-4xl px-4 py-10">

        {/* Hero */}
        <AnimatedSection variants={scaleFade}>
          <div className="relative mb-10 overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500/20 via-primary/10 to-teal-500/20 p-8 text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                <Heart className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h1 className="text-3xl font-bold sm:text-4xl">
              {isAr ? "واحة التعاطف الشاملة" : "Universal Empathy Oasis"}
            </h1>
            <p className="mt-2 max-w-xl mx-auto text-lg text-muted-foreground">
              {isAr
                ? "مساحة هادئة وآمنة لاستعادة توازنك — تنفس، استرخِ، واستمع."
                : "A calm, safe space to restore your balance — breathe, relax, and listen."}
            </p>
          </div>
        </AnimatedSection>

        {/* ── Breathing ── */}
        <AnimatedSection>
          <Card className="mb-6">
            <CardContent className="p-6 sm:p-8">
              <div className="mb-6 flex items-center gap-3">
                <Wind className="h-6 w-6 text-primary" />
                <h2 className="text-xl font-bold">
                  {isAr ? "تمرين التنفس ٤-٧-٨" : "4-7-8 Breathing Exercise"}
                </h2>
              </div>

              <div className="flex flex-col items-center gap-6">
                {/* Animated circle */}
                <div className="relative flex h-44 w-44 items-center justify-center">
                  <div
                    className="absolute inset-0 rounded-full bg-primary/15 transition-transform"
                    style={{
                      transform: isExpanded ? "scale(1.45)" : "scale(1)",
                      transitionDuration: breathActive ? `${currentPhase.duration * 1000}ms` : "600ms",
                      transitionTimingFunction: "ease-in-out",
                    }}
                  />
                  <div
                    className="absolute inset-4 rounded-full bg-primary/25 transition-transform"
                    style={{
                      transform: isExpanded ? "scale(1.3)" : "scale(1)",
                      transitionDuration: breathActive ? `${currentPhase.duration * 1000}ms` : "600ms",
                      transitionTimingFunction: "ease-in-out",
                    }}
                  />
                  <div className="relative z-10 text-center">
                    <p className="text-2xl font-bold text-primary">
                      {breathActive
                        ? (isAr ? currentPhase.ar : currentPhase.en)
                        : (isAr ? "ابدأ" : "Start")}
                    </p>
                    {breathActive && (
                      <p className="text-sm text-muted-foreground">
                        {currentPhase.duration - phaseSec}s
                      </p>
                    )}
                  </div>
                </div>

                {breathActive && (
                  <p className="text-sm text-muted-foreground">
                    {isAr ? `دورة ${cycles + 1}` : `Cycle ${cycles + 1}`}
                  </p>
                )}

                <div className="flex gap-3">
                  {!breathActive ? (
                    <Button size="lg" onClick={startBreathing}>
                      <Play className="me-2 h-4 w-4" />
                      {isAr ? "ابدأ التنفس" : "Start Breathing"}
                    </Button>
                  ) : (
                    <Button size="lg" variant="outline" onClick={handleStopBreathing}>
                      <Pause className="me-2 h-4 w-4" />
                      {isAr ? "إيقاف وحفظ" : "Stop & Save"}
                    </Button>
                  )}
                  <Button size="lg" variant="ghost" onClick={stopBreathing}>
                    <RotateCcw className="me-2 h-4 w-4" />
                    {isAr ? "إعادة" : "Reset"}
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground text-center max-w-sm">
                  {isAr
                    ? "استنشق ٤ ثوانٍ ← أمسك ٧ ثوانٍ ← أخرج ببطء ٨ ثوانٍ. تقنية علمية لتهدئة الجهاز العصبي."
                    : "Inhale 4s → Hold 7s → Exhale slowly 8s. A scientifically-backed technique to calm your nervous system."}
                </p>
              </div>
            </CardContent>
          </Card>
        </AnimatedSection>

        {/* ── Ambient tones ── */}
        <AnimatedSection>
          <Card className="mb-6">
            <CardContent className="p-6 sm:p-8">
              <div className="mb-6 flex items-center gap-3">
                <Volume2 className="h-6 w-6 text-primary" />
                <h2 className="text-xl font-bold">
                  {isAr ? "أصوات التهدئة" : "Calming Tones"}
                </h2>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 mb-5">
                {(Object.keys(TONES) as ToneKey[]).map((key) => {
                  const tone   = TONES[key];
                  const active = activeTone === key;
                  return (
                    <button
                      key={key}
                      onClick={() => active ? stopTone() : playTone(key)}
                      className={`rounded-xl border-2 p-4 text-center transition-all hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary ${
                        active ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                      }`}
                    >
                      <div className={`mb-1 text-3xl ${active ? "animate-pulse" : ""}`}>
                        {tone.emoji}
                      </div>
                      <p className="text-sm font-semibold">
                        {isAr ? tone.ar : tone.en}
                      </p>
                      {active && (
                        <Badge className="mt-1 text-xs">
                          {isAr ? "يعزف…" : "Playing…"}
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>

              {activeTone && (
                <div className="flex justify-center">
                  <Button variant="outline" onClick={stopTone}>
                    <VolumeX className="me-2 h-4 w-4" />
                    {isAr ? "إيقاف الصوت وحفظ الجلسة" : "Stop & Save Session"}
                  </Button>
                </div>
              )}

              <p className="mt-4 text-xs text-muted-foreground text-center">
                {isAr
                  ? "ترددات سينية نقية تساعد على الاسترخاء والتركيز. استخدم سماعات للحصول على أفضل تجربة."
                  : "Pure sine tones tuned for relaxation and focus. Use headphones for the best experience."}
              </p>
            </CardContent>
          </Card>
        </AnimatedSection>

        {/* ── Affirmations ── */}
        <AnimatedSection>
          <Card className="mb-10">
            <CardContent className="p-6 sm:p-8">
              <div className="mb-6 flex items-center gap-3">
                <Sparkles className="h-6 w-6 text-primary" />
                <h2 className="text-xl font-bold">
                  {isAr ? "التأكيدات الإيجابية" : "Positive Affirmations"}
                </h2>
              </div>

              <div className="mb-6 rounded-2xl bg-gradient-to-br from-primary/5 via-violet-500/5 to-teal-500/5 border p-8 text-center min-h-[100px] flex items-center justify-center">
                <p className="text-xl font-semibold leading-relaxed">
                  {affirmations[affIdx]}
                </p>
              </div>

              <div className="flex flex-wrap justify-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => speak(affirmations[affIdx])}
                  disabled={speaking}
                >
                  <Volume2 className="me-2 h-4 w-4" />
                  {speaking
                    ? (isAr ? "يتكلم…" : "Speaking…")
                    : (isAr ? "استمع" : "Listen")}
                </Button>
                <Button onClick={nextAffirmation}>
                  {isAr ? "التأكيد التالي" : "Next Affirmation"}
                  <ChevronRight className="ms-2 h-4 w-4" />
                </Button>
              </div>

              <p className="mt-4 text-xs text-muted-foreground text-center">
                {isAr
                  ? `${affIdx + 1} / ${affirmations.length} — اضغط استمع لتسمع الجملة بصوت عالٍ.`
                  : `${affIdx + 1} / ${affirmations.length} — tap Listen to hear it read aloud.`}
              </p>
            </CardContent>
          </Card>
        </AnimatedSection>

        {/* ── Professional support CTA ── */}
        <AnimatedSection>
          <div className="rounded-2xl border bg-card p-6 text-center">
            <Heart className="mx-auto mb-3 h-8 w-8 text-primary" />
            <h2 className="text-xl font-bold mb-2">
              {isAr ? "هل تحتاج دعماً متخصصاً؟" : "Need Professional Support?"}
            </h2>
            <p className="mb-5 text-muted-foreground max-w-md mx-auto">
              {isAr
                ? "فريقنا من المتخصصين في الصحة النفسية وذوي الإعاقة في خدمتك على مدار الساعة."
                : "Our mental wellness and accessibility specialists are available around the clock."}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild>
                <Link to="/services/psychology">
                  {isAr ? "احجز جلسة نفسية" : "Book a Psychology Session"}
                  <ChevronRight className="ms-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/services/social-guide">
                  {isAr ? "دعم الوصول الاجتماعي" : "Social Guide Support"}
                </Link>
              </Button>
            </div>
          </div>
        </AnimatedSection>

      </section>
    </Layout>
  );
}
