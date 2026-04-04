import { useState, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Utensils, Apple, Scale, Activity, Calculator,
  Camera, Volume2, UserPlus, ArrowLeft, Heart,
  Salad, Beef, Egg
} from "lucide-react";
import { toast } from "sonner";

const speak = (text: string, lang: string) => {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === "ar" ? "ar-SA" : lang;
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  }
};

type Step = "reception" | "clinic";

export default function NutritionExpert() {
  const { t, lang } = useLanguage();
  const [step, setStep] = useState<Step>("reception");
  const [userData, setUserData] = useState({ name: "", weight: "", height: "", goal: "" });
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const bmi = userData.weight && userData.height
    ? (parseFloat(userData.weight) / ((parseFloat(userData.height) / 100) ** 2)).toFixed(1)
    : null;

  const calories = userData.weight
    ? Math.round(parseFloat(userData.weight) * 30)
    : null;

  const bmiCategory = useCallback((val: number) => {
    if (val < 18.5) return t("nutrition.underweight");
    if (val < 25) return t("nutrition.normal");
    if (val < 30) return t("nutrition.overweight");
    return t("nutrition.obese");
  }, [t]);

  const enterClinic = () => {
    if (!userData.name || !userData.weight || !userData.height || !userData.goal) {
      toast.error(t("nutrition.fillAll"));
      return;
    }
    speak(t("nutrition.welcomeVoice").replace("{name}", userData.name), lang);
    setStep("clinic");
  };

  const analyzePhoto = () => {
    setIsAnalyzing(true);
    setTimeout(() => {
      setIsAnalyzing(false);
      const msg = t("nutrition.analysisResult");
      speak(msg, lang);
      toast.success(msg);
    }, 3000);
  };

  return (
    <Layout>
      <div className="min-h-screen pb-20">
        {/* Header */}
        <header className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white shadow-2xl sticky top-0 z-40 rounded-b-[40px]">
          <div className="max-w-6xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/20 rounded-2xl">
                <Heart size={28} />
              </div>
              <h1 className="text-2xl font-black italic tracking-tighter">
                VISIONEX <span className="text-emerald-200 text-sm">HEALTH</span>
              </h1>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 rounded-2xl h-12 w-12"
              onClick={() => speak(t("nutrition.headerVoice"), lang)}
            >
              <Volume2 size={22} />
            </Button>
          </div>
        </header>

        <main className="max-w-6xl mx-auto p-4 md:p-10">
          {step === "reception" && (
            <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in zoom-in duration-700">
              {/* Welcome */}
              <div className="text-center space-y-4 py-8">
                <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full mx-auto flex items-center justify-center">
                  <UserPlus className="h-10 w-10 text-emerald-600" />
                </div>
                <h2 className="text-3xl font-black text-foreground">{t("nutrition.receptionTitle")}</h2>
                <p className="text-muted-foreground text-lg">{t("nutrition.receptionDesc")}</p>
              </div>

              <Card className="rounded-[30px] shadow-xl border-emerald-200 dark:border-emerald-800">
                <CardContent className="p-8 space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-black text-muted-foreground uppercase tracking-widest">
                        {t("nutrition.name")}
                      </label>
                      <Input
                        value={userData.name}
                        onChange={(e) => setUserData({ ...userData, name: e.target.value })}
                        placeholder={t("nutrition.namePlaceholder")}
                        className="bg-muted p-5 rounded-2xl font-bold text-lg h-auto"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-black text-muted-foreground uppercase tracking-widest">
                        {t("nutrition.goal")}
                      </label>
                      <Select
                        value={userData.goal}
                        onValueChange={(v) => setUserData({ ...userData, goal: v })}
                      >
                        <SelectTrigger className="bg-muted p-5 rounded-2xl font-bold text-lg h-auto">
                          <SelectValue placeholder={t("nutrition.selectGoal")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="weight-loss">{t("nutrition.goalWeightLoss")}</SelectItem>
                          <SelectItem value="muscle-gain">{t("nutrition.goalMuscle")}</SelectItem>
                          <SelectItem value="healthy-lifestyle">{t("nutrition.goalHealthy")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-black text-muted-foreground uppercase tracking-widest">
                        {t("nutrition.weight")}
                      </label>
                      <Input
                        type="number"
                        value={userData.weight}
                        onChange={(e) => setUserData({ ...userData, weight: e.target.value })}
                        placeholder="70"
                        className="bg-muted p-5 rounded-2xl font-bold text-lg h-auto"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-black text-muted-foreground uppercase tracking-widest">
                        {t("nutrition.height")}
                      </label>
                      <Input
                        type="number"
                        value={userData.height}
                        onChange={(e) => setUserData({ ...userData, height: e.target.value })}
                        placeholder="175"
                        className="bg-muted p-5 rounded-2xl font-bold text-lg h-auto"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={enterClinic}
                    className="w-full py-6 h-auto rounded-[25px] font-black text-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xl gap-3"
                  >
                    {t("nutrition.enterClinic")}
                    <Activity className="h-6 w-6" />
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {step === "clinic" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-10 duration-700">
              {/* Sidebar - Body stats */}
              <div className="lg:col-span-4 space-y-4">
                <Card className="rounded-[30px] shadow-xl">
                  <CardContent className="p-6 space-y-5">
                    <h3 className="text-xl font-black text-foreground">{t("nutrition.summary")}</h3>

                    <div className="space-y-4">
                      <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl">
                        <p className="text-xs font-black text-muted-foreground uppercase">{t("nutrition.bmiLabel")}</p>
                        <p className="text-2xl font-black text-emerald-600">
                          {bmi} <span className="text-sm font-bold text-muted-foreground">({bmi ? bmiCategory(parseFloat(bmi)) : ""})</span>
                        </p>
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl">
                        <p className="text-xs font-black text-muted-foreground uppercase">{t("nutrition.caloriesLabel")}</p>
                        <p className="text-2xl font-black text-blue-600">
                          {calories} <span className="text-sm font-bold text-muted-foreground">{t("nutrition.kcal")}</span>
                        </p>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      className="w-full rounded-2xl font-bold gap-2"
                      onClick={() => setStep("reception")}
                    >
                      <ArrowLeft className="h-4 w-4" />
                      {t("nutrition.editData")}
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Main - Diet plan + photo analysis */}
              <div className="lg:col-span-8 space-y-6">
                {/* Diet plan */}
                <Card className="rounded-[30px] shadow-xl overflow-hidden">
                  <div className="h-2 bg-gradient-to-r from-emerald-500 to-teal-500" />
                  <CardContent className="p-8 space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center">
                        <Utensils className="h-7 w-7 text-emerald-600" />
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-foreground">{t("nutrition.dietPlan")}</h3>
                        <p className="text-muted-foreground text-sm">
                          {t("nutrition.dietIntro").replace("{name}", userData.name).replace("{goal}", t(`nutrition.goal${userData.goal === "weight-loss" ? "WeightLoss" : userData.goal === "muscle-gain" ? "Muscle" : "Healthy"}`))}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {[
                        { icon: Egg, meal: t("nutrition.breakfast"), desc: t("nutrition.breakfastDesc"), color: "text-orange-500 bg-orange-50 dark:bg-orange-900/20" },
                        { icon: Beef, meal: t("nutrition.lunch"), desc: t("nutrition.lunchDesc"), color: "text-red-500 bg-red-50 dark:bg-red-900/20" },
                        { icon: Salad, meal: t("nutrition.dinner"), desc: t("nutrition.dinnerDesc"), color: "text-green-500 bg-green-50 dark:bg-green-900/20" },
                        { icon: Apple, meal: t("nutrition.snack"), desc: t("nutrition.snackDesc"), color: "text-purple-500 bg-purple-50 dark:bg-purple-900/20" },
                      ].map((item) => (
                        <div key={item.meal} className={`p-4 rounded-2xl ${item.color.split(" ").slice(1).join(" ")}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <item.icon className={`h-5 w-5 ${item.color.split(" ")[0]}`} />
                            <span className="font-black text-foreground">{item.meal}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">{item.desc}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Photo analysis */}
                <Card className="rounded-[30px] shadow-xl border-dashed border-2 border-emerald-300 dark:border-emerald-700">
                  <CardContent className="p-8 text-center space-y-4">
                    <Camera className="h-12 w-12 text-emerald-500 mx-auto" />
                    <h3 className="text-xl font-black text-foreground">{t("nutrition.photoTitle")}</h3>
                    <p className="text-muted-foreground">{t("nutrition.photoDesc")}</p>
                    <Button
                      onClick={analyzePhoto}
                      disabled={isAnalyzing}
                      className="rounded-2xl font-black py-5 h-auto px-8 bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                    >
                      <Camera className="h-5 w-5" />
                      {isAnalyzing ? t("nutrition.analyzing") : t("nutrition.uploadPhoto")}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </main>
      </div>
    </Layout>
  );
}
