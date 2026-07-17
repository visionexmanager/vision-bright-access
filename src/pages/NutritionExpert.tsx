import { useState, useCallback, useRef, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
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
  Salad, Beef, Egg, Loader2, Star, Plus, Trash2,
  BookOpen, Flame, Sparkles, Download, Save, FolderOpen, Clock, X, Phone
} from "lucide-react";
import { VoiceChat } from "@/components/VoiceChat";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import WeeklyCalorieReport from "@/components/WeeklyCalorieReport";
import MealReminders from "@/components/MealReminders";
import { speakText } from "@/lib/audio/speech";
import type { Json } from "@/integrations/supabase/types";

const speak = (text: string, lang: string) => {
  speakText(text, lang, { rate: 0.9 });
};

type Step = "reception" | "clinic";

interface MealAnalysis {
  name: string;
  calories: number;
  ingredients: string[];
  tip: string;
  rating: number;
}

interface MealLog {
  id: string;
  meal_name: string;
  calories: number;
  meal_type: string;
  rating: number;
  logged_at: string;
}

interface DietMeal {
  name: string;
  time: string;
  calories: number;
  ingredients: string[];
  description: string;
}

interface DietPlan {
  meals: DietMeal[];
  totalCalories: number;
  tips: string[];
  waterIntake: string;
}

export default function NutritionExpert() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("reception");
  const [voiceMode, setVoiceMode] = useState(false);
  const [userData, setUserData] = useState({ name: "", weight: "", height: "", goal: "" });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [mealResult, setMealResult] = useState<MealAnalysis | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mealLogs, setMealLogs] = useState<MealLog[]>([]);
  const [savingLog, setSavingLog] = useState(false);
  const [manualMeal, setManualMeal] = useState({ name: "", calories: "", type: "other" });
  const [dietPlan, setDietPlan] = useState<DietPlan | null>(null);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [savedPlans, setSavedPlans] = useState<Array<{ id: string; plan_name: string; plan: DietPlan; created_at: string }>>([]);
  const [savingPlan, setSavingPlan] = useState(false);
  const [showSavedPlans, setShowSavedPlans] = useState(false);

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

  const generateDietPlan = async () => {
    setGeneratingPlan(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-diet-plan", {
        body: { name: userData.name, weight: userData.weight, height: userData.height, goal: userData.goal, lang },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      setDietPlan(data.plan as DietPlan);
      toast.success(t("nutrition.planGenerated"));
    } catch (err) {
      console.error("Diet plan error:", err);
      toast.error(t("nutrition.analysisError"));
    } finally {
      setGeneratingPlan(false);
    }
  };

  const saveDietPlan = async () => {
    if (!user || !dietPlan) { toast.error(t("nutrition.loginToSave")); return; }
    setSavingPlan(true);
    try {
      const planName = `${userData.goal} - ${new Date().toLocaleDateString()}`;
      const { error } = await supabase.from("diet_plans").insert({
        user_id: user.id,
        plan_name: planName,
        user_data: userData as unknown as Json,
        plan: dietPlan as unknown as Json,
        calorie_goal: calories || 0,
      });
      if (error) throw error;
      toast.success(t("nutrition.planSaved"));
      fetchSavedPlans();
    } catch (err) {
      console.error("Save plan error:", err);
      toast.error(t("nutrition.analysisError"));
    } finally {
      setSavingPlan(false);
    }
  };

  const fetchSavedPlans = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("diet_plans")
      .select("id, plan_name, plan, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);
    if (data) {
      setSavedPlans(data.map(d => ({ ...d, plan: d.plan as unknown as DietPlan })));
    }
  }, [user]);

  const loadDietPlan = (plan: DietPlan) => {
    setDietPlan(plan);
    setShowSavedPlans(false);
    toast.success(t("nutrition.planLoaded"));
  };

  const deleteSavedPlan = async (id: string) => {
    await supabase.from("diet_plans").delete().eq("id", id);
    toast.success(t("nutrition.planDeleted"));
    fetchSavedPlans();
  };

  useEffect(() => { if (user && step === "clinic") fetchSavedPlans(); }, [user, step, fetchSavedPlans]);

  const enterClinic = () => {
    if (!userData.name || !userData.weight || !userData.height || !userData.goal) {
      toast.error(t("nutrition.fillAll"));
      return;
    }
    speak(t("nutrition.welcomeVoice").replace("{name}", userData.name), lang);
    setStep("clinic");
    setDietPlan(null);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith("image/")) {
      toast.error(t("nutrition.invalidImage"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("nutrition.imageTooLarge"));
      return;
    }

    // Show preview
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setMealResult(null);

    // Convert to base64
    setIsAnalyzing(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke("analyze-meal", {
        body: { image: base64, lang },
      });

      if (error) {
        console.error("Edge function error:", error);
        toast.error(t("nutrition.analysisError"));
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      const analysis = data.analysis as MealAnalysis;
      setMealResult(analysis);
      const msg = `${analysis.name} — ${analysis.calories} ${t("nutrition.kcal")}`;
      speak(msg, lang);
      toast.success(msg);
    } catch (err) {
      console.error("Analysis failed:", err);
      toast.error(t("nutrition.analysisError"));
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Fetch today's meal logs
  const fetchMealLogs = useCallback(async () => {
    if (!user) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from("meal_logs")
      .select("id, meal_name, calories, meal_type, rating, logged_at")
      .eq("user_id", user.id)
      .gte("logged_at", today.toISOString())
      .order("logged_at", { ascending: false });
    if (data) setMealLogs(data as MealLog[]);
  }, [user]);

  useEffect(() => {
    if (step === "clinic") fetchMealLogs();
  }, [step, fetchMealLogs]);

  const totalCalories = mealLogs.reduce((sum, m) => sum + m.calories, 0);
  const calorieGoal = calories || 2000;
  const calorieProgress = Math.min((totalCalories / calorieGoal) * 100, 100);

  const saveAnalysisToLog = async () => {
    if (!user || !mealResult) return;
    setSavingLog(true);
    try {
      const { error } = await supabase.from("meal_logs").insert({
        user_id: user.id,
        meal_name: mealResult.name,
        calories: mealResult.calories,
        ingredients: mealResult.ingredients,
        rating: mealResult.rating,
        meal_type: "analyzed",
      });
      if (error) throw error;
      toast.success(t("nutrition.mealSaved"));
      fetchMealLogs();
    } catch { toast.error(t("nutrition.analysisError")); }
    finally { setSavingLog(false); }
  };

  const addManualMeal = async () => {
    if (!user || !manualMeal.name || !manualMeal.calories) {
      toast.error(t("nutrition.fillAll"));
      return;
    }
    setSavingLog(true);
    try {
      const { error } = await supabase.from("meal_logs").insert({
        user_id: user.id,
        meal_name: manualMeal.name,
        calories: parseInt(manualMeal.calories),
        meal_type: manualMeal.type,
        ingredients: [],
        rating: 5,
      });
      if (error) throw error;
      toast.success(t("nutrition.mealSaved"));
      setManualMeal({ name: "", calories: "", type: "other" });
      fetchMealLogs();
    } catch { toast.error(t("nutrition.analysisError")); }
    finally { setSavingLog(false); }
  };

  const deleteMealLog = async (id: string) => {
    await supabase.from("meal_logs").delete().eq("id", id);
    fetchMealLogs();
  };

  const exportPlanAsPdf = async () => {
    if (!dietPlan) return;
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    const isAr = lang === "ar";
    const margin = 20;
    let y = 20;

    // Title
    doc.setFontSize(22);
    doc.setTextColor(16, 185, 129);
    doc.text("Visionex Health - Diet Plan", margin, y);
    y += 12;

    // User info
    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    doc.text(`${t("nutrition.name")}: ${userData.name}  |  BMI: ${bmi}  |  ${t("nutrition.caloriesLabel")}: ${calories} kcal`, margin, y);
    y += 8;
    doc.text(`${t("nutrition.goalLabel") || "Goal"}: ${userData.goal}  |  ${t("nutrition.weightLabel") || "Weight"}: ${userData.weight} kg  |  ${t("nutrition.heightLabel") || "Height"}: ${userData.height} cm`, margin, y);
    y += 12;

    // Divider
    doc.setDrawColor(16, 185, 129);
    doc.setLineWidth(0.5);
    doc.line(margin, y, 190, y);
    y += 10;

    // Total calories & water
    doc.setFontSize(12);
    doc.setTextColor(40, 40, 40);
    doc.text(`${t("nutrition.totalCalories")}: ${dietPlan.totalCalories} kcal`, margin, y);
    doc.text(`Water: ${dietPlan.waterIntake}`, 120, y);
    y += 12;

    // Meals
    dietPlan.meals.forEach((meal, i) => {
      if (y > 260) { doc.addPage(); y = 20; }

      // Meal header bar
      doc.setFillColor(240, 253, 244);
      doc.roundedRect(margin, y - 5, 170, 8, 2, 2, "F");
      doc.setFontSize(12);
      doc.setTextColor(16, 185, 129);
      doc.text(`${i + 1}. ${meal.name}`, margin + 3, y);
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`${meal.time}  |  ${meal.calories} kcal`, 140, y);
      y += 10;

      // Description
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      const descLines = doc.splitTextToSize(meal.description, 165);
      doc.text(descLines, margin + 3, y);
      y += descLines.length * 5 + 2;

      // Ingredients
      doc.setFontSize(9);
      doc.setTextColor(130, 130, 130);
      const ingText = meal.ingredients.join(" - ");
      const ingLines = doc.splitTextToSize(ingText, 165);
      doc.text(ingLines, margin + 3, y);
      y += ingLines.length * 4 + 8;
    });

    // Tips
    if (dietPlan.tips.length > 0) {
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFillColor(255, 251, 235);
      doc.roundedRect(margin, y - 5, 170, 8, 2, 2, "F");
      doc.setFontSize(11);
      doc.setTextColor(180, 130, 0);
      doc.text(t("nutrition.healthTip"), margin + 3, y);
      y += 10;

      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      dietPlan.tips.forEach((tip) => {
        if (y > 275) { doc.addPage(); y = 20; }
        const tipLines = doc.splitTextToSize(`• ${tip}`, 165);
        doc.text(tipLines, margin + 3, y);
        y += tipLines.length * 5 + 3;
      });
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(180, 180, 180);
    doc.text(`Generated by Visionex Health - ${new Date().toLocaleDateString()}`, margin, 285);

    doc.save(`diet-plan-${userData.name || "user"}.pdf`);
    toast.success(t("nutrition.pdfExported"));
  };

  return (
    <Layout>
      <div className="min-h-screen pb-20">
        {/* Header */}
        <header className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white shadow-2xl sticky top-0 z-40 rounded-b-[40px]">
          <div className="section-container flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/20 rounded-2xl">
                <Heart size={28} aria-hidden="true" />
              </div>
              <h1 id="nutrition-heading" className="text-2xl font-black italic tracking-tighter">
                VISIONEX <span className="text-emerald-200 text-sm">HEALTH</span>
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20 rounded-2xl h-12 w-12"
                onClick={() => speak(t("nutrition.headerVoice"), lang)}
                aria-label={t("nutrition.headerVoice")}
              >
                <Volume2 size={22} aria-hidden="true" />
              </Button>
              {step === "clinic" && (
                <Button
                  variant={voiceMode ? "default" : "ghost"}
                  size="icon"
                  className={voiceMode ? "rounded-2xl h-12 w-12" : "text-white hover:bg-white/20 rounded-2xl h-12 w-12"}
                  onClick={() => setVoiceMode(v => !v)}
                  title="Voice Chat"
                  aria-label="Voice Chat"
                  aria-pressed={voiceMode}
                >
                  <Phone size={22} aria-hidden="true" />
                </Button>
              )}
            </div>
          </div>
        </header>

        <section className="section-container p-4 md:p-10" aria-labelledby="nutrition-heading">
          {step === "reception" && (
            <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in zoom-in duration-700">
              {/* Welcome */}
              <div className="text-center space-y-4 py-8">
                <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full mx-auto flex items-center justify-center">
                  <UserPlus className="h-10 w-10 text-emerald-600" aria-hidden="true" />
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
              {voiceMode && (
                <div className="lg:col-span-12">
                  <VoiceChat
                    assistant="nutrition"
                    assistantName="Visionex Health AI"
                    className="max-w-2xl mx-auto"
                  />
                </div>
              )}
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

                {/* Daily calorie tracker */}
                <Card className="rounded-[30px] shadow-xl">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <Flame className="h-5 w-5 text-orange-500" />
                      <h3 className="text-lg font-black text-foreground">{t("nutrition.dailyLog")}</h3>
                    </div>

                    {/* Circular progress ring */}
                    <div className="flex items-center gap-4">
                      {(() => {
                        const r = 38;
                        const circ = 2 * Math.PI * r;
                        const pct = Math.min(calorieProgress, 100);
                        const dash = (pct / 100) * circ;
                        const color = pct >= 100 ? "#ef4444" : pct >= 75 ? "#f97316" : "#10b981";
                        return (
                          <svg width="96" height="96" viewBox="0 0 96 96" className="shrink-0 -rotate-90">
                            <circle cx="48" cy="48" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
                            <circle cx="48" cy="48" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
                              strokeDasharray={`${dash} ${circ}`} style={{ transition: "stroke-dasharray 0.6s ease" }} />
                          </svg>
                        );
                      })()}
                      <div>
                        <p className="text-2xl font-black text-foreground">{totalCalories}</p>
                        <p className="text-xs text-muted-foreground">{t("nutrition.ofLabel")} {calorieGoal} {t("nutrition.kcal")}</p>
                        <p className="text-sm font-bold mt-1" style={{ color: calorieProgress >= 100 ? "#ef4444" : "#10b981" }}>
                          {calorieProgress >= 100 ? t("nutrition.exceededGoal") : t("nutrition.caloriesLeft").replace("{n}", (calorieGoal - totalCalories).toString())}
                        </p>
                      </div>
                    </div>

                    {/* Suggest next meal */}
                    {calorieGoal - totalCalories > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full rounded-xl gap-2 text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                        onClick={() => {
                          const remaining = calorieGoal - totalCalories;
                          const goal = userData.goal === "weight-loss" ? "خسارة الوزن" : userData.goal === "muscle-gain" ? "بناء العضلات" : "الصحة العامة";
                          toast.info(t("nutrition.generatingSuggestion"));
                          supabase.functions.invoke("generate-diet-plan", {
                            body: {
                              name: userData.name,
                              weight: userData.weight,
                              height: userData.height,
                              goal: userData.goal,
                              lang,
                              prompt: `اقترح وجبة واحدة صحية بحوالي ${remaining} سعرة حرارية لشخص هدفه ${goal}. أجب باختصار بالاسم والمكونات الرئيسية فقط.`,
                            },
                          }).then(({ data }) => {
                            if (data?.plan?.meals?.[0]) {
                              const m = data.plan.meals[0];
                              toast.success(t("nutrition.mealSuggestion").replace("{name}", m.name).replace("{cal}", String(m.calories)), { duration: 6000 });
                            }
                          });
                        }}
                      >
                        <Sparkles className="h-4 w-4" />
                        {t("nutrition.suggestMeal")} ({calorieGoal - totalCalories} {t("nutrition.kcal")})
                      </Button>
                    )}
                  </CardContent>
                </Card>

                <Card className="rounded-[30px] shadow-xl">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <Plus className="h-5 w-5 text-emerald-600" />
                      <h3 className="text-lg font-black text-foreground">{t("nutrition.logMeal")}</h3>
                    </div>

                    {/* Quick add */}
                    {user && (
                      <div className="space-y-2 pt-2 border-t">
                        <Input
                          value={manualMeal.name}
                          onChange={(e) => setManualMeal({ ...manualMeal, name: e.target.value })}
                          placeholder={t("nutrition.mealNamePlaceholder")}
                          className="rounded-xl text-sm h-9"
                        />
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            value={manualMeal.calories}
                            onChange={(e) => setManualMeal({ ...manualMeal, calories: e.target.value })}
                            placeholder={t("nutrition.kcal")}
                            className="rounded-xl text-sm h-9 w-24"
                          />
                          <Button
                            size="sm"
                            onClick={addManualMeal}
                            disabled={savingLog}
                            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white gap-1 flex-1"
                          >
                            <Plus className="h-4 w-4" /> {t("nutrition.addMeal")}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Log list */}
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {mealLogs.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-2">{t("nutrition.noMealsYet")}</p>
                      )}
                      {mealLogs.map((log) => (
                        <div key={log.id} className="flex items-center justify-between bg-muted/50 p-2 rounded-xl text-sm">
                          <div>
                            <p className="font-bold text-foreground">{log.meal_name}</p>
                            <p className="text-xs text-muted-foreground">{log.calories} {t("nutrition.kcal")}</p>
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMealLog(log.id)} aria-label={t("admin.common.delete")}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Main - Diet plan + photo analysis */}
              <div className="lg:col-span-8 space-y-6">
                {/* AI Diet plan */}
                <Card className="rounded-[30px] shadow-xl overflow-hidden">
                  <div className="h-2 bg-gradient-to-r from-emerald-500 to-teal-500" />
                  <CardContent className="p-8 space-y-6">
                    <div className="flex items-center justify-between">
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
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={generateDietPlan}
                          disabled={generatingPlan}
                          size="sm"
                          className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                        >
                          {generatingPlan ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                          {generatingPlan ? t("nutrition.generating") : t("nutrition.generatePlan")}
                        </Button>
                        {dietPlan && (
                          <>
                            <Button
                              onClick={() => void exportPlanAsPdf()}
                              size="sm"
                              variant="outline"
                              className="rounded-xl gap-1"
                            >
                              <Download className="h-4 w-4" />
                              PDF
                            </Button>
                            {user && (
                              <Button
                                onClick={saveDietPlan}
                                disabled={savingPlan}
                                size="sm"
                                variant="outline"
                                className="rounded-xl gap-1"
                              >
                                {savingPlan ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                {t("nutrition.savePlan")}
                              </Button>
                            )}
                          </>
                        )}
                        {user && (
                          <Button
                            onClick={() => setShowSavedPlans(!showSavedPlans)}
                            size="sm"
                            variant="ghost"
                            className="rounded-xl gap-1"
                          >
                            <FolderOpen className="h-4 w-4" />
                            {t("nutrition.myPlans")}
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Saved plans drawer */}
                    {showSavedPlans && (
                      <div className="bg-muted/50 p-4 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-black text-foreground text-sm">{t("nutrition.savedPlans")}</h4>
                          <Button size="sm" variant="ghost" onClick={() => setShowSavedPlans(false)}>
                            <X className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </div>
                        {savedPlans.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">{t("nutrition.noSavedPlans")}</p>
                        ) : (
                          savedPlans.map((sp) => (
                            <div key={sp.id} className="flex items-center justify-between bg-background p-3 rounded-xl">
                              <button type="button" onClick={() => loadDietPlan(sp.plan)} className="flex items-center gap-3 text-start flex-1">
                                <Clock className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                                <div>
                                  <p className="text-sm font-bold text-foreground">{sp.plan_name}</p>
                                  <p className="text-xs text-muted-foreground">{new Date(sp.created_at).toLocaleDateString()}</p>
                                </div>
                              </button>
                              <Button size="sm" variant="ghost" onClick={() => deleteSavedPlan(sp.id)} className="text-destructive" aria-label={t("admin.common.delete")}>
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                              </Button>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {/* AI-generated plan */}
                    {dietPlan ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-bold text-muted-foreground">{t("nutrition.totalCalories")}: <span className="text-emerald-600 font-black">{dietPlan.totalCalories} {t("nutrition.kcal")}</span></span>
                          <span className="font-bold text-blue-500">💧 {dietPlan.waterIntake}</span>
                        </div>

                        <div className="space-y-3">
                          {dietPlan.meals.map((meal, i) => (
                            <div key={i} className="bg-muted/50 p-4 rounded-2xl space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-black text-foreground">{meal.name}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">{meal.time}</span>
                                  <span className="text-xs font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 rounded-lg">{meal.calories} {t("nutrition.kcal")}</span>
                                </div>
                              </div>
                              <p className="text-sm text-muted-foreground">{meal.description}</p>
                              <p className="text-xs text-muted-foreground/70">{meal.ingredients.join(" • ")}</p>
                            </div>
                          ))}
                        </div>

                        {dietPlan.tips.length > 0 && (
                          <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-2xl space-y-2">
                            <p className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase">{t("nutrition.healthTip")}</p>
                            {dietPlan.tips.map((tip, i) => (
                              <p key={i} className="text-sm text-foreground">• {tip}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Default static plan */
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
                    )}
                  </CardContent>
                </Card>

                {/* Photo analysis */}
                <Card className="rounded-[30px] shadow-xl border-dashed border-2 border-emerald-300 dark:border-emerald-700">
                  <CardContent className="p-8 text-center space-y-4">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={handleFileSelect}
                    />

                    {previewUrl && (
                      <img
                        src={previewUrl}
                        alt={t("nutrition.mealPreview")}
                        className="w-full max-w-xs mx-auto rounded-2xl object-cover aspect-square border-2 border-emerald-300"
                      />
                    )}

                    {!previewUrl && <Camera className="h-12 w-12 text-emerald-500 mx-auto" />}

                    <h3 className="text-xl font-black text-foreground">{t("nutrition.photoTitle")}</h3>
                    <p className="text-muted-foreground">{t("nutrition.photoDesc")}</p>

                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isAnalyzing}
                      className="rounded-2xl font-black py-5 h-auto px-8 bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                    >
                      {isAnalyzing ? (
                        <><Loader2 className="h-5 w-5 animate-spin" /> {t("nutrition.analyzing")}</>
                      ) : (
                        <><Camera className="h-5 w-5" /> {t("nutrition.uploadPhoto")}</>
                      )}
                    </Button>

                    {/* Analysis result */}
                    {mealResult && (
                      <div className="text-start space-y-4 mt-4 p-6 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl">
                        <div className="flex items-center justify-between">
                          <h4 className="text-lg font-black text-foreground">{mealResult.name}</h4>
                          <div className="flex items-center gap-1 text-sm font-bold text-orange-500 bg-orange-100 dark:bg-orange-900/30 px-2 py-1 rounded-lg">
                            <Star className="h-4 w-4" fill="currentColor" />
                            {mealResult.rating}/10
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-card p-3 rounded-xl">
                            <p className="text-xs font-black text-muted-foreground uppercase">{t("nutrition.caloriesLabel")}</p>
                            <p className="text-xl font-black text-emerald-600">{mealResult.calories} <span className="text-sm">{t("nutrition.kcal")}</span></p>
                          </div>
                          <div className="bg-card p-3 rounded-xl">
                            <p className="text-xs font-black text-muted-foreground uppercase">{t("nutrition.ingredientsLabel")}</p>
                            <p className="text-sm font-bold text-foreground">{mealResult.ingredients.join("، ")}</p>
                          </div>
                        </div>

                        <div className="bg-card p-3 rounded-xl">
                          <p className="text-xs font-black text-muted-foreground uppercase">{t("nutrition.healthTip")}</p>
                          <p className="text-sm text-foreground mt-1">{mealResult.tip}</p>
                        </div>

                        {user && (
                          <Button
                            onClick={saveAnalysisToLog}
                            disabled={savingLog}
                            className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2"
                          >
                            {savingLog ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
                            {t("nutrition.saveToLog")}
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Meal Reminders */}
                <MealReminders />

                {/* Weekly Report */}
                <WeeklyCalorieReport calorieGoal={calorieGoal} />
              </div>
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}
