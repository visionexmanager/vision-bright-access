import { useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import ReactMarkdown from "react-markdown";
import CareerAptitudeTest from "@/components/CareerAptitudeTest";
import PomodoroTimer from "@/components/PomodoroTimer";
import { useState } from "react";
import {
  User, Globe, GraduationCap, ArrowRight, Compass,
  Briefcase, Rocket, Star, BrainCircuit,
  Zap, Lightbulb, Volume2, LayoutDashboard, Search,
  Loader2, Send, Trash2, Phone, BookOpen
} from "lucide-react";
import { VoiceChat } from "@/components/VoiceChat";
import { WatchAdButton } from "@/components/WatchAdButton";

// ── New hooks (DB-backed) ────────────────────────────────────────────────────
import { useAcademyProfile } from "@/hooks/academy/useAcademyProfile";
import { useAcademyChat }    from "@/hooks/academy/useAcademyChat";
import { usePoints }         from "@/hooks/usePoints";
import type { StudentProfile } from "@/lib/types";

// ── Constants ────────────────────────────────────────────────────────────────
const COUNTRIES = ["لبنان", "مصر", "السعودية", "تركيا", "أمريكا", "بلد آخر"];
const LEVELS    = ["ابتدائي", "متوسط", "ثانوي / بكالوريا", "جامعي / دراسات"];

// ── XP levels config ─────────────────────────────────────────────────────────
const XP_LEVELS = [
  { label: "المبتدئ",       min: 0    },
  { label: "النابغة الصاعد", min: 100  },
  { label: "المتقدم",       min: 500  },
  { label: "الخبير",        min: 1000 },
  { label: "الأسطورة",      min: 2500 },
];

function getXPLevel(xp: number) {
  const current = [...XP_LEVELS].reverse().find((l) => xp >= l.min) ?? XP_LEVELS[0];
  const nextIdx = XP_LEVELS.indexOf(current) + 1;
  const next    = XP_LEVELS[nextIdx];
  const target  = next?.min ?? current.min + 1000;
  const base    = current.min;
  const percent = Math.min(Math.round(((xp - base) / (target - base)) * 100), 100);
  return { label: current.label, current: xp - base, target: target - base, percent };
}

// ── TTS helper ───────────────────────────────────────────────────────────────
const speak = (text: string) => {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    const utt  = new SpeechSynthesisUtterance(text);
    utt.lang   = "ar-SA";
    utt.rate   = 0.9;
    window.speechSynthesis.speak(utt);
  }
};

// ── Component ────────────────────────────────────────────────────────────────
export default function Academy() {
  const navigate  = useNavigate();

  // ── Onboarding local form state (only used until profile is saved to DB) ──
  const [formProfile, setFormProfile] = useState<StudentProfile>({
    name: "", gender: "male", country: "", level: "",
  });
  const [step, setStep]           = useState(1);
  const [voiceMode, setVoiceMode] = useState(false);
  const [showAptitude, setShowAptitude] = useState(false);

  // ── DB-backed profile ─────────────────────────────────────────────────────
  const {
    profile,
    isOnboarded,
    isLoading: profileLoading,
    saveProfile,
    isSaving,
  } = useAcademyProfile();

  // ── Session ID — stable per browser tab (not stored in DB) ───────────────
  const sessionId = useMemo(() => crypto.randomUUID(), []);

  // ── Chat (DB-backed) ──────────────────────────────────────────────────────
  const studentForChat: StudentProfile | null = isOnboarded && profile
    ? { name: profile.name, gender: profile.gender, country: profile.country, level: profile.level }
    : null;

  const {
    messages,
    isStreaming,
    isLoadingHistory,
    error:       chatError,
    rateLimitCooldown,
    send:        sendMessage,
    clearChat,
    abortStream,
  } = useAcademyChat(studentForChat, sessionId);

  // ── Real XP from Supabase ─────────────────────────────────────────────────
  const { totalPoints } = usePoints();
  const xpFromAcademy   = profile?.xp_total ?? 0;
  const xpLevel         = getXPLevel(xpFromAcademy);

  // ── Chat input state ──────────────────────────────────────────────────────
  const [chatInput, setChatInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // ── Onboarding logic ──────────────────────────────────────────────────────
  const isNextDisabled =
    (step === 1 && !formProfile.name.trim()) ||
    (step === 2 && !formProfile.country) ||
    (step === 3 && !formProfile.level);

  const handleNext = async () => {
    if (step === 1) speak(`أهلاً بك يا ${formProfile.gender === "male" ? "بطل" : "بطلة"}, ${formProfile.name}`);
    if (step === 3) {
      speak(`ممتاز، منهاج الـ ${formProfile.level} في ${formProfile.country} جاهز لك الآن.`);
      await saveProfile(formProfile);
      return; // useAcademyProfile will flip isOnboarded → dashboard renders
    }
    setStep(step + 1);
  };

  // ── Loading state ─────────────────────────────────────────────────────────
  if (profileLoading) {
    return (
      <Layout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  // ── Effective profile for display ─────────────────────────────────────────
  const displayProfile = isOnboarded && profile
    ? { name: profile.name, gender: profile.gender as "male" | "female", country: profile.country, level: profile.level }
    : formProfile;

  return (
    <Layout>
      <div className="font-sans overflow-x-hidden text-start">

        {/* ── ONBOARDING (not yet in DB) ─────────────────────────────────── */}
        {!isOnboarded && (
          <div className="flex items-center justify-center min-h-[80vh] p-6 bg-gradient-to-br from-background to-muted/40">
            <div className="w-full max-w-2xl bg-card p-10 md:p-16 rounded-3xl shadow-xl border border-border text-center relative overflow-hidden">
              <Progress value={(step / 3) * 100} className="absolute top-0 left-0 w-full h-2 rounded-none" />

              {step === 1 && (
                <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                  <div className="w-24 h-24 bg-primary rounded-3xl flex items-center justify-center mx-auto text-primary-foreground shadow-2xl rotate-3">
                    <User className="w-12 h-12" />
                  </div>
                  <h2 className="text-3xl md:text-4xl font-black text-foreground tracking-tight">شو اسمك يا بطل؟</h2>
                  <Input
                    value={formProfile.name}
                    onChange={(e) => setFormProfile({ ...formProfile, name: e.target.value })}
                    className="text-center text-xl md:text-2xl py-6 rounded-2xl"
                    placeholder="اسمي هو..."
                    onKeyDown={(e) => e.key === "Enter" && !isNextDisabled && handleNext()}
                  />
                  <div className="flex gap-4 justify-center">
                    <Button
                      variant={formProfile.gender === "male" ? "default" : "outline"}
                      className="flex-1 py-6 text-lg font-bold rounded-2xl"
                      onClick={() => setFormProfile({ ...formProfile, gender: "male" })}
                    >أنا ولد ♂</Button>
                    <Button
                      variant={formProfile.gender === "female" ? "default" : "outline"}
                      className={`flex-1 py-6 text-lg font-bold rounded-2xl ${formProfile.gender === "female" ? "bg-pink-500 hover:bg-pink-600 border-pink-500" : ""}`}
                      onClick={() => setFormProfile({ ...formProfile, gender: "female" })}
                    >أنا بنت ♀</Button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-8 animate-in fade-in duration-500">
                  <Globe className="w-20 h-20 mx-auto text-emerald-500 animate-pulse" />
                  <h2 className="text-3xl md:text-4xl font-black text-foreground">من أي بلد عم تتابعنا؟</h2>
                  <div className="grid grid-cols-2 gap-4">
                    {COUNTRIES.map((c) => (
                      <Button
                        key={c}
                        variant={formProfile.country === c ? "default" : "outline"}
                        className="p-4 h-auto rounded-2xl font-bold text-base"
                        onClick={() => setFormProfile({ ...formProfile, country: c })}
                      >{c}</Button>
                    ))}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-8 animate-in zoom-in-95 duration-500">
                  <GraduationCap className="w-20 h-20 mx-auto text-orange-500" />
                  <h2 className="text-3xl md:text-4xl font-black text-foreground">شو مستواك الدراسي؟</h2>
                  <div className="grid grid-cols-1 gap-3">
                    {LEVELS.map((l) => (
                      <Button
                        key={l}
                        variant={formProfile.level === l ? "default" : "outline"}
                        className="p-5 h-auto rounded-2xl text-start flex justify-between items-center text-lg"
                        onClick={() => setFormProfile({ ...formProfile, level: l })}
                      >
                        <span className="font-bold">{l}</span>
                        {formProfile.level === l && <Star className="fill-yellow-400 text-yellow-400 w-5 h-5" />}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <Button
                onClick={handleNext}
                disabled={isNextDisabled || isSaving}
                size="lg"
                className="mt-12 w-full py-6 rounded-2xl font-black text-xl"
              >
                {isSaving
                  ? <><Loader2 className="w-5 h-5 animate-spin me-2" /> جاري الحفظ...</>
                  : <>متابعة الرحلة <ArrowRight className="w-6 h-6 rotate-180 ms-2" /></>
                }
              </Button>
            </div>
          </div>
        )}

        {/* ── DASHBOARD (profile exists in DB) ──────────────────────────── */}
        {isOnboarded && (
          <div className="p-4 md:p-8 max-w-7xl mx-auto animate-in fade-in duration-1000">

            {/* Header */}
            <header className="bg-card p-8 rounded-3xl shadow-sm border border-border mb-10 flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 bg-gradient-to-tr from-primary to-primary/80 rounded-3xl flex items-center justify-center text-primary-foreground shadow-2xl">
                  <User className="w-10 h-10" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-black text-foreground">
                    أهلاً {displayProfile.gender === "male" ? "بالبطل" : "بالبطلة"} {displayProfile.name} ✨
                  </h1>
                  <div className="flex gap-3 mt-2">
                    <span className="px-3 py-1 bg-primary/10 text-primary rounded-lg text-xs font-bold border border-primary/20">{displayProfile.level}</span>
                    <span className="px-3 py-1 bg-emerald-500/10 text-emerald-600 rounded-lg text-xs font-bold border border-emerald-500/20">منهاج {displayProfile.country}</span>
                    <span className="px-3 py-1 bg-yellow-400/10 text-yellow-600 rounded-lg text-xs font-bold border border-yellow-400/20">
                      <Zap className="inline w-3 h-3 me-1" />{totalPoints.toLocaleString()} VX
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 flex-wrap justify-center">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-14 w-14 rounded-2xl"
                  onClick={() => speak(`أهلاً بك يا ${displayProfile.name}. أنا هنا لأرشدك في دروسك وفي اختيار مهنة المستقبل.`)}
                  aria-label="تشغيل صوتي"
                >
                  <Volume2 className="w-6 h-6" />
                </Button>
                <Button
                  variant={voiceMode ? "default" : "outline"}
                  className="px-6 py-4 h-auto rounded-2xl font-bold"
                  onClick={() => setVoiceMode(v => !v)}
                >
                  <Phone className="w-5 h-5 me-2" />
                  {voiceMode ? "وضع النص" : "تحدث مع منير"}
                </Button>
                <Button
                  className="px-8 py-4 h-auto rounded-2xl font-bold"
                  onClick={() => navigate("/content")}
                >
                  <BookOpen className="w-5 h-5 me-2" /> غرفتي الدراسية
                </Button>
              </div>
            </header>

            {/* Voice mode panel */}
            {voiceMode && (
              <div className="mb-6">
                <VoiceChat
                  assistant="munir"
                  assistantName="منير — المساعد الأكاديمي"
                  className="max-w-lg mx-auto"
                />
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

              {/* ── Main Content ───────────────────────────────────────────── */}
              <div className="lg:col-span-8 space-y-8">

                {/* Career Compass */}
                {showAptitude ? (
                  <CareerAptitudeTest
                    profile={displayProfile}
                    onClose={() => setShowAptitude(false)}
                  />
                ) : (
                  <div className="bg-card p-8 rounded-3xl border border-border shadow-lg">
                    <div className="flex items-center gap-4 mb-10 border-b border-border pb-6">
                      <div className="p-4 bg-orange-500/10 text-orange-500 rounded-2xl"><Compass /></div>
                      <h2 className="text-2xl font-black text-foreground tracking-tight">
                        بوصلة المستقبل لـ {displayProfile.name}
                      </h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div
                        className="p-8 bg-muted/50 rounded-3xl border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-all cursor-pointer group"
                        onClick={() => setShowAptitude(true)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === "Enter" && setShowAptitude(true)}
                      >
                        <BrainCircuit className="w-12 h-12 text-primary mb-6 group-hover:scale-110 transition-transform" />
                        <h4 className="font-bold text-xl mb-3 text-foreground">اختبار الميول لعام 2026</h4>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                          اكتشف شخصيتك المهنية عبر 8 أسئلة تفاعلية ومنير يحلل نتائجك بالذكاء الاصطناعي!
                        </p>
                      </div>
                      <div
                        className="p-8 bg-muted/50 rounded-3xl border-2 border-dashed border-border hover:border-orange-500 hover:bg-orange-500/5 transition-all cursor-pointer group"
                        onClick={() => sendMessage(`شو هي الوظائف المطلوبة والرواتب في ${displayProfile.country} لعام 2026؟`)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === "Enter" && sendMessage(`شو هي الوظائف المطلوبة والرواتب في ${displayProfile.country} لعام 2026؟`)}
                      >
                        <Briefcase className="w-12 h-12 text-orange-500 mb-6 group-hover:scale-110 transition-transform" />
                        <h4 className="font-bold text-xl mb-3 text-foreground">سوق العمل العالمي</h4>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                          اكتشف شو هي الرواتب والوظائف المطلوبة بـ {displayProfile.country} وبالعالم لهيدي السنة.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <WatchAdButton variant="banner" className="my-6" />

                {/* ── Chat Panel ─────────────────────────────────────────── */}
                <div className="bg-foreground rounded-3xl p-6 md:p-10 text-background relative shadow-2xl overflow-hidden">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center shadow-lg">
                        <Lightbulb className="w-8 h-8" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-black">منير — مساعد {displayProfile.level}</h3>
                        <p className="text-primary text-xs font-bold uppercase tracking-widest">
                          {isStreaming ? "يكتب..." : "توجيه أكاديمي ذكي"}
                        </p>
                      </div>
                    </div>
                    {messages.length > 0 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-background/50 hover:text-background hover:bg-background/10 rounded-xl"
                        onClick={clearChat}
                        aria-label="مسح المحادثة"
                      >
                        <Trash2 className="w-5 h-5" />
                      </Button>
                    )}
                  </div>

                  {/* Messages area */}
                  <div
                    ref={scrollRef}
                    className="bg-background/5 backdrop-blur-xl rounded-3xl border border-background/10 mb-6 max-h-[400px] min-h-[180px] overflow-y-auto p-4 md:p-6 space-y-4"
                    aria-live="polite"
                    aria-label="محادثة مع منير"
                  >
                    {isLoadingHistory ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
                      </div>
                    ) : messages.length === 0 ? (
                      <p className="text-lg md:text-xl leading-relaxed font-medium text-center py-8 text-background/70">
                        يا {displayProfile.name}، أنا منير 🧠 اسألني أي شي عن دروسك أو مستقبلك المهني وأنا بساعدك!
                      </p>
                    ) : (
                      messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.role === "user" ? "justify-start" : "justify-end"}`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm md:text-base ${
                              msg.role === "user"
                                ? "bg-primary text-primary-foreground"
                                : "bg-background/10 text-background border border-background/10"
                            }`}
                          >
                            {msg.role === "assistant" ? (
                              <div className="prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                              </div>
                            ) : msg.content}
                          </div>
                        </div>
                      ))
                    )}
                    {isStreaming && messages[messages.length - 1]?.role === "user" && (
                      <div className="flex justify-end">
                        <div className="bg-background/10 rounded-2xl px-4 py-3 border border-background/10">
                          <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        </div>
                      </div>
                    )}
                    {chatError && (
                      <p className="text-center text-sm text-red-400">{chatError}</p>
                    )}
                  </div>

                  {/* Rate limit warning */}
                  {rateLimitCooldown > 0 && (
                    <p className="text-center text-xs text-background/60 mb-3">
                      ⏳ يرجى الانتظار {rateLimitCooldown} ثانية قبل إرسال رسالة جديدة
                    </p>
                  )}

                  {/* Input */}
                  <form
                    className="relative"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (isStreaming) { abortStream(); return; }
                      sendMessage(chatInput);
                      setChatInput("");
                    }}
                  >
                    <input
                      className="w-full p-5 pe-16 bg-background/10 rounded-2xl outline-none focus:ring-4 focus:ring-primary/50 text-background placeholder:text-background/30 transition-all text-base"
                      placeholder="اسأل منير أي شي عن دروسك أو مستقبلك..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      disabled={rateLimitCooldown > 0}
                      aria-label="رسالة للمساعد منير"
                    />
                    <button
                      type="submit"
                      disabled={rateLimitCooldown > 0 || (!chatInput.trim() && !isStreaming)}
                      className="absolute left-3 top-3 bg-primary text-primary-foreground p-3 rounded-2xl hover:scale-110 transition-transform disabled:opacity-50 disabled:hover:scale-100"
                      aria-label={isStreaming ? "إيقاف" : "إرسال"}
                    >
                      {isStreaming
                        ? <Loader2 className="w-5 h-5 animate-spin" />
                        : <Send className="w-5 h-5" />
                      }
                    </button>
                  </form>
                </div>
              </div>

              {/* ── Sidebar ────────────────────────────────────────────────── */}
              <div className="lg:col-span-4 space-y-8">
                <PomodoroTimer />

                {/* XP Card — REAL DATA from Supabase */}
                <div className="bg-gradient-to-br from-indigo-600 to-purple-800 p-10 rounded-3xl text-white shadow-2xl relative overflow-hidden">
                  <Rocket className="absolute -left-4 -bottom-4 w-32 h-32 opacity-10 -rotate-12" />
                  <h4 className="text-2xl font-black mb-4 tracking-tight flex items-center gap-2">
                    <Star className="text-yellow-400 w-6 h-6 fill-yellow-400" />
                    مستوى {displayProfile.name}
                  </h4>
                  <div className="space-y-4">
                    <div className="flex justify-between text-xs font-bold opacity-80 uppercase tracking-widest">
                      <span>{xpLevel.label}</span>
                      <span>{xpLevel.current} / {xpLevel.target} XP</span>
                    </div>
                    <div className="w-full bg-white/20 h-3 rounded-full overflow-hidden border border-white/10">
                      <div
                        className="h-full bg-yellow-400 rounded-full transition-all duration-700"
                        style={{ width: `${xpLevel.percent}%` }}
                      />
                    </div>
                  </div>
                  <p className="mt-8 text-sm opacity-80 leading-relaxed italic">
                    {xpLevel.percent < 80
                      ? "واصل وارسل رسائل لمنير لتكسب XP أكثر!"
                      : "أنت قريب من المستوى التالي! 🎯"
                    }
                  </p>
                </div>

                {/* OCR Scanner — wired to /services/ocr-scan */}
                <div
                  className="bg-emerald-500 p-8 rounded-3xl text-white flex flex-col items-center gap-4 shadow-xl group cursor-pointer hover:bg-emerald-600 transition-all"
                  onClick={() => navigate("/services/ocr-scan")}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && navigate("/services/ocr-scan")}
                  aria-label="الماسح الضوئي للدروس"
                >
                  <Search className="w-12 h-12 group-hover:scale-125 transition-transform" />
                  <span className="font-black text-xl tracking-tight">الماسح النفاث للدروس</span>
                  <p className="text-xs text-center text-emerald-100">صور كتابك.. ومنير بيلخصه بثواني!</p>
                </div>

                {/* Quick stats */}
                <div className="bg-card rounded-3xl p-6 border border-border space-y-3">
                  <h4 className="font-black text-foreground text-lg">إحصائياتك</h4>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">رسائل مرسلة</span>
                    <span className="font-bold text-foreground">{messages.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">XP الأكاديمية</span>
                    <span className="font-bold text-primary">{xpFromAcademy.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">رصيد VX الكلي</span>
                    <span className="font-bold text-emerald-600">{totalPoints.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
