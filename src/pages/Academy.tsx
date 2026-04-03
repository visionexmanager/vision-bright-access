import { useState, useRef, useEffect, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import CareerAptitudeTest from "@/components/CareerAptitudeTest";
import {
  User, Globe, GraduationCap, ArrowRight, Compass,
  Briefcase, Rocket, Star, MessageSquare, BrainCircuit,
  Zap, Lightbulb, Volume2, LayoutDashboard, Search,
  Loader2, Send, Trash2
} from "lucide-react";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/academy-chat`;

const speak = (text: string) => {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ar-SA";
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type StudentProfile = {
  name: string;
  gender: "male" | "female";
  country: string;
  level: string;
};

const countries = ["لبنان", "مصر", "السعودية", "تركيا", "أمريكا", "بلد آخر"];
const levels = ["ابتدائي", "متوسط", "ثانوي / بكالوريا", "جامعي / دراسات"];

export default function Academy() {
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState<StudentProfile>({
    name: "",
    gender: "male",
    country: "",
    level: "",
  });

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showAptitudeTest, setShowAptitudeTest] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async (input: string) => {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setIsLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    const assistantId = crypto.randomUUID();
    let assistantSoFar = "";

    const apiMessages = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: apiMessages,
          studentProfile: profile,
        }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `خطأ (${resp.status})`);
      }

      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.id === assistantId) {
                  return prev.map(m => m.id === assistantId ? { ...m, content: assistantSoFar } : m);
                }
                return [...prev, { id: assistantId, role: "assistant", content: assistantSoFar }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Flush remaining
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: assistantSoFar } : m));
            }
          } catch { /* ignore */ }
        }
      }
    } catch (e: any) {
      if (e.name === "AbortError") return;
      setMessages(prev => [...prev, { id: assistantId, role: "assistant", content: `⚠️ ${e.message || "حدث خطأ، حاول مرة أخرى."}` }]);
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }, [messages, profile, isLoading]);

  const clearChat = () => {
    abortRef.current?.abort();
    setMessages([]);
    setIsLoading(false);
  };

  const handleNext = () => {
    if (step === 1) {
      const greet = profile.gender === "male"
        ? `أهلاً بك يا بطل، ${profile.name}`
        : `أهلاً بكِ يا بطلة، ${profile.name}`;
      speak(greet);
    }
    if (step === 3) {
      speak(`ممتاز، منهاج الـ ${profile.level} في ${profile.country} جاهز لك الآن.`);
    }
    setStep(step + 1);
  };

  const isNextDisabled =
    (step === 1 && !profile.name) ||
    (step === 2 && !profile.country) ||
    (step === 3 && !profile.level);

  return (
    <Layout>
      <div className="font-sans overflow-x-hidden text-right" dir="rtl">
        {/* Onboarding */}
        {step < 4 && (
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
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    className="text-center text-xl md:text-2xl py-6 rounded-2xl"
                    placeholder="اسمي هو..."
                  />
                  <div className="flex gap-4 justify-center">
                    <Button
                      variant={profile.gender === "male" ? "default" : "outline"}
                      className="flex-1 py-6 text-lg font-bold rounded-2xl"
                      onClick={() => setProfile({ ...profile, gender: "male" })}
                    >
                      أنا ولد ♂
                    </Button>
                    <Button
                      variant={profile.gender === "female" ? "default" : "outline"}
                      className={`flex-1 py-6 text-lg font-bold rounded-2xl ${profile.gender === "female" ? "bg-pink-500 hover:bg-pink-600 border-pink-500" : ""}`}
                      onClick={() => setProfile({ ...profile, gender: "female" })}
                    >
                      أنا بنت ♀
                    </Button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-8 animate-in fade-in duration-500">
                  <Globe className="w-20 h-20 mx-auto text-emerald-500 animate-pulse" />
                  <h2 className="text-3xl md:text-4xl font-black text-foreground">من أي بلد عم تتابعنا؟</h2>
                  <div className="grid grid-cols-2 gap-4">
                    {countries.map((c) => (
                      <Button
                        key={c}
                        variant={profile.country === c ? "default" : "outline"}
                        className="p-4 h-auto rounded-2xl font-bold text-base"
                        onClick={() => setProfile({ ...profile, country: c })}
                      >
                        {c}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-8 animate-in zoom-in-95 duration-500">
                  <GraduationCap className="w-20 h-20 mx-auto text-orange-500" />
                  <h2 className="text-3xl md:text-4xl font-black text-foreground">شو مستواك الدراسي؟</h2>
                  <div className="grid grid-cols-1 gap-3">
                    {levels.map((l) => (
                      <Button
                        key={l}
                        variant={profile.level === l ? "default" : "outline"}
                        className="p-5 h-auto rounded-2xl text-right flex justify-between items-center text-lg"
                        onClick={() => setProfile({ ...profile, level: l })}
                      >
                        <span className="font-bold">{l}</span>
                        {profile.level === l && <Star className="fill-yellow-400 text-yellow-400 w-5 h-5" />}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <Button
                onClick={handleNext}
                disabled={isNextDisabled}
                size="lg"
                className="mt-12 w-full py-6 rounded-2xl font-black text-xl"
              >
                متابعة الرحلة <ArrowRight className="w-6 h-6 rotate-180 ms-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Dashboard */}
        {step >= 4 && (
          <div className="p-4 md:p-8 max-w-7xl mx-auto animate-in fade-in duration-1000">
            {/* Header */}
            <header className="bg-card p-8 rounded-3xl shadow-sm border border-border mb-10 flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 bg-gradient-to-tr from-primary to-primary/80 rounded-3xl flex items-center justify-center text-primary-foreground shadow-2xl">
                  <User className="w-10 h-10" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-black text-foreground">
                    أهلاً {profile.gender === "male" ? "بالبطل" : "بالبطلة"} {profile.name} ✨
                  </h1>
                  <div className="flex gap-3 mt-2">
                    <span className="px-3 py-1 bg-primary/10 text-primary rounded-lg text-xs font-bold border border-primary/20">{profile.level}</span>
                    <span className="px-3 py-1 bg-emerald-500/10 text-emerald-600 rounded-lg text-xs font-bold border border-emerald-500/20">منهاج {profile.country}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-14 w-14 rounded-2xl"
                  onClick={() => speak(`أهلاً بك يا ${profile.name}. أنا هنا لأرشدك في دروسك وفي اختيار مهنة المستقبل.`)}
                >
                  <Volume2 className="w-6 h-6" />
                </Button>
                <Button className="px-8 py-4 h-auto rounded-2xl font-bold">
                  <LayoutDashboard className="w-5 h-5 me-2" /> غرفتي الدراسية
                </Button>
              </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Main Content */}
              <div className="lg:col-span-8 space-y-8">
                {/* Career Aptitude Test or Guidance */}
                {showAptitudeTest ? (
                  <CareerAptitudeTest profile={profile} onClose={() => setShowAptitudeTest(false)} />
                ) : (
                <div className="bg-card p-8 rounded-3xl border border-border shadow-lg">
                  <div className="flex items-center gap-4 mb-10 border-b border-border pb-6">
                    <div className="p-4 bg-orange-500/10 text-orange-500 rounded-2xl"><Compass /></div>
                    <h2 className="text-2xl font-black text-foreground tracking-tight">بوصلة المستقبل لـ {profile.name}</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div
                      className="p-8 bg-muted/50 rounded-3xl border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-all cursor-pointer group"
                      onClick={() => setShowAptitudeTest(true)}
                    >
                      <BrainCircuit className="w-12 h-12 text-primary mb-6 group-hover:scale-110 transition-transform" />
                      <h4 className="font-bold text-xl mb-3 text-foreground">اختبار الميول لعام 2026</h4>
                      <p className="text-muted-foreground text-sm leading-relaxed">اكتشف شخصيتك المهنية عبر 8 أسئلة تفاعلية ومنير يحلل نتائجك بالذكاء الاصطناعي!</p>
                    </div>
                    <div
                      className="p-8 bg-muted/50 rounded-3xl border-2 border-dashed border-border hover:border-orange-500 hover:bg-orange-500/5 transition-all cursor-pointer group"
                      onClick={() => sendMessage(`شو هي الوظائف المطلوبة والرواتب في ${profile.country} لعام 2026؟`)}
                    >
                      <Briefcase className="w-12 h-12 text-orange-500 mb-6 group-hover:scale-110 transition-transform" />
                      <h4 className="font-bold text-xl mb-3 text-foreground">سوق العمل العالمي</h4>
                      <p className="text-muted-foreground text-sm leading-relaxed">اكتشف شو هي الرواتب والوظائف المطلوبة بـ {profile.country} وبالعالم لهيدي السنة.</p>
                    </div>
                  </div>
                </div>
                )}

                {/* Smart Assistant Chat - NOW FUNCTIONAL */}
                <div className="bg-foreground rounded-3xl p-6 md:p-10 text-background relative shadow-2xl overflow-hidden">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center shadow-lg"><Lightbulb className="w-8 h-8" /></div>
                      <div>
                        <h3 className="text-2xl font-black">منير — مساعد {profile.level}</h3>
                        <p className="text-primary text-xs font-bold uppercase tracking-widest">
                          {isLoading ? "يكتب..." : "توجيه أكاديمي ذكي"}
                        </p>
                      </div>
                    </div>
                    {messages.length > 0 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-background/50 hover:text-background hover:bg-background/10 rounded-xl"
                        onClick={clearChat}
                      >
                        <Trash2 className="w-5 h-5" />
                      </Button>
                    )}
                  </div>

                  {/* Messages area */}
                  <div
                    ref={scrollRef}
                    className="bg-background/5 backdrop-blur-xl rounded-3xl border border-background/10 mb-6 max-h-[400px] min-h-[180px] overflow-y-auto p-4 md:p-6 space-y-4"
                  >
                    {messages.length === 0 ? (
                      <p className="text-lg md:text-xl leading-relaxed font-medium text-center py-8 text-background/70">
                        يا {profile.name}، أنا منير 🧠 اسألني أي شي عن دروسك أو مستقبلك المهني وأنا بساعدك!
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
                            ) : (
                              msg.content
                            )}
                          </div>
                        </div>
                      ))
                    )}
                    {isLoading && messages[messages.length - 1]?.role === "user" && (
                      <div className="flex justify-end">
                        <div className="bg-background/10 rounded-2xl px-4 py-3 border border-background/10">
                          <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Input */}
                  <form
                    className="relative"
                    onSubmit={(e) => {
                      e.preventDefault();
                      sendMessage(chatInput);
                    }}
                  >
                    <input
                      className="w-full p-5 pe-16 bg-background/10 rounded-2xl outline-none focus:ring-4 focus:ring-primary/50 text-background placeholder:text-background/30 transition-all text-base"
                      placeholder="اسأل منير أي شي عن دروسك أو مستقبلك..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      disabled={isLoading}
                    />
                    <button
                      type="submit"
                      disabled={isLoading || !chatInput.trim()}
                      className="absolute left-3 top-3 bg-primary text-primary-foreground p-3 rounded-2xl hover:scale-110 transition-transform disabled:opacity-50 disabled:hover:scale-100"
                    >
                      {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    </button>
                  </form>
                </div>
              </div>

              {/* Sidebar */}
              <div className="lg:col-span-4 space-y-8">
                {/* Focus Timer */}
                <div className="bg-card p-10 rounded-3xl shadow-lg border border-border flex flex-col items-center text-center">
                  <h3 className="text-lg font-bold text-muted-foreground mb-6 uppercase tracking-widest flex items-center gap-2">
                    <Zap className="w-4 h-4 text-orange-500" /> وضع التركيز العميق
                  </h3>
                  <div className="text-6xl font-black text-foreground mb-6 tracking-tighter">25:00</div>
                  <Button className="w-full py-6 h-auto rounded-2xl font-black text-lg bg-orange-500 hover:bg-orange-600 text-white">
                    ابدأ المذاكرة الآن
                  </Button>
                  <p className="mt-4 text-xs text-muted-foreground italic">"الدراسة بتركيز بتخلص بنص الوقت"</p>
                </div>

                {/* XP Card */}
                <div className="bg-gradient-to-br from-indigo-600 to-purple-800 p-10 rounded-3xl text-white shadow-2xl relative overflow-hidden">
                  <Rocket className="absolute -left-4 -bottom-4 w-32 h-32 opacity-10 -rotate-12" />
                  <h4 className="text-2xl font-black mb-4 tracking-tight flex items-center gap-2">
                    <Star className="text-yellow-400 w-6 h-6 fill-yellow-400" /> مستوى {profile.name}
                  </h4>
                  <div className="space-y-4">
                    <div className="flex justify-between text-xs font-bold opacity-80 uppercase tracking-widest">
                      <span>النابغة الصاعد</span>
                      <span>150 / 1000 XP</span>
                    </div>
                    <div className="w-full bg-white/20 h-3 rounded-full overflow-hidden border border-white/10">
                      <div className="w-[15%] h-full bg-yellow-400 rounded-full" />
                    </div>
                  </div>
                  <p className="mt-8 text-sm opacity-80 leading-relaxed italic">باقي ٥ مهام وبنفتح قسم "المختبر الافتراضي" الحارق!</p>
                </div>

                {/* Scanner */}
                <div className="bg-emerald-500 p-8 rounded-3xl text-white flex flex-col items-center gap-4 shadow-xl group cursor-pointer hover:bg-emerald-600 transition-all">
                  <Search className="w-12 h-12 group-hover:scale-125 transition-transform" />
                  <span className="font-black text-xl tracking-tight">الماسح النفاث للدروس</span>
                  <p className="text-xs text-center text-emerald-100">صور كتابك.. ومنير بيلخصه بثواني!</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
