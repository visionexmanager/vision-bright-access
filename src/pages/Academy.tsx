import { useState, useRef, useEffect, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import CareerAptitudeTest from "@/components/CareerAptitudeTest";
import PomodoroTimer from "@/components/PomodoroTimer";
import {
  User, Globe, GraduationCap, ArrowRight, Compass,
  Briefcase, Rocket, Star, MessageSquare, BrainCircuit,
  Zap, Lightbulb, Volume2, LayoutDashboard, Search,
  Loader2, Send, Trash2, Phone
} from "lucide-react";
import { VoiceChat } from "@/components/VoiceChat";
import { WatchAdButton } from "@/components/WatchAdButton";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/academy-chat`;

const speak = (text: string, lang: string) => {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const langMap: Record<string, string> = {
      ar: "ar-SA", en: "en-US", es: "es-ES", de: "de-DE",
      fr: "fr-FR", pt: "pt-BR", zh: "zh-CN", tr: "tr-TR",
      ru: "ru-RU", hi: "hi-IN", ur: "ur-PK",
    };
    utterance.lang = langMap[lang] ?? "en-US";
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

export default function Academy() {
  const { t, lang } = useLanguage();

  const COUNTRIES = [
    { key: "academy.country.lb", value: "Lebanon" },
    { key: "academy.country.eg", value: "Egypt" },
    { key: "academy.country.sa", value: "Saudi Arabia" },
    { key: "academy.country.tr", value: "Turkey" },
    { key: "academy.country.us", value: "United States" },
    { key: "academy.country.other", value: "Other" },
  ];

  const LEVELS = [
    { key: "academy.level.primary", value: "Primary" },
    { key: "academy.level.middle",  value: "Middle School" },
    { key: "academy.level.high",    value: "High School" },
    { key: "academy.level.uni",     value: "University" },
  ];

  const [step, setStep] = useState(1);
  const [voiceMode, setVoiceMode] = useState(false);
  const [profile, setProfile] = useState<StudentProfile>({
    name: "",
    gender: "male",
    country: "",
    level: "",
  });

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
      const { data: { session } } = await supabase.auth.getSession();
      const bearerToken = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${bearerToken}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ messages: apiMessages, studentProfile: profile }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Error (${resp.status})`);
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
    } catch (e: any) {
      if (e.name === "AbortError") return;
      setMessages(prev => [...prev, { id: assistantId, role: "assistant", content: `⚠️ ${e.message || t("academy.error")}` }]);
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }, [messages, profile, isLoading, t]);

  const clearChat = () => {
    abortRef.current?.abort();
    setMessages([]);
    setIsLoading(false);
  };

  const handleNext = () => {
    if (step === 1) {
      const greet = profile.gender === "male"
        ? t("academy.welcome.male").replace("{name}", profile.name)
        : t("academy.welcome.female").replace("{name}", profile.name);
      speak(greet, lang);
    }
    if (step === 3) {
      const msg = t("academy.curriculum").replace("{country}", profile.country) + " " + t("academy.next");
      speak(msg, lang);
    }
    setStep(step + 1);
  };

  const isNextDisabled =
    (step === 1 && !profile.name) ||
    (step === 2 && !profile.country) ||
    (step === 3 && !profile.level);

  const displayName = profile.gender === "male"
    ? t("academy.welcome.male").replace("{name}", profile.name)
    : t("academy.welcome.female").replace("{name}", profile.name);

  return (
    <Layout>
      <div className="font-sans overflow-x-hidden text-start">
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
                  <h2 className="text-3xl md:text-4xl font-black text-foreground tracking-tight">{t("academy.step1.title")}</h2>
                  <Input
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    className="text-center text-xl md:text-2xl py-6 rounded-2xl"
                    placeholder={t("academy.name.placeholder")}
                  />
                  <div className="flex gap-4 justify-center">
                    <Button
                      variant={profile.gender === "male" ? "default" : "outline"}
                      className="flex-1 py-6 text-lg font-bold rounded-2xl"
                      onClick={() => setProfile({ ...profile, gender: "male" })}
                    >
                      {t("academy.gender.male")}
                    </Button>
                    <Button
                      variant={profile.gender === "female" ? "default" : "outline"}
                      className={`flex-1 py-6 text-lg font-bold rounded-2xl ${profile.gender === "female" ? "bg-pink-500 hover:bg-pink-600 border-pink-500" : ""}`}
                      onClick={() => setProfile({ ...profile, gender: "female" })}
                    >
                      {t("academy.gender.female")}
                    </Button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-8 animate-in fade-in duration-500">
                  <Globe className="w-20 h-20 mx-auto text-emerald-500 animate-pulse" />
                  <h2 className="text-3xl md:text-4xl font-black text-foreground">{t("academy.step2.title")}</h2>
                  <div className="grid grid-cols-2 gap-4">
                    {COUNTRIES.map((c) => {
                      const label = t(c.key);
                      return (
                        <Button
                          key={c.key}
                          variant={profile.country === label ? "default" : "outline"}
                          className="p-4 h-auto rounded-2xl font-bold text-base"
                          onClick={() => setProfile({ ...profile, country: label })}
                        >
                          {label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-8 animate-in zoom-in-95 duration-500">
                  <GraduationCap className="w-20 h-20 mx-auto text-orange-500" />
                  <h2 className="text-3xl md:text-4xl font-black text-foreground">{t("academy.step3.title")}</h2>
                  <div className="grid grid-cols-1 gap-3">
                    {LEVELS.map((l) => {
                      const label = t(l.key);
                      return (
                        <Button
                          key={l.key}
                          variant={profile.level === label ? "default" : "outline"}
                          className="p-5 h-auto rounded-2xl text-start flex justify-between items-center text-lg"
                          onClick={() => setProfile({ ...profile, level: label })}
                        >
                          <span className="font-bold">{label}</span>
                          {profile.level === label && <Star className="fill-yellow-400 text-yellow-400 w-5 h-5" />}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}

              <Button
                onClick={handleNext}
                disabled={isNextDisabled}
                size="lg"
                className="mt-12 w-full py-6 rounded-2xl font-black text-xl"
              >
                {t("academy.next")} <ArrowRight className="w-6 h-6 rotate-180 ms-2" />
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
                  <h1 className="text-2xl md:text-3xl font-black text-foreground">{displayName}</h1>
                  <div className="flex gap-3 mt-2">
                    <span className="px-3 py-1 bg-primary/10 text-primary rounded-lg text-xs font-bold border border-primary/20">{profile.level}</span>
                    <span className="px-3 py-1 bg-emerald-500/10 text-emerald-600 rounded-lg text-xs font-bold border border-emerald-500/20">
                      {t("academy.curriculum").replace("{country}", profile.country)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-14 w-14 rounded-2xl"
                  onClick={() => speak(displayName, lang)}
                >
                  <Volume2 className="w-6 h-6" />
                </Button>
                <Button
                  variant={voiceMode ? "default" : "outline"}
                  className="px-6 py-4 h-auto rounded-2xl font-bold"
                  onClick={() => setVoiceMode(v => !v)}
                >
                  <Phone className="w-5 h-5 me-2" />
                  {voiceMode ? t("academy.voice.text") : t("academy.voice.call")}
                </Button>
                <Button className="px-8 py-4 h-auto rounded-2xl font-bold">
                  <LayoutDashboard className="w-5 h-5 me-2" /> {t("academy.my.classroom")}
                </Button>
              </div>
            </header>

            {/* Voice mode panel */}
            {voiceMode && (
              <div className="mb-6">
                <VoiceChat
                  assistant="munir"
                  assistantName={t("academy.assistant.name")}
                  className="max-w-lg mx-auto"
                />
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Main Content */}
              <div className="lg:col-span-8 space-y-8">
                {showAptitudeTest ? (
                  <CareerAptitudeTest profile={profile} onClose={() => setShowAptitudeTest(false)} />
                ) : (
                  <div className="bg-card p-8 rounded-3xl border border-border shadow-lg">
                    <div className="flex items-center gap-4 mb-10 border-b border-border pb-6">
                      <div className="p-4 bg-orange-500/10 text-orange-500 rounded-2xl"><Compass /></div>
                      <h2 className="text-2xl font-black text-foreground tracking-tight">
                        {t("academy.compass.title").replace("{name}", profile.name)}
                      </h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div
                        className="p-8 bg-muted/50 rounded-3xl border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-all cursor-pointer group"
                        onClick={() => setShowAptitudeTest(true)}
                      >
                        <BrainCircuit className="w-12 h-12 text-primary mb-6 group-hover:scale-110 transition-transform" />
                        <h4 className="font-bold text-xl mb-3 text-foreground">{t("academy.aptitude.title")}</h4>
                        <p className="text-muted-foreground text-sm leading-relaxed">{t("academy.aptitude.desc")}</p>
                      </div>
                      <div
                        className="p-8 bg-muted/50 rounded-3xl border-2 border-dashed border-border hover:border-orange-500 hover:bg-orange-500/5 transition-all cursor-pointer group"
                        onClick={() => sendMessage(t("academy.jobs.desc").replace("{country}", profile.country))}
                      >
                        <Briefcase className="w-12 h-12 text-orange-500 mb-6 group-hover:scale-110 transition-transform" />
                        <h4 className="font-bold text-xl mb-3 text-foreground">{t("academy.jobs.title")}</h4>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                          {t("academy.jobs.desc").replace("{country}", profile.country)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <WatchAdButton variant="banner" className="my-6" />

                {/* Smart Assistant Chat */}
                <div className="bg-foreground rounded-3xl p-6 md:p-10 text-background relative shadow-2xl overflow-hidden">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center shadow-lg">
                        <Lightbulb className="w-8 h-8" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-black">
                          {t("academy.munir.level").replace("{level}", profile.level)}
                        </h3>
                        <p className="text-primary text-xs font-bold uppercase tracking-widest">
                          {isLoading ? t("academy.chat.thinking") : t("academy.chat.guidance")}
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
                        {t("academy.chat.intro").replace("{name}", profile.name)}
                      </p>
                    ) : (
                      messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-start" : "justify-end"}`}>
                          <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm md:text-base ${
                            msg.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-background/10 text-background border border-background/10"
                          }`}>
                            {msg.role === "assistant" ? (
                              <div className="prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                              </div>
                            ) : msg.content}
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
                  <form className="relative" onSubmit={(e) => { e.preventDefault(); sendMessage(chatInput); }}>
                    <input
                      className="w-full p-5 pe-16 bg-background/10 rounded-2xl outline-none focus:ring-4 focus:ring-primary/50 text-background placeholder:text-background/30 transition-all text-base"
                      placeholder={t("academy.chat.placeholder")}
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
                <PomodoroTimer />

                {/* XP Card */}
                <div className="bg-gradient-to-br from-indigo-600 to-purple-800 p-10 rounded-3xl text-white shadow-2xl relative overflow-hidden">
                  <Rocket className="absolute -left-4 -bottom-4 w-32 h-32 opacity-10 -rotate-12" />
                  <h4 className="text-2xl font-black mb-4 tracking-tight flex items-center gap-2">
                    <Star className="text-yellow-400 w-6 h-6 fill-yellow-400" />
                    {t("academy.xp.level").replace("{name}", profile.name)}
                  </h4>
                  <div className="space-y-4">
                    <div className="flex justify-between text-xs font-bold opacity-80 uppercase tracking-widest">
                      <span>{t("academy.xp.rising")}</span>
                      <span>150 / 1000 XP</span>
                    </div>
                    <div className="w-full bg-white/20 h-3 rounded-full overflow-hidden border border-white/10">
                      <div className="w-[15%] h-full bg-yellow-400 rounded-full" />
                    </div>
                  </div>
                </div>

                {/* Scanner */}
                <div className="bg-emerald-500 p-8 rounded-3xl text-white flex flex-col items-center gap-4 shadow-xl group cursor-pointer hover:bg-emerald-600 transition-all">
                  <Search className="w-12 h-12 group-hover:scale-125 transition-transform" />
                  <span className="font-black text-xl tracking-tight">{t("academy.quick.title")}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
