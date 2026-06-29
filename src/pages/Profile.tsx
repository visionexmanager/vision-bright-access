import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CollapsibleTableCard } from "@/components/ui/collapsible-table-card";
import { Navigate, Link, useNavigate } from "react-router-dom";
import {
  Camera, Save, Trophy, Star, Flame, Target,
  Gamepad2, BookOpen, Users, TrendingUp, Award, Coins, ShoppingBag, ArrowRight, Clock,
  MessageCircle, Search, Send, FileText, Paperclip, Calendar,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ar as arLocale, enUS, es, de, pt, zhCN, tr, fr, ru } from "date-fns/locale";
import { usePoints } from "@/hooks/usePoints";
import { useAchievements, ACHIEVEMENTS } from "@/hooks/useAchievements";
import { calculateLevel, calculateStage, getStageIcon, STAGE_ICONS } from "@/systems/levelSystem";
import { WatchAdButton } from "@/components/WatchAdButton";
import { findOrCreateConversation } from "@/hooks/useMessages";
import { toast as sonnerToast } from "sonner";
import { formatVX } from "@/systems/pricingSystem";
import { useAdmin } from "@/hooks/useAdmin";
import { ShieldCheck } from "lucide-react";

const DATE_LOCALES: Record<string, Locale> = {
  ar: arLocale, es, de, pt, zh: zhCN, tr, fr, ru,
  en: enUS, ur: arLocale, hi: enUS,
};

function translateReason(reason: string, t: (key: string) => string): string {
  const lower = reason.toLowerCase();
  if (lower.includes("daily login") || lower.includes("login bonus")) return t("dash.reason.dailyLogin");
  if (lower.includes("watched an ad") || (lower.includes("watch") && lower.includes("ad"))) return t("dash.reason.watchedAd");
  if (lower.includes("vx purchase") || lower.includes("purchase")) return t("dash.reason.vxPurchase");
  if (lower.includes("bazaar") || lower.includes("rent") || lower.includes("trial billing")) return t("dash.reason.trialBilling");
  if (lower.includes("admin") && (lower.includes("grant") || lower.includes("credit"))) return t("dash.reason.adminGrant");
  if (lower.includes("admin") && (lower.includes("deduct") || lower.includes("penalty"))) return t("dash.reason.adminDeduction");
  if (lower.includes("quiz")) return t("dash.reason.quiz");
  if (lower.includes("memory")) return t("dash.reason.memory");
  if (lower.includes("word") || lower.includes("puzzle")) return t("dash.reason.wordPuzzle");
  if (lower.includes("simulation") || lower.includes("sim")) return t("dash.reason.simulation");
  return reason;
}

const REQUEST_STATUS_KEYS: Record<string, string> = {
  pending:     "contact.status.pending",
  in_progress: "contact.status.in_progress",
  resolved:    "contact.status.resolved",
  closed:      "contact.status.closed",
};

const REQUEST_STATUS_STYLES: Record<string, string> = {
  pending:     "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  in_progress: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  resolved:    "bg-green-500/15 text-green-600 dark:text-green-400",
  closed:      "bg-muted text-muted-foreground",
};

export default function Profile() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin } = useAdmin();
  const { t, lang } = useLanguage();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Message search state
  const [msgSearch, setMsgSearch] = useState("");
  const [msgResults, setMsgResults] = useState<{ user_id: string; display_name: string | null; avatar_url: string | null }[]>([]);
  const [msgSearching, setMsgSearching] = useState(false);
  const [msgStarting, setMsgStarting] = useState<string | null>(null);

  const { totalPoints, history, loadingTotal, loadingHistory } = usePoints();
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
        supabase.from("simulation_progress").select("id, completed").eq("user_id", user!.id),
        supabase.from("voice_room_members").select("id").eq("user_id", user!.id),
        supabase.from("meal_logs").select("id").eq("user_id", user!.id),
        supabase.from("wishlists").select("id").eq("user_id", user!.id),
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

  // User's submitted service requests (contact form)
  const { data: serviceRequests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ["service-requests", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_requests")
        .select("id, service_type, status, created_at, attachment_url")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: purchases = [], isLoading: purchasesLoading } = useQuery({
    queryKey: ["vx-purchases", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vx_purchases")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
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
  const totalSpent = purchases.reduce((sum, purchase) => sum + purchase.amount, 0);
  const purchaseTypeColors: Record<string, string> = {
    game: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
    course: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
    article: "bg-green-500/15 text-green-700 dark:text-green-300",
    simulation: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
    service: "bg-pink-500/15 text-pink-700 dark:text-pink-300",
    bazaar_shop: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    bazaar_order: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  };
  const expandTableLabel = t("table.expand");
  const collapseTableLabel = t("table.collapse");

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: t("profile.fileTooLarge"), variant: "destructive" });
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
      .upsert(
        {
          ...(profile?.id ? { id: profile.id } : {}),
          user_id: user.id,
          display_name: displayName.trim() || null,
          avatar_url: avatarUrl,
        },
        { onConflict: "user_id" }
      );
    setSaving(false);
    if (error) {
      toast({ title: t("profile.error"), variant: "destructive" });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
    toast({ title: t("profile.saved") });
  };

  const handleMsgSearch = async () => {
    if (!msgSearch.trim()) return;
    setMsgSearching(true);
    const { data } = await supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url")
      .neq("user_id", user.id)
      .ilike("display_name", `%${msgSearch.trim()}%`)
      .limit(8);
    setMsgResults(data || []);
    setMsgSearching(false);
  };

  const handleStartConversation = async (otherUserId: string) => {
    setMsgStarting(otherUserId);
    try {
      const convId = await findOrCreateConversation(user.id, otherUserId);
      navigate(`/messages?conv=${convId}`);
    } catch {
      sonnerToast.error(t("msg.errorCreating"));
    }
    setMsgStarting(null);
  };

  const statCards = [
    { icon: Target,   label: t("profile.statsSimulations"), value: stats?.completedSimulations ?? 0, sub: `/ ${stats?.totalSimulations ?? 0}`, color: "text-blue-500"    },
    { icon: Star,     label: t("profile.statsPoints"),      value: totalPoints,                       sub: "",                                  color: "text-yellow-500"  },
    { icon: Trophy,   label: t("profile.statsAchievements"),value: unlocked.size,                    sub: `/ ${ACHIEVEMENTS.length}`,           color: "text-amber-500"   },
    { icon: Flame,    label: t("profile.statsLevel"),       value: `${t("profile.levelPrefix") || "Lv."}${level}`, sub: stageIcon,            color: "text-orange-500"  },
    { icon: Users,    label: t("profile.statsRooms"),       value: stats?.activeRooms ?? 0,           sub: "",                                  color: "text-emerald-500" },
    { icon: BookOpen, label: t("profile.statsMeals"),       value: stats?.mealsLogged ?? 0,           sub: "",                                  color: "text-purple-500"  },
  ];

  return (
    <Layout>
      <section className="section-container py-12">
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
                  <Camera className="h-4 w-4" aria-hidden="true" />
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
                <div className="flex items-center justify-center gap-2 sm:justify-start flex-wrap">
                  <h1 className="text-2xl font-bold">{displayName || user.email}</h1>
                  <span className="text-2xl" title={`Stage ${stage}`}>{stageIcon}</span>
                  {isAdmin && (
                    <Badge className="gap-1 bg-amber-500/10 text-amber-500 border border-amber-500/30 hover:bg-amber-500/20 select-none">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Admin
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground">{user.email}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("profile.memberSince")} {memberSince}
                </p>

                {/* Earn VX */}
                <WatchAdButton variant="card" className="mb-6" />

                {/* Coins Balance */}
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                  <Coins className="h-4 w-4" />
                  {totalPoints.toLocaleString()} VX
                </div>

                {/* XP Progress */}
                <div className="mt-3 max-w-sm">
                  <div className="mb-1 flex justify-between text-xs font-medium">
                    <span>{t("profile.levelPrefix")}{level}</span>
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
        <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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

        {/* Messages inbox link */}
        <Link to="/messages" className="mb-4 block group">
          <div className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4 transition-all hover:border-primary/40 hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <MessageCircle className="h-5 w-5 text-primary" />
              </div>
              <span className="font-semibold">{t("msg.title")}</span>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
          </div>
        </Link>

        {/* Send Message to User */}
        <h2 className="mb-4 text-xl font-bold flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-primary" />
          {t("msg.sendToUser")}
        </h2>
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex gap-2 mb-4">
              <Input
                value={msgSearch}
                onChange={(e) => setMsgSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleMsgSearch()}
                placeholder={t("msg.searchUsers")}
                className="flex-1"
              />
              <Button onClick={handleMsgSearch} disabled={msgSearching} variant="outline" size="icon" aria-label={t("msg.searchUsers")}>
                <Search className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
            {!msgSearch && (
              <p className="text-sm text-muted-foreground text-center py-3">{t("msg.searchPrompt")}</p>
            )}
            {msgSearch && msgResults.length === 0 && !msgSearching && (
              <p className="text-sm text-muted-foreground text-center py-3">{t("msg.noResults")}</p>
            )}
            <div className="space-y-2">
              {msgResults.map((p) => (
                <div key={p.user_id} className="flex items-center gap-3 rounded-lg border p-3">
                  <Avatar className="h-9 w-9">
                    {p.avatar_url && <AvatarImage src={p.avatar_url} />}
                    <AvatarFallback>{(p.display_name || "?").charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="flex-1 font-medium text-sm">{p.display_name || t("msg.unknownUser")}</span>
                  <Button
                    size="sm"
                    disabled={msgStarting === p.user_id}
                    onClick={() => handleStartConversation(p.user_id)}
                  >
                    <Send className="me-1.5 h-3.5 w-3.5" />
                    {t("msg.send")}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Purchase History */}
        <h2 id="purchase-history" className="mb-4 text-xl font-bold flex items-center gap-2">
          <ShoppingBag className="h-5 w-5 text-primary" />
          {t("purchaseHistory.title")}
        </h2>
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Coins className="h-5 w-5 text-yellow-500" aria-hidden="true" />
              <div>
                <p className="text-xs text-muted-foreground">{t("purchaseHistory.totalSpent")}</p>
                <p className="text-lg font-bold text-primary">{formatVX(totalSpent)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Calendar className="h-5 w-5 text-blue-500" aria-hidden="true" />
              <div>
                <p className="text-xs text-muted-foreground">{t("purchaseHistory.transactions")}</p>
                <p className="text-lg font-bold">{purchases.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>
        <CollapsibleTableCard
          className="mb-8"
          title={t("purchaseHistory.allPurchases")}
          summary={`${purchases.length} ${t("purchaseHistory.transactions")}`}
          expandLabel={expandTableLabel}
          collapseLabel={collapseTableLabel}
        >
            {purchasesLoading ? (
              <div className="space-y-3 p-6">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : purchases.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">
                <ShoppingBag className="mx-auto mb-3 h-12 w-12 opacity-30" aria-hidden="true" />
                <p>{t("purchaseHistory.empty")}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("purchaseHistory.colItem")}</TableHead>
                    <TableHead>{t("purchaseHistory.colType")}</TableHead>
                    <TableHead>{t("purchaseHistory.colAmount")}</TableHead>
                    <TableHead>{t("purchaseHistory.colDate")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchases.map((purchase) => (
                    <TableRow key={purchase.id}>
                      <TableCell className="font-medium">{purchase.item_name || purchase.item_type}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`border-transparent ${purchaseTypeColors[purchase.item_type] ?? "bg-muted text-muted-foreground"}`}
                        >
                          {purchase.item_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold text-primary">{formatVX(purchase.amount)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(purchase.created_at), "MMM d, yyyy", { locale: DATE_LOCALES[lang] ?? enUS })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
        </CollapsibleTableCard>

        {/* Service Requests */}
        <h2 className="mb-4 text-xl font-bold flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          {t("profile.requestsTitle")}
        </h2>
        <CollapsibleTableCard
          className="mb-8"
          title={t("profile.requestsTitle")}
          summary={`${serviceRequests.length} ${t("profile.requestsTitle")}`}
          defaultOpen={serviceRequests.length > 0}
          expandLabel={expandTableLabel}
          collapseLabel={collapseTableLabel}
        >
            {requestsLoading ? (
              <div className="space-y-3 p-6">
                {[1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : serviceRequests.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">
                <p className="mb-3">{t("profile.requestsEmpty")}</p>
                <Button asChild variant="outline" size="sm">
                  <Link to="/contact-us">{t("contact.title")}</Link>
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("contact.serviceType")}</TableHead>
                    <TableHead>{t("profile.requestStatus")}</TableHead>
                    <TableHead>{t("dash.date")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {serviceRequests.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell className="font-medium">
                        <span className="inline-flex items-center gap-2">
                          {req.service_type}
                          {req.attachment_url && (
                            <a
                              href={req.attachment_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={t("contact.attachment")}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <Paperclip className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`border-transparent ${REQUEST_STATUS_STYLES[req.status] ?? "bg-muted text-muted-foreground"}`}
                        >
                          {REQUEST_STATUS_KEYS[req.status] ? t(REQUEST_STATUS_KEYS[req.status]) : req.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(req.created_at), "MMM d, yyyy", { locale: DATE_LOCALES[lang] ?? enUS })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
        </CollapsibleTableCard>

        {/* Activity History */}
        <h2 className="mb-4 text-xl font-bold flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          {t("dash.history")}
        </h2>
        <CollapsibleTableCard
          className="mb-8"
          title={t("dash.history")}
          summary={`${history.length} ${t("dash.activity")}`}
          defaultOpen={history.length > 0}
          expandLabel={expandTableLabel}
          collapseLabel={collapseTableLabel}
        >
            {loadingHistory ? (
              <div className="space-y-3 p-6">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : history.length === 0 ? (
              <p className="py-10 text-center text-muted-foreground">{t("dash.noActivity")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("dash.activity")}</TableHead>
                    <TableHead>{t("dash.points")}</TableHead>
                    <TableHead>{t("dash.date")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">{translateReason(entry.reason, t)}</TableCell>
                      <TableCell>
                        <Badge variant={entry.points > 0 ? "default" : "destructive"}>
                          {entry.points > 0 ? "+" : ""}{entry.points}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(entry.created_at), "MMM d, yyyy", { locale: DATE_LOCALES[lang] ?? enUS })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
        </CollapsibleTableCard>

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
                    <span className="text-[10px] font-medium">{t("profile.stagePrefix")} {i + 1}</span>
                    <span className="text-[10px] text-muted-foreground">{t("profile.levelPrefix")}{i * 10}</span>
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
