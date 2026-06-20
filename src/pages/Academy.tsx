import { useRef, useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import ReactMarkdown from "react-markdown";
import CareerAptitudeTest from "@/components/CareerAptitudeTest";
import PomodoroTimer from "@/components/PomodoroTimer";
import {
  User, Globe, GraduationCap, ArrowRight, Compass,
  Briefcase, Rocket, Star, BrainCircuit,
  Zap, Lightbulb, Volume2, Search,
  Loader2, Send, Trash2, Phone, BookOpen,
  Copy, Check, ThumbsUp, ThumbsDown,
  Maximize2, Minimize2, Square, CalendarDays,
  MessageSquare, TrendingUp, FlaskConical,
} from "lucide-react";
import { VoiceChat } from "@/components/VoiceChat";
import { WatchAdButton } from "@/components/WatchAdButton";
import { speakText } from "@/lib/audio/speech";
import { useAcademyProfile } from "@/hooks/academy/useAcademyProfile";
import { useAcademyChat }    from "@/hooks/academy/useAcademyChat";
import { usePoints }         from "@/hooks/usePoints";
import type { StudentProfile } from "@/lib/types";

const COUNTRIES = ["لبنان", "مصر", "السعودية", "تركيا", "أمريكا", "بلد آخر"];
const LEVELS    = ["ابتدائي", "متوسط", "ثانوي / بكالوريا", "جامعي / دراسات"];

const XP_LEVELS = [
  { label: "المبتدئ",        min: 0    },
  { label: "النابغة الصاعد", min: 100  },
  { label: "المتقدم",        min: 500  },
  { label: "الخبير",         min: 1000 },
  { label: "الأسطورة",       min: 2500 },
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

const speak = (text: string) => speakText(text, "ar", { rate: 0.9 });

const formatTime = (ts?: number) => {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" });
};

// ── Typing dots animation ────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5" aria-label="منير يكتب">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-primary/70 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.8s" }}
        />
      ))}
    </div>
  );
}

export default function Academy() {
  const navigate = useNavigate();

  const [formProfile, setFormProfile] = useState<StudentProfile>({ name: "", gender: "male", country: "", level: "" });
  const [step, setStep]               = useState(1);
  const [voiceMode, setVoiceMode]     = useState(false);
  const [showAptitude, setShowAptitude] = useState(false);
  const [fullscreen, setFullscreen]   = useState(false);
  const [copiedId, setCopiedId]       = useState<string | null>(null);
  const [feedback, setFeedback]       = useState<Record<string, "up" | "down">>({});

  const { profile, isOnboarded, isLoading: profileLoading, saveProfile, isSaving } = useAcademyProfile();

  const sessionId = useMemo(() => crypto.randomUUID(), []);

  const studentForChat: StudentProfile | null = isOnboarded && profile
    ? { name: profile.name, gender: profile.gender, country: profile.country, level: profile.level }
    : null;

  const {
    messages, isStreaming, isLoadingHistory,
    error: chatError, rateLimitCooldown,
    send: sendMessage, clearChat, abortStream,
  } = useAcademyChat(studentForChat, sessionId);

  const { totalPoints } = usePoints();
  const xpFromAcademy   = profile?.xp_total ?? 0;
  const xpLevel         = getXPLevel(xpFromAcademy);

  const [chatInput, setChatInput] = useState("");
  const scrollRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const isNextDisabled =
    (step === 1 && !formProfile.name.trim()) ||
    (step === 2 && !formProfile.country) ||
    (step === 3 && !formProfile.level);

  const handleNext = async () => {
    if (step === 1) speak(`أهلاً بك يا ${formProfile.gender === "male" ? "بطل" : "بطلة"}, ${formProfile.name}`);
    if (step === 3) {
      speak(`ممتاز، منهاج الـ ${formProfile.level} في ${formProfile.country} جاهز لك الآن.`);
      await saveProfile(formProfile);
      return;
    }
    setStep(step + 1);
  };

  const handleSend = useCallback((text: string) => {
    if (!text.trim() || isStreaming) return;
    sendMessage(text);
    setChatInput("");
    inputRef.current?.focus();
  }, [isStreaming, sendMessage]);

  const handleCopy = useCallback((id: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }, []);

  const handleFeedback = useCallback((id: string, vote: "up" | "down") => {
    setFeedback((prev) => ({ ...prev, [id]: prev[id] === vote ? undefined as unknown as "up" : vote }));
  }, []);

  // Quick prompt chips
  const quickPrompts = useMemo(() => [
    { icon: <MessageSquare className="w-3.5 h-3.5" />, label: "اشرح لي درساً", text: `اشرح لي درساً مهماً في مستوى ${profile?.level ?? "الثانوي"} بطريقة مبسطة` },
    { icon: <CalendarDays  className="w-3.5 h-3.5" />, label: "خطة مذاكرة أسبوعية", text: `أعطني خطة مذاكرة أسبوعية منظمة لطالب ${profile?.level ?? ""} في ${profile?.country ?? ""}` },
    { icon: <TrendingUp    className="w-3.5 h-3.5" />, label: "سوق العمل", text: `شو هي الوظائف المطلوبة والرواتب في ${profile?.country ?? "العالم"} لعام 2026؟` },
    { icon: <BrainCircuit  className="w-3.5 h-3.5" />, label: "نصيحة مهنية", text: "ساعدني أختار تخصصي الجامعي بناءً على ميولي واهتماماتي" },
    { icon: <FlaskConical  className="w-3.5 h-3.5" />, label: "تقنيات مذاكرة", text: "شو هي أفضل تقنيات المذاكرة الفعّالة لتحسين الحفظ والاستيعاب؟" },
  ], [profile]);

  if (profileLoading) {
    return (
      <Layout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  const displayProfile = isOnboarded && profile
    ? { name: profile.name, gender: profile.gender as "male" | "female", country: profile.country, level: profile.level }
    : formProfile;

  // Is the last message from the user and we haven't got first token yet?
  const waitingForFirstToken = isStreaming && messages[messages.length - 1]?.role === "user";

  return (
    <Layout>
      <div className="font-sans overflow-x-hidden text-start">

        {/* ── ONBOARDING ─────────────────────────────────────────────────────── */}
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
                    <Button variant={formProfile.gender === "male" ? "default" : "outline"} className="flex-1 py-6 text-lg font-bold rounded-2xl" onClick={() => setFormProfile({ ...formProfile, gender: "male" })}>أنا ولد ♂</Button>
                    <Button variant={formProfile.gender === "female" ? "default" : "outline"} className={`flex-1 py-6 text-lg font-bold rounded-2xl ${formProfile.gender === "female" ? "bg-pink-500 hover:bg-pink-600 border-pink-500" : ""}`} onClick={() => setFormProfile({ ...formProfile, gender: "female" })}>أنا بنت ♀</Button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-8 animate-in fade-in duration-500">
                  <Globe className="w-20 h-20 mx-auto text-emerald-500 animate-pulse" />
                  <h2 className="text-3xl md:text-4xl font-black text-foreground">من أي بلد عم تتابعنا؟</h2>
                  <div className="grid grid-cols-2 gap-4">
                    {COUNTRIES.map((c) => (
                      <Button key={c} variant={formProfile.country === c ? "default" : "outline"} className="p-4 h-auto rounded-2xl font-bold text-base" onClick={() => setFormProfile({ ...formProfile, country: c })}>{c}</Button>
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
                      <Button key={l} variant={formProfile.level === l ? "default" : "outline"} className="p-5 h-auto rounded-2xl text-start flex justify-between items-center text-lg" onClick={() => setFormProfile({ ...formProfile, level: l })}>
                        <span className="font-bold">{l}</span>
                        {formProfile.level === l && <Star className="fill-yellow-400 text-yellow-400 w-5 h-5" />}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <Button onClick={handleNext} disabled={isNextDisabled || isSaving} size="lg" className="mt-12 w-full py-6 rounded-2xl font-black text-xl">
                {isSaving
                  ? <><Loader2 className="w-5 h-5 animate-spin me-2" /> جاري الحفظ...</>
                  : <>متابعة الرحلة <ArrowRight className="w-6 h-6 rotate-180 ms-2" /></>
                }
              </Button>
            </div>
          </div>
        )}

        {/* ── DASHBOARD ──────────────────────────────────────────────────────── */}
        {isOnboarded && (
          <div className="p-4 md:p-8 max-w-7xl mx-auto animate-in fade-in duration-1000">

            {/* ── Header ─────────────────────────────────────────────────────── */}
            <header className="bg-card rounded-3xl shadow-sm border border-border mb-10 overflow-hidden">
              {/* Top row: profile info */}
              <div className="p-6 md:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/50">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gradient-to-tr from-primary to-primary/80 rounded-2xl flex items-center justify-center text-primary-foreground shadow-xl">
                    <User className="w-8 h-8" />
                  </div>
                  <div>
                    <h1 className="text-xl md:text-2xl font-black text-foreground">
                      أهلاً {displayProfile.gender === "male" ? "بالبطل" : "بالبطلة"} {displayProfile.name} ✨
                    </h1>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      <span className="px-2.5 py-0.5 bg-primary/10 text-primary rounded-lg text-xs font-bold border border-primary/20">{displayProfile.level}</span>
                      <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-600 rounded-lg text-xs font-bold border border-emerald-500/20">منهاج {displayProfile.country}</span>
                      <span className="px-2.5 py-0.5 bg-yellow-400/10 text-yellow-600 rounded-lg text-xs font-bold border border-yellow-400/20">
                        <Zap className="inline w-3 h-3 me-1" />{totalPoints.toLocaleString()} VX
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom row: action buttons */}
              <div className="px-6 md:px-8 py-4 flex flex-wrap gap-2 items-center">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 rounded-xl"
                  onClick={() => speak(`أهلاً بك يا ${displayProfile.name}. أنا هنا لأرشدك في دروسك وفي اختيار مهنة المستقبل.`)}
                  aria-label="تشغيل صوتي"
                >
                  <Volume2 className="w-4 h-4" />
                  تحية صوتية
                </Button>

                <Button
                  variant={voiceMode ? "default" : "outline"}
                  size="sm"
                  className="gap-2 rounded-xl"
                  onClick={() => setVoiceMode(v => !v)}
                >
                  <Phone className="w-4 h-4" />
                  {voiceMode ? "إخفاء المكالمة" : "مكالمة مع منير"}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 rounded-xl"
                  onClick={() => navigate("/content")}
                >
                  <BookOpen className="w-4 h-4" />
                  غرفتي الدراسية
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 rounded-xl"
                  onClick={() => handleSend(`أعطني خطة مذاكرة أسبوعية منظمة لطالب ${displayProfile.level} في ${displayProfile.country}`)}
                  disabled={isStreaming}
                >
                  <CalendarDays className="w-4 h-4" />
                  خطة مذاكرة
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 rounded-xl"
                  onClick={() => navigate("/services/ocr-scan")}
                >
                  <Search className="w-4 h-4" />
                  ماسح الدروس
                </Button>
              </div>
            </header>

            {/* Voice mode panel */}
            {voiceMode && (
              <div className="mb-8">
                <VoiceChat
                  assistant="munir"
                  assistantName="منير — المساعد الأكاديمي"
                  className="max-w-lg mx-auto"
                />
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

              {/* ── Main Content ─────────────────────────────────────────────── */}
              <div className={`space-y-8 ${fullscreen ? "fixed inset-0 z-50 p-4 bg-background overflow-auto" : "lg:col-span-8"}`}>

                {/* Career Compass — hide in fullscreen */}
                {!fullscreen && (showAptitude ? (
                  <CareerAptitudeTest profile={displayProfile} onClose={() => setShowAptitude(false)} />
                ) : (
                  <div className="bg-card p-8 rounded-3xl border border-border shadow-lg">
                    <div className="flex items-center gap-4 mb-8 border-b border-border pb-5">
                      <div className="p-3 bg-orange-500/10 text-orange-500 rounded-2xl"><Compass className="w-5 h-5" /></div>
                      <h2 className="text-xl font-black text-foreground tracking-tight">بوصلة المستقبل لـ {displayProfile.name}</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="p-6 bg-muted/50 rounded-2xl border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-all cursor-pointer group" onClick={() => setShowAptitude(true)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setShowAptitude(true)}>
                        <BrainCircuit className="w-10 h-10 text-primary mb-4 group-hover:scale-110 transition-transform" />
                        <h4 className="font-bold text-lg mb-2 text-foreground">اختبار الميول 2026</h4>
                        <p className="text-muted-foreground text-sm">8 أسئلة تفاعلية ومنير يحلل نتائجك</p>
                      </div>
                      <div className="p-6 bg-muted/50 rounded-2xl border-2 border-dashed border-border hover:border-orange-500 hover:bg-orange-500/5 transition-all cursor-pointer group" onClick={() => handleSend(`شو هي الوظائف المطلوبة والرواتب في ${displayProfile.country} لعام 2026؟`)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && handleSend(`شو هي الوظائف المطلوبة والرواتب في ${displayProfile.country} لعام 2026؟`)}>
                        <Briefcase className="w-10 h-10 text-orange-500 mb-4 group-hover:scale-110 transition-transform" />
                        <h4 className="font-bold text-lg mb-2 text-foreground">سوق العمل العالمي</h4>
                        <p className="text-muted-foreground text-sm">الرواتب والوظائف في {displayProfile.country} لهيدي السنة</p>
                      </div>
                    </div>
                  </div>
                ))}

                {!fullscreen && <WatchAdButton variant="banner" />}

                {/* ── Chat Panel ─────────────────────────────────────────────── */}
                <div className={`bg-foreground rounded-3xl text-background relative shadow-2xl overflow-hidden ${fullscreen ? "flex flex-col h-full" : ""}`}>

                  {/* Chat Header */}
                  <div className="flex items-center justify-between p-5 md:p-7 border-b border-background/10">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 bg-primary rounded-xl flex items-center justify-center shadow-lg shrink-0">
                        <Lightbulb className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black leading-tight">منير — مساعد {displayProfile.level}</h3>
                        <p className="text-primary text-[10px] font-bold uppercase tracking-widest">
                          {isStreaming ? "يكتب..." : "توجيه أكاديمي ذكي"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {messages.length > 0 && (
                        <button
                          onClick={clearChat}
                          className="p-2 rounded-xl text-background/40 hover:text-background hover:bg-background/10 transition-colors"
                          aria-label="مسح المحادثة"
                          title="مسح المحادثة"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => setFullscreen(f => !f)}
                        className="p-2 rounded-xl text-background/40 hover:text-background hover:bg-background/10 transition-colors"
                        aria-label={fullscreen ? "تصغير" : "تكبير"}
                        title={fullscreen ? "تصغير" : "تكبير"}
                      >
                        {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Messages */}
                  <div
                    ref={scrollRef}
                    className={`bg-background/5 backdrop-blur-xl border-b border-background/10 overflow-y-auto p-4 md:p-6 space-y-4 ${fullscreen ? "flex-1" : "max-h-[480px] min-h-[200px]"}`}
                    role="log"
                    aria-live="polite"
                    aria-relevant="additions"
                    aria-atomic="false"
                    aria-label="محادثة مع منير"
                  >
                    {isLoadingHistory ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
                      </div>
                    ) : messages.length === 0 ? (
                      <p className="text-lg md:text-xl leading-relaxed font-medium text-center py-8 text-background/70">
                        يا {displayProfile.name}، أنا منير 🧠 اسألني أي شي عن دروسك أو مستقبلك المهني!
                      </p>
                    ) : (
                      messages.map((msg) => (
                        <div key={msg.id} className={`flex flex-col gap-1 ${msg.role === "user" ? "items-start" : "items-end"}`}>
                          {/* Bubble */}
                          <div className={`group relative max-w-[85%] rounded-2xl px-4 py-3 text-sm md:text-base ${
                            msg.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-background/10 text-background border border-background/10"
                          }`}>
                            {msg.role === "assistant" ? (
                              <div className="prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                                {msg.isStreaming && <span className="inline-block w-1.5 h-4 bg-primary/70 animate-pulse ms-0.5 align-middle rounded-sm" />}
                              </div>
                            ) : msg.content}

                            {/* Timestamp on hover */}
                            {msg.timestamp && (
                              <span className="absolute -bottom-5 text-[10px] text-background/30 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap px-1">
                                {formatTime(msg.timestamp)}
                              </span>
                            )}
                          </div>

                          {/* Assistant action buttons */}
                          {msg.role === "assistant" && !msg.isStreaming && (
                            <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ opacity: undefined }}>
                              {/* TTS */}
                              <button
                                onClick={() => speak(msg.content)}
                                className="p-1.5 rounded-lg text-background/40 hover:text-background hover:bg-background/10 transition-colors"
                                aria-label="استمع للرد"
                                title="استمع"
                              >
                                <Volume2 className="w-3.5 h-3.5" />
                              </button>
                              {/* Copy */}
                              <button
                                onClick={() => handleCopy(msg.id, msg.content)}
                                className="p-1.5 rounded-lg text-background/40 hover:text-background hover:bg-background/10 transition-colors"
                                aria-label="نسخ الرد"
                                title="نسخ"
                              >
                                {copiedId === msg.id
                                  ? <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  : <Copy className="w-3.5 h-3.5" />
                                }
                              </button>
                              {/* Thumbs up */}
                              <button
                                onClick={() => handleFeedback(msg.id, "up")}
                                className={`p-1.5 rounded-lg transition-colors ${feedback[msg.id] === "up" ? "text-emerald-400" : "text-background/40 hover:text-background hover:bg-background/10"}`}
                                aria-label="رد مفيد"
                                title="مفيد"
                              >
                                <ThumbsUp className="w-3.5 h-3.5" />
                              </button>
                              {/* Thumbs down */}
                              <button
                                onClick={() => handleFeedback(msg.id, "down")}
                                className={`p-1.5 rounded-lg transition-colors ${feedback[msg.id] === "down" ? "text-red-400" : "text-background/40 hover:text-background hover:bg-background/10"}`}
                                aria-label="رد غير مفيد"
                                title="غير مفيد"
                              >
                                <ThumbsDown className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    )}

                    {/* Typing dots — waiting for first token */}
                    {waitingForFirstToken && (
                      <div className="flex justify-end">
                        <div className="bg-background/10 rounded-2xl px-4 py-3 border border-background/10">
                          <TypingDots />
                        </div>
                      </div>
                    )}

                    {chatError && (
                      <p className="text-center text-sm text-red-400">{chatError}</p>
                    )}
                  </div>

                  {/* Quick prompts — shown when chat is empty */}
                  {messages.length === 0 && !isStreaming && (
                    <div className="px-4 md:px-6 pt-4 flex flex-wrap gap-2">
                      {quickPrompts.map((p) => (
                        <button
                          key={p.label}
                          onClick={() => handleSend(p.text)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-background/10 hover:bg-background/20 border border-background/15 rounded-xl text-background/70 hover:text-background text-xs font-medium transition-all"
                        >
                          {p.icon}
                          {p.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Rate limit warning */}
                  {rateLimitCooldown > 0 && (
                    <p className="text-center text-xs text-background/50 pt-3 px-6">
                      ⏳ انتظر {rateLimitCooldown} ثانية قبل إرسال رسالة جديدة
                    </p>
                  )}

                  {/* Input */}
                  <form
                    className="p-4 md:p-6 pt-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (isStreaming) { abortStream(); return; }
                      handleSend(chatInput);
                    }}
                  >
                    <div className="relative">
                      <input
                        ref={inputRef}
                        className="w-full p-4 pe-14 bg-background/10 rounded-2xl outline-none focus:ring-2 focus:ring-primary/50 text-background placeholder:text-background/30 transition-all text-sm md:text-base"
                        placeholder="اسأل منير عن دروسك أو مستقبلك... (Enter للإرسال)"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        disabled={rateLimitCooldown > 0}
                        aria-label="رسالة للمساعد منير"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            if (isStreaming) { abortStream(); return; }
                            handleSend(chatInput);
                          }
                        }}
                      />
                      <button
                        type="submit"
                        disabled={rateLimitCooldown > 0 || (!chatInput.trim() && !isStreaming)}
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-primary text-primary-foreground p-2.5 rounded-xl hover:scale-110 transition-transform disabled:opacity-50 disabled:hover:scale-100"
                        aria-label={isStreaming ? "إيقاف" : "إرسال"}
                        title={isStreaming ? "إيقاف" : "إرسال"}
                      >
                        {isStreaming
                          ? <Square className="w-4 h-4 fill-current" />
                          : <Send className="w-4 h-4" />
                        }
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* ── Sidebar ──────────────────────────────────────────────────── */}
              {!fullscreen && (
                <div className="lg:col-span-4 space-y-6">
                  <PomodoroTimer />

                  {/* XP Card */}
                  <div className="bg-gradient-to-br from-indigo-600 to-purple-800 p-8 rounded-3xl text-white shadow-2xl relative overflow-hidden">
                    <Rocket className="absolute -left-4 -bottom-4 w-28 h-28 opacity-10 -rotate-12" />
                    <h4 className="text-xl font-black mb-4 tracking-tight flex items-center gap-2">
                      <Star className="text-yellow-400 w-5 h-5 fill-yellow-400" />
                      مستوى {displayProfile.name}
                    </h4>
                    <div className="space-y-3">
                      <div className="flex justify-between text-xs font-bold opacity-80 uppercase tracking-widest">
                        <span>{xpLevel.label}</span>
                        <span>{xpLevel.current} / {xpLevel.target} XP</span>
                      </div>
                      <div className="w-full bg-white/20 h-2.5 rounded-full overflow-hidden border border-white/10">
                        <div className="h-full bg-yellow-400 rounded-full transition-all duration-700" style={{ width: `${xpLevel.percent}%` }} />
                      </div>
                    </div>
                    <p className="mt-6 text-sm opacity-70 italic">
                      {xpLevel.percent < 80 ? "واصل وارسل رسائل لمنير لتكسب XP!" : "أنت قريب من المستوى التالي! 🎯"}
                    </p>
                  </div>

                  {/* Quick stats */}
                  <div className="bg-card rounded-3xl p-6 border border-border space-y-3">
                    <h4 className="font-black text-foreground">إحصائياتك</h4>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">رسائل مرسلة</span>
                      <span className="font-bold text-foreground">{messages.filter(m => m.role === "user").length}</span>
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
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
