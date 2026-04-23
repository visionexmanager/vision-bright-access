import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowLeft, ShieldCheck, ShieldOff, Ban, Clock, CheckCircle,
  Coins, Star, Search, ChevronDown, BadgeCheck, Bell, Eye
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDebounce } from "@/hooks/useDebounce";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const FEATURES = [
  { key: "marketplace_access", label: "الوصول للسوق" },
  { key: "voice_rooms", label: "غرف الصوت" },
  { key: "ai_chat_unlimited", label: "دردشة AI بلا حدود" },
  { key: "academy_access", label: "الأكاديمية" },
  { key: "nutrition_expert", label: "خبير التغذية" },
  { key: "pro_tools", label: "الأدوات الاحترافية" },
  { key: "games_access", label: "الألعاب" },
  { key: "simulation_access", label: "المحاكاة" },
];

type UserProfile = {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  status: string;
  ban_reason: string | null;
  suspended_until: string | null;
  is_verified: boolean;
  isAdmin?: boolean;
  points?: number;
  features?: Record<string, boolean>;
};

type DialogType = "ban" | "suspend" | "points" | "features" | "notify" | "detail" | null;

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [selected, setSelected] = useState<UserProfile | null>(null);
  const [dialog, setDialog] = useState<DialogType>(null);
  const [loading, setLoading] = useState(false);

  // Form states
  const [banReason, setBanReason] = useState("");
  const [suspendDays, setSuspendDays] = useState("3");
  const [suspendReason, setSuspendReason] = useState("");
  const [pointsAmount, setPointsAmount] = useState("100");
  const [pointsReason, setPointsReason] = useState("");
  const [notifyTitle, setNotifyTitle] = useState("");
  const [notifyBody, setNotifyBody] = useState("");
  const [notifyType, setNotifyType] = useState("info");
  const [userFeatures, setUserFeatures] = useState<Record<string, boolean>>({});

  const load = async () => {
    const [{ data: profiles }, { data: roles }, { data: pointsData }, { data: featuresData }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("user_points").select("user_id, points"),
      supabase.from("user_features").select("user_id, feature_key, enabled"),
    ]);

    const adminIds = new Set((roles ?? []).filter(r => r.role === "admin").map(r => r.user_id));

    const pointsMap: Record<string, number> = {};
    for (const p of pointsData ?? []) {
      pointsMap[p.user_id] = (pointsMap[p.user_id] || 0) + (p.points || 0);
    }

    const featuresMap: Record<string, Record<string, boolean>> = {};
    for (const f of featuresData ?? []) {
      if (!featuresMap[f.user_id]) featuresMap[f.user_id] = {};
      featuresMap[f.user_id][f.feature_key] = f.enabled;
    }

    setUsers((profiles ?? []).map(p => ({
      ...p,
      status: p.status || "active",
      is_verified: p.is_verified || false,
      isAdmin: adminIds.has(p.user_id),
      points: pointsMap[p.user_id] || 0,
      features: featuresMap[p.user_id] || {},
    })));
  };

  useEffect(() => { load(); }, []);

  const openDialog = (user: UserProfile, type: DialogType) => {
    setSelected(user);
    setDialog(type);
    if (type === "features") setUserFeatures(user.features || {});
    setBanReason(""); setSuspendReason(""); setPointsAmount("100");
    setPointsReason(""); setNotifyTitle(""); setNotifyBody("");
  };

  const closeDialog = () => { setDialog(null); setSelected(null); };

  const toggleAdmin = async (u: UserProfile) => {
    if (u.user_id === currentUser?.id) { toast.error("لا يمكنك تغيير صلاحيتك"); return; }
    if (u.isAdmin) {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", u.user_id).eq("role", "admin");
      if (error) toast.error(error.message); else toast.success("تمت إزالة صلاحية الأدمن");
    } else {
      const { error } = await supabase.from("user_roles").insert({ user_id: u.user_id, role: "admin" });
      if (error) toast.error(error.message); else toast.success("تمت إضافة صلاحية الأدمن");
    }
    load();
  };

  const banUser = async () => {
    if (!selected || !banReason) return;
    setLoading(true);
    const { error } = await supabase.rpc("ban_user", { _user_id: selected.user_id, _reason: banReason });
    setLoading(false);
    if (error) toast.error(error.message);
    else { toast.success("تم حظر المستخدم"); closeDialog(); load(); }
  };

  const suspendUser = async () => {
    if (!selected) return;
    setLoading(true);
    const until = new Date(Date.now() + parseInt(suspendDays) * 86400000).toISOString();
    const { error } = await supabase.rpc("suspend_user", {
      _user_id: selected.user_id, _until: until, _reason: suspendReason || `تعليق ${suspendDays} أيام`,
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else { toast.success(`تم تعليق المستخدم لمدة ${suspendDays} أيام`); closeDialog(); load(); }
  };

  const unbanUser = async (u: UserProfile) => {
    const { error } = await supabase.rpc("unban_user", { _user_id: u.user_id });
    if (error) toast.error(error.message);
    else { toast.success("تم رفع الحظر"); load(); }
  };

  const grantPoints = async () => {
    if (!selected || !pointsAmount) return;
    setLoading(true);
    const { error } = await supabase.rpc("admin_grant_points", {
      _user_id: selected.user_id,
      _points: parseInt(pointsAmount),
      _reason: pointsReason || "منحة من الأدمن",
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else { toast.success(`تم منح ${pointsAmount} نقطة`); closeDialog(); load(); }
  };

  const saveFeatures = async () => {
    if (!selected) return;
    setLoading(true);
    for (const [key, enabled] of Object.entries(userFeatures)) {
      await supabase.rpc("toggle_user_feature", {
        _user_id: selected.user_id, _feature_key: key, _enabled: enabled,
      });
    }
    setLoading(false);
    toast.success("تم حفظ الميزات");
    closeDialog(); load();
  };

  const sendNotification = async () => {
    if (!selected || !notifyTitle || !notifyBody) return;
    setLoading(true);
    const { error } = await supabase.from("notifications").insert({
      user_id: selected.user_id,
      title: notifyTitle,
      body: notifyBody,
      type: notifyType,
      sent_by: currentUser?.id,
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else { toast.success("تم إرسال الإشعار"); closeDialog(); }
  };

  const toggleVerified = async (u: UserProfile) => {
    const { error } = await supabase.from("profiles")
      .update({ is_verified: !u.is_verified }).eq("user_id", u.user_id);
    if (error) toast.error(error.message);
    else { toast.success(u.is_verified ? "تمت إزالة التحقق" : "تم التحقق"); load(); }
  };

  const statusBadge = (u: UserProfile) => {
    if (u.status === "banned") return <Badge className="bg-red-600">محظور</Badge>;
    if (u.status === "suspended") return <Badge className="bg-orange-500">معلق</Badge>;
    return <Badge className="bg-green-600">نشط</Badge>;
  };

  const filtered = users.filter(u =>
    !debouncedSearch || (u.display_name || "").toLowerCase().includes(debouncedSearch.toLowerCase()) ||
    u.user_id.includes(debouncedSearch)
  );

  return (
    <Layout>
      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="mb-6 flex items-center gap-3">
          <Link to="/admin"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
          <h1 className="text-3xl font-bold">إدارة المستخدمين</h1>
          <Badge variant="secondary">{users.length} مستخدم</Badge>
        </div>

        <div className="mb-4 flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder="بحث بالاسم أو الـ ID..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المستخدم</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>الدور</TableHead>
                    <TableHead>النقاط</TableHead>
                    <TableHead>موثق</TableHead>
                    <TableHead>انضم</TableHead>
                    <TableHead>الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="font-medium flex items-center gap-1">
                              {u.display_name || "—"}
                              {u.is_verified && <BadgeCheck className="h-4 w-4 text-blue-500" />}
                            </div>
                            <div className="text-xs text-muted-foreground truncate max-w-[140px]">{u.user_id}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{statusBadge(u)}</TableCell>
                      <TableCell>
                        {u.isAdmin ? <Badge className="bg-primary">أدمن</Badge> : <Badge variant="secondary">مستخدم</Badge>}
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1 font-mono text-sm">
                          <Coins className="h-3 w-3 text-yellow-500" />{u.points}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Switch checked={u.is_verified} onCheckedChange={() => toggleVerified(u)} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString("ar")}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              إجراء <ChevronDown className="ms-1 h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openDialog(u, "points")}>
                              <Coins className="me-2 h-4 w-4 text-yellow-500" /> منح نقاط
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openDialog(u, "features")}>
                              <Star className="me-2 h-4 w-4 text-purple-500" /> إدارة الميزات
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openDialog(u, "notify")}>
                              <Bell className="me-2 h-4 w-4 text-blue-500" /> إرسال إشعار
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => toggleAdmin(u)} disabled={u.user_id === currentUser?.id}>
                              {u.isAdmin
                                ? <><ShieldOff className="me-2 h-4 w-4 text-red-500" /> إزالة أدمن</>
                                : <><ShieldCheck className="me-2 h-4 w-4 text-green-500" /> منح أدمن</>}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {u.status === "active" ? (
                              <>
                                <DropdownMenuItem onClick={() => openDialog(u, "suspend")} className="text-orange-600">
                                  <Clock className="me-2 h-4 w-4" /> تعليق مؤقت
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openDialog(u, "ban")} className="text-red-600">
                                  <Ban className="me-2 h-4 w-4" /> حظر دائم
                                </DropdownMenuItem>
                              </>
                            ) : (
                              <DropdownMenuItem onClick={() => unbanUser(u)} className="text-green-600">
                                <CheckCircle className="me-2 h-4 w-4" /> رفع الحظر
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Ban Dialog */}
      <Dialog open={dialog === "ban"} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-red-600">حظر المستخدم: {selected?.display_name}</DialogTitle></DialogHeader>
          <Label>سبب الحظر</Label>
          <Textarea value={banReason} onChange={e => setBanReason(e.target.value)} placeholder="اكتب سبب الحظر..." />
          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog}>إلغاء</Button>
            <Button variant="destructive" onClick={banUser} disabled={loading || !banReason}>
              {loading ? "جاري الحظر..." : "تأكيد الحظر"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend Dialog */}
      <Dialog open={dialog === "suspend"} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-orange-600">تعليق مؤقت: {selected?.display_name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>مدة التعليق</Label>
              <Select value={suspendDays} onValueChange={setSuspendDays}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">يوم واحد</SelectItem>
                  <SelectItem value="3">3 أيام</SelectItem>
                  <SelectItem value="7">أسبوع</SelectItem>
                  <SelectItem value="14">أسبوعان</SelectItem>
                  <SelectItem value="30">شهر</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>السبب (اختياري)</Label>
              <Textarea value={suspendReason} onChange={e => setSuspendReason(e.target.value)} placeholder="سبب التعليق..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog}>إلغاء</Button>
            <Button className="bg-orange-600 hover:bg-orange-700" onClick={suspendUser} disabled={loading}>
              {loading ? "جاري التعليق..." : "تأكيد التعليق"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Points Dialog */}
      <Dialog open={dialog === "points"} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>منح نقاط: {selected?.display_name}</DialogTitle></DialogHeader>
          <div className="text-sm text-muted-foreground">الرصيد الحالي: <span className="font-bold text-yellow-500">{selected?.points} نقطة</span></div>
          <div className="space-y-4">
            <div>
              <Label>عدد النقاط</Label>
              <Input type="number" value={pointsAmount} onChange={e => setPointsAmount(e.target.value)} min="1" />
            </div>
            <div>
              <Label>السبب</Label>
              <Input value={pointsReason} onChange={e => setPointsReason(e.target.value)} placeholder="سبب المنح..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog}>إلغاء</Button>
            <Button onClick={grantPoints} disabled={loading || !pointsAmount}>
              {loading ? "جاري المنح..." : "منح النقاط"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Features Dialog */}
      <Dialog open={dialog === "features"} onOpenChange={closeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>إدارة ميزات: {selected?.display_name}</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {FEATURES.map(f => (
              <div key={f.key} className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm font-medium">{f.label}</span>
                <Switch
                  checked={userFeatures[f.key] ?? false}
                  onCheckedChange={v => setUserFeatures(prev => ({ ...prev, [f.key]: v }))}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog}>إلغاء</Button>
            <Button onClick={saveFeatures} disabled={loading}>
              {loading ? "جاري الحفظ..." : "حفظ الميزات"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notification Dialog */}
      <Dialog open={dialog === "notify"} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>إرسال إشعار: {selected?.display_name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>نوع الإشعار</Label>
              <Select value={notifyType} onValueChange={setNotifyType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">معلومات</SelectItem>
                  <SelectItem value="success">نجاح</SelectItem>
                  <SelectItem value="warning">تحذير</SelectItem>
                  <SelectItem value="error">خطأ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>العنوان</Label>
              <Input value={notifyTitle} onChange={e => setNotifyTitle(e.target.value)} placeholder="عنوان الإشعار..." />
            </div>
            <div>
              <Label>الرسالة</Label>
              <Textarea value={notifyBody} onChange={e => setNotifyBody(e.target.value)} placeholder="نص الإشعار..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog}>إلغاء</Button>
            <Button onClick={sendNotification} disabled={loading || !notifyTitle || !notifyBody}>
              {loading ? "جاري الإرسال..." : "إرسال الإشعار"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
