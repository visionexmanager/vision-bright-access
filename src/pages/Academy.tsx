import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  User, Globe, GraduationCap, Sparkles, ArrowRight, Compass,
  Briefcase, Rocket, Star, MessageSquare, BrainCircuit,
  Target, Zap, Lightbulb, Volume2, LayoutDashboard, Search
} from "lucide-react";

const speak = (text: string) => {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ar-SA";
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }
};

const countries = ["لبنان", "مصر", "السعودية", "تركيا", "أمريكا", "بلد آخر"];
const levels = ["ابتدائي", "متوسط", "ثانوي / بكالوريا", "جامعي / دراسات"];

export default function Academy() {
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState({
    name: "",
    gender: "male" as "male" | "female",
    country: "",
    level: "",
  });

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
                {/* Career Guidance */}
                <div className="bg-card p-8 rounded-3xl border border-border shadow-lg">
                  <div className="flex items-center gap-4 mb-10 border-b border-border pb-6">
                    <div className="p-4 bg-orange-500/10 text-orange-500 rounded-2xl"><Compass /></div>
                    <h2 className="text-2xl font-black text-foreground tracking-tight">بوصلة المستقبل لـ {profile.name}</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-8 bg-muted/50 rounded-3xl border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-all cursor-pointer group">
                      <BrainCircuit className="w-12 h-12 text-primary mb-6 group-hover:scale-110 transition-transform" />
                      <h4 className="font-bold text-xl mb-3 text-foreground">اختبار الميول لعام 2026</h4>
                      <p className="text-muted-foreground text-sm leading-relaxed">منير رح يحلل شخصيتك بمصلحة {profile.country} ليقلك شو هي المهنة اللي رح تعملك "غول" بمجالك.</p>
                    </div>
                    <div className="p-8 bg-muted/50 rounded-3xl border-2 border-dashed border-border hover:border-orange-500 hover:bg-orange-500/5 transition-all cursor-pointer group">
                      <Briefcase className="w-12 h-12 text-orange-500 mb-6 group-hover:scale-110 transition-transform" />
                      <h4 className="font-bold text-xl mb-3 text-foreground">سوق العمل العالمي</h4>
                      <p className="text-muted-foreground text-sm leading-relaxed">اكتشف شو هي الرواتب والوظائف المطلوبة بـ {profile.country} وبالعالم لهيدي السنة.</p>
                    </div>
                  </div>
                </div>

                {/* Smart Assistant Chat */}
                <div className="bg-foreground rounded-3xl p-10 text-background relative shadow-2xl overflow-hidden">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center shadow-lg"><Lightbulb className="w-8 h-8" /></div>
                    <div>
                      <h3 className="text-2xl font-black">مساعد {profile.level} الذكي</h3>
                      <p className="text-primary text-xs font-bold uppercase tracking-widest">توجيه أكاديمي متفجر</p>
                    </div>
                  </div>
                  <div className="bg-background/5 backdrop-blur-xl p-8 rounded-3xl border border-background/10 mb-8 min-h-[150px]">
                    <p className="text-xl leading-relaxed font-medium">
                      يا {profile.name}، أنا حللت منهاج {profile.level} ببلدك {profile.country}.. شو رأيك نبلش نلخص الدروس الصعبة ولا حابب نعمل جدول دراسي بيضمنلك التفوق؟
                    </p>
                  </div>
                  <div className="relative">
                    <input
                      className="w-full p-6 bg-background/10 rounded-2xl outline-none focus:ring-4 focus:ring-primary/50 text-background placeholder:text-background/30 transition-all"
                      placeholder="اسأل منير أي شي عن دروسك أو مستقبلك..."
                    />
                    <button className="absolute left-3 top-3 bg-primary text-primary-foreground p-3 rounded-2xl hover:scale-110 transition-transform">
                      <MessageSquare />
                    </button>
                  </div>
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
