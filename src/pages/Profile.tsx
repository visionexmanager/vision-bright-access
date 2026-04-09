import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Navigate } from "react-router-dom";
import {
  Camera, Save, Trophy, Star, Flame, Target,
  Gamepad2, BookOpen, Users, TrendingUp, Award,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { usePoints } from "@/hooks/usePoints";
import { useAchievements, ACHIEVEMENTS } from "@/hooks/useAchievements";
import { calculateLevel, calculateStage, getStageIcon, STAGE_ICONS } from "@/systems/levelSystem";

export default function Profile() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { totalPoints, loadingTotal } = usePoints();
  const { unlocked, completedCount, loading: achLoading } = useAchievements();

  // Profile data
  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Activity stats
  const { data: stats } = useQuery({
    queryKey: ["profile-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [simRes, roomRes, mealRes, wishRes] = await Promise.all([
        supabase
          .from("simulation_progress")
          .select("id, completed")
          .eq("user_id", user!.id),
        supabase
          .from("voice_room_members")
          .select("id")
          .eq("user_id", user!.id),
        supabase
          .from("meal_logs")
          .select("id")
          .eq("user_id", user!.id),
        supabase
          .from("wishlists")
          .select("id")
          .eq("user_id", user!.id),
      ]);

      const simData = simRes.data || [];
      return {
        totalSimulations: simData.length,
        completedSimulations: simData.filter((s: any) => s.completed).length,
        activeRooms: roomRes.data?.length || 0,
        mealsLogged: mealRes.data?.length || 0,
        wishlistItems: wishRes.data?.length || 0,
      };
    },
  });

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || "");
      setAvatarUrl(profile.avatar_url || null);
    }
  }, [profile]);

  if (authLoading) {
    return (
      <Layout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Skeleton className="h-12 w-48" />
        </div>
      </Layout>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const level = calculateLevel(totalPoints);
  const stage = calculateStage(level);
  const stageIcon = getStageIcon(totalPoints);
  const pointsInLevel = totalPoints % 5000;
  const xpProgress = (pointsInLevel / 5000) * 100;
  const memberSince = user.created_at
    ? new Date(user.created_at).toLocaleDateString()
    : "—";

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large (max 2MB)", variant: "destructive" });
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });
    if (uploadError) {
      toast({ title: t("profile.error"), variant: "destructive" });
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    setAvatarUrl(`${urlData.publicUrl}?t=${Date.now()}`);
    setUploading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName.trim(), avatar_url: avatarUrl })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast({ title: t("profile.error"), variant: "destructive" });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
    toast({ title: t("profile.saved") });
  };

  const statCards = [
    { icon: Target, label: t("profile.statsSimulations"), value: stats?.completedSimulations ?? 0, sub: `/ ${stats?.totalSimulations ?? 0}`, color: "text-blue-500" },
    { icon: Star, label: t("profile.statsPoints"), value: totalPoints, sub: "", color: "text-yellow-500" },
    { icon: Trophy, label: t("profile.statsAchievements"), value: unlocked.size, sub: `/ ${ACHIEVEMENTS.length}`, color: "text-amber-500" },
    { icon: Flame, label: t("profile.statsLevel"), value: `Lv.${level}`, sub: stageIcon, color: "text-orange-500" },
    { icon: Users, label: t("profile.statsRooms"), value: stats?.activeRooms ?? 0, sub: "", color: "text-emerald-500" },
    { icon: BookOpen, label: t("profile.statsMeals"), value: stats?.mealsLogged ?? 0, sub: "", color: "text-purple-500" },
  ];

  return (
    <Layout>
      <section className="mx-auto max-w-4xl px-4 py-10">
        {/* Hero Card */}
        <Card className="mb-8 overflow-hidden">
          <div className="h-32 bg-gradient-to-r from-primary/80 via-primary/50 to-accent/40" />
          <CardContent className="relative px-6 pb-8 pt-0">
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-end sm:gap-6 -mt-16">
              {/* Avatar */}
              <div className="relative">
                <Avatar className="h-32 w-32 border-4 border-background shadow-xl">
                  {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
                  <AvatarFallback className="text-4xl font-bold bg-primary/10">
                    {(displayName || user.email || "U").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute bottom-1 end-1 h-9 w-9 rounded-full shadow-lg"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  aria-label={t("profile.changeAvatar")}
                >
                  <Camera className="h-4 w-4" />
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
              </div>

              {/* Name & Level */}
              <div className="flex-1 text-center sm:text-start">
                <div className="flex items-center justify-center gap-2 sm:justify-start">
                  <h1 className="text-2xl font-bold">{displayName || user.email}</h1>
                  <span className="text-2xl" title={`Stage ${stage}`}>{stageIcon}</span>
                </div>
                <p className="text-muted-foreground">{user.email}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("profile.memberSince")} {memberSince}
                </p>

                {/* XP Progress */}
                <div className="mt-3 max-w-sm">
                  <div className="mb-1 flex justify-between text-xs font-medium">
                    <span>Level {level}</span>
                    <span>{pointsInLevel.toLocaleString()} / 5,000 XP</span>
                  </div>
                  <Progress value={xpProgress} className="h-2.5" />
                </div>
              </div>

              {/* Save Button */}
              <div className="flex flex-col gap-2">
                <div className="space-y-1">
                  <Label htmlFor="dn" className="text-sm">{t("profile.displayName")}</Label>
                  <Input
                    id="dn"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={100}
                    className="w-48"
                  />
                </div>
                <Button onClick={handleSave} disabled={saving || isLoading} size="sm">
                  <Save className="me-2 h-4 w-4" />
                  {saving ? t("profile.saving") : t("profile.save")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <h2 className="mb-4 text-xl font-bold flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          {t("profile.activityStats")}
        </h2>
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {statCards.map((s) => (
            <Card key={s.label} className="text-center transition-shadow hover:shadow-md">
              <CardContent className="flex flex-col items-center gap-1 p-4">
                <s.icon className={`h-6 w-6 ${s.color}`} />
                <span className="text-2xl font-bold">{s.value}</span>
                <span className="text-xs text-muted-foreground">{s.sub}</span>
                <span className="text-xs font-medium">{s.label}</span>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Achievements */}
        <h2 className="mb-4 text-xl font-bold flex items-center gap-2">
          <Award className="h-5 w-5 text-primary" />
          {t("profile.achievementsTitle")}
        </h2>
        <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ACHIEVEMENTS.map((ach) => {
            const isUnlocked = unlocked.has(ach.key);
            return (
              <Card
                key={ach.key}
                className={`transition-all ${
                  isUnlocked
                    ? "border-primary/40 bg-primary/5 shadow-md"
                    : "opacity-50 grayscale"
                }`}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  <span className="text-4xl">{ach.icon}</span>
                  <div className="flex-1">
                    <p className="font-semibold">{t(ach.titleKey)}</p>
                    <p className="text-xs text-muted-foreground">{t(ach.descKey)}</p>
                  </div>
                  {isUnlocked ? (
                    <Badge className="bg-primary text-primary-foreground">✓</Badge>
                  ) : (
                    <Badge variant="outline">{ach.threshold}</Badge>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Level Progression */}
        <h2 className="mb-4 text-xl font-bold flex items-center gap-2">
          <Gamepad2 className="h-5 w-5 text-primary" />
          {t("profile.levelProgression")}
        </h2>
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-wrap gap-3">
              {STAGE_ICONS.slice(0, 10).map((icon, i) => {
                const isReached = stage >= i;
                return (
                  <div
                    key={i}
                    className={`flex flex-col items-center gap-1 rounded-lg border p-3 transition-all ${
                      isReached
                        ? "border-primary/40 bg-primary/10 shadow"
                        : "border-muted opacity-40"
                    }`}
                  >
                    <span className="text-2xl">{icon}</span>
                    <span className="text-[10px] font-medium">Stage {i + 1}</span>
                    <span className="text-[10px] text-muted-foreground">Lv.{i * 10}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </section>
    </Layout>
  );
}
