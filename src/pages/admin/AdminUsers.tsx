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
  Coins, Star, Search, ChevronDown, BadgeCheck, Bell, Eye, Fingerprint
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDebounce } from "@/hooks/useDebounce";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const FEATURES = [
  "marketplace_access",
  "voice_rooms",
  "ai_chat_unlimited",
  "academy_access",
  "nutrition_expert",
  "pro_tools",
  "games_access",
  "simulation_access",
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
  device_ids?: string[];
};

type DialogType = "ban" | "suspend" | "points" | "features" | "notify" | "detail" | "device_ban" | null;

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const { t } = useLanguage();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [selected, setSelected] = useState<UserProfile | null>(null);
  const [dialog, setDialog] = useState<DialogType>(null);
  const [loading, setLoading] = useState(false);

  // Form states
  const [banReason, setBanReason] = useState("");
  const [deviceBanReason, setDeviceBanReason] = useState("");
  const [suspendDays, setSuspendDays] = useState("3");
  const [suspendReason, setSuspendReason] = useState("");
  const [pointsAmount, setPointsAmount] = useState("100");
  const [pointsReason, setPointsReason] = useState("");
  const [notifyTitle, setNotifyTitle] = useState("");
  const [notifyBody, setNotifyBody] = useState("");
  const [notifyType, setNotifyType] = useState("info");
  const [userFeatures, setUserFeatures] = useState<Record<string, boolean>>({});

  const load = async () => {
    const [{ data: profiles }, { data: roles }, { data: pointsData }, { data: featuresData }, { data: deviceData }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("user_points").select("user_id, points"),
      supabase.from("user_features").select("user_id, feature_key, enabled"),
      supabase.from("device_fingerprints").select("user_id, device_id"),
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

    const deviceMap: Record<string, string[]> = {};
    for (const d of deviceData ?? []) {
      if (!deviceMap[d.user_id]) deviceMap[d.user_id] = [];
      deviceMap[d.user_id].push(d.device_id);
    }

    setUsers((profiles ?? []).map(p => ({
      ...p,
      status: p.status || "active",
      is_verified: p.is_verified || false,
      isAdmin: adminIds.has(p.user_id),
      points: pointsMap[p.user_id] || 0,
      features: featuresMap[p.user_id] || {},
      device_ids: deviceMap[p.user_id] || [],
    })));
  };

  useEffect(() => { load(); }, []);

  const openDialog = (user: UserProfile, type: DialogType) => {
    setSelected(user);
    setDialog(type);
    if (type === "features") setUserFeatures(user.features || {});
    setBanReason(""); setDeviceBanReason(""); setSuspendReason(""); setPointsAmount("100");
    setPointsReason(""); setNotifyTitle(""); setNotifyBody("");
  };

  const closeDialog = () => { setDialog(null); setSelected(null); };

  const toggleAdmin = async (u: UserProfile) => {
    if (u.user_id === currentUser?.id) { toast.error(t("admin.users.cannotChangeSelf")); return; }
    if (u.isAdmin) {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", u.user_id).eq("role", "admin");
      if (error) toast.error(error.message); else toast.success(t("admin.users.adminRemoved"));
    } else {
      const { error } = await supabase.from("user_roles").insert({ user_id: u.user_id, role: "admin" });
      if (error) toast.error(error.message); else toast.success(t("admin.users.adminAdded"));
    }
    load();
  };

  const banUser = async () => {
    if (!selected || !banReason) return;
    setLoading(true);
    const { error } = await supabase.rpc("ban_user", { _user_id: selected.user_id, _reason: banReason });
    setLoading(false);
    if (error) toast.error(error.message);
    else { toast.success(t("admin.users.userBanned")); closeDialog(); load(); }
  };

  const suspendUser = async () => {
    if (!selected) return;
    setLoading(true);
    const until = new Date(Date.now() + parseInt(suspendDays) * 86400000).toISOString();
    const { error } = await supabase.rpc("suspend_user", {
      _user_id: selected.user_id, _until: until, _reason: suspendReason || t("admin.users.suspendDefaultReason").replace("{days}", suspendDays),
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else { toast.success(t("admin.users.userSuspended").replace("{days}", suspendDays)); closeDialog(); load(); }
  };

  const unbanUser = async (u: UserProfile) => {
    const { error } = await supabase.rpc("unban_user", { _user_id: u.user_id });
    if (error) toast.error(error.message);
    else { toast.success(t("admin.users.unbanned")); load(); }
  };

  const banDevice = async () => {
    if (!selected || !deviceBanReason) return;
    const did = selected.device_ids?.[0];
    if (!did) { toast.error(t("admin.users.noDeviceForUser")); return; }
    setLoading(true);
    const { error } = await supabase.rpc("ban_device", {
      _device_id: did,
      _reason: deviceBanReason,
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else { toast.success(t("admin.users.deviceBanned")); closeDialog(); load(); }
  };

  const unbanDevice = async (u: UserProfile) => {
    const did = u.device_ids?.[0];
    if (!did) { toast.error(t("admin.users.noDevice")); return; }
    const { error } = await supabase.rpc("unban_device", { _device_id: did });
    if (error) toast.error(error.message);
    else { toast.success(t("admin.users.deviceUnbanned")); load(); }
  };

  const grantPoints = async () => {
    if (!selected || !pointsAmount) return;
    setLoading(true);
    const { error } = await supabase.rpc("admin_grant_points", {
      _user_id: selected.user_id,
      _points: parseInt(pointsAmount),
      _reason: pointsReason || t("admin.users.defaultGrantReason"),
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else { toast.success(t("admin.users.pointsGranted").replace("{points}", pointsAmount)); closeDialog(); load(); }
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
    toast.success(t("admin.users.featuresSaved"));
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
    else { toast.success(t("admin.users.notificationSent")); closeDialog(); }
  };

  const toggleVerified = async (u: UserProfile) => {
    const { error } = await supabase.from("profiles")
      .update({ is_verified: !u.is_verified }).eq("user_id", u.user_id);
    if (error) toast.error(error.message);
    else { toast.success(u.is_verified ? t("admin.users.verificationRemoved") : t("admin.users.verified")); load(); }
  };

  const statusBadge = (u: UserProfile) => {
    if (u.status === "banned") return <Badge className="bg-red-600">{t("admin.users.status.banned")}</Badge>;
    if (u.status === "suspended") return <Badge className="bg-orange-500">{t("admin.users.status.suspended")}</Badge>;
    return <Badge className="bg-green-600">{t("admin.users.status.active")}</Badge>;
  };

  const filtered = users.filter(u =>
    !debouncedSearch || (u.display_name || "").toLowerCase().includes(debouncedSearch.toLowerCase()) ||
    u.user_id.includes(debouncedSearch)
  );

  return (
    <Layout>
      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="mb-6 flex items-center gap-3">
          <Button asChild variant="ghost" size="icon"><Link to="/admin" aria-label="Back to admin"><ArrowLeft className="h-5 w-5" aria-hidden="true" /></Link></Button>
          <h1 className="text-3xl font-bold">{t("admin.users.title")}</h1>
          <Badge variant="secondary">{t("admin.users.total").replace("{count}", String(users.length))}</Badge>
        </div>

        <div className="mb-4 flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder={t("admin.users.searchPlaceholder")} value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.users.user")}</TableHead>
                    <TableHead>{t("admin.requests.status")}</TableHead>
                    <TableHead>{t("admin.users.role")}</TableHead>
                    <TableHead>{t("admin.content.field.points")}</TableHead>
                    <TableHead>{t("admin.users.device")}</TableHead>
                    <TableHead>{t("admin.users.verifiedColumn")}</TableHead>
                    <TableHead>{t("admin.users.joined")}</TableHead>
                    <TableHead>{t("admin.common.actions")}</TableHead>
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
                        {u.isAdmin ? <Badge className="bg-primary">{t("admin.users.admin")}</Badge> : <Badge variant="secondary">{t("admin.users.regularUser")}</Badge>}
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1 font-mono text-sm">
                          <Coins className="h-3 w-3 text-yellow-500" />{u.points}
                        </span>
                      </TableCell>
                      <TableCell>
                        {u.device_ids && u.device_ids.length > 0 ? (
                          <span
                            className="flex items-center gap-1 font-mono text-xs text-muted-foreground"
                            title={u.device_ids.join(", ")}
                          >
                            <Fingerprint className="h-3 w-3 shrink-0" />
                            {u.device_ids[0].slice(0, 8)}…
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
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
                              {t("admin.moderation.action")} <ChevronDown className="ms-1 h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openDialog(u, "points")}>
                              <Coins className="me-2 h-4 w-4 text-yellow-500" /> {t("admin.users.grantPoints")}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openDialog(u, "features")}>
                              <Star className="me-2 h-4 w-4 text-purple-500" /> {t("admin.users.manageFeatures")}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openDialog(u, "notify")}>
                              <Bell className="me-2 h-4 w-4 text-blue-500" /> {t("admin.users.sendNotification")}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => toggleAdmin(u)} disabled={u.user_id === currentUser?.id}>
                              {u.isAdmin
                                ? <><ShieldOff className="me-2 h-4 w-4 text-red-500" /> {t("admin.users.removeAdmin")}</>
                                : <><ShieldCheck className="me-2 h-4 w-4 text-green-500" /> {t("admin.users.makeAdmin")}</>}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {u.status === "active" ? (
                              <>
                                <DropdownMenuItem onClick={() => openDialog(u, "suspend")} className="text-orange-600">
                                  <Clock className="me-2 h-4 w-4" /> {t("admin.users.suspendTemp")}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openDialog(u, "ban")} className="text-red-600">
                                  <Ban className="me-2 h-4 w-4" /> {t("admin.users.permanentBan")}
                                </DropdownMenuItem>
                              </>
                            ) : (
                              <DropdownMenuItem onClick={() => unbanUser(u)} className="text-green-600">
                                <CheckCircle className="me-2 h-4 w-4" /> {t("admin.users.unban")}
                              </DropdownMenuItem>
                            )}
                            {u.device_ids && u.device_ids.length > 0 && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => openDialog(u, "device_ban")} className="text-red-700">
                                  <Fingerprint className="me-2 h-4 w-4" /> {t("admin.users.banDevice")}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => unbanDevice(u)} className="text-green-700">
                                  <CheckCircle className="me-2 h-4 w-4" /> {t("admin.users.unbanDevice")}
                                </DropdownMenuItem>
                              </>
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
          <DialogHeader><DialogTitle className="text-red-600">{t("admin.users.banUserTitle").replace("{name}", selected?.display_name || "")}</DialogTitle></DialogHeader>
          <Label>{t("admin.users.banReason")}</Label>
          <Textarea value={banReason} onChange={e => setBanReason(e.target.value)} placeholder={t("admin.users.banReasonPlaceholder")} />
          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog}>{t("common.cancel")}</Button>
            <Button variant="destructive" onClick={banUser} disabled={loading || !banReason}>
              {loading ? t("admin.users.banning") : t("admin.users.confirmBan")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Device Ban Dialog */}
      <Dialog open={dialog === "device_ban"} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-700 flex items-center gap-2">
              <Fingerprint className="h-5 w-5" />
              {t("admin.users.banDeviceTitle").replace("{name}", selected?.display_name || "")}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("admin.users.banDeviceDesc")}
          </p>
          {selected?.device_ids && selected.device_ids.length > 0 && (
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">{t("admin.users.deviceIds")}</p>
              {selected.device_ids.map(d => (
                <p key={d} className="font-mono text-xs break-all">{d}</p>
              ))}
            </div>
          )}
          <Label>{t("admin.users.banReason")}</Label>
          <Textarea value={deviceBanReason} onChange={e => setDeviceBanReason(e.target.value)} placeholder={t("admin.users.deviceBanPlaceholder")} />
          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog}>{t("common.cancel")}</Button>
            <Button variant="destructive" onClick={banDevice} disabled={loading || !deviceBanReason}>
              {loading ? t("admin.users.banning") : t("admin.users.banDevice")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend Dialog */}
      <Dialog open={dialog === "suspend"} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-orange-600">{t("admin.users.suspendTitle").replace("{name}", selected?.display_name || "")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("admin.users.suspendDuration")}</Label>
              <Select value={suspendDays} onValueChange={setSuspendDays}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">{t("admin.users.duration.oneDay")}</SelectItem>
                  <SelectItem value="3">{t("admin.users.duration.threeDays")}</SelectItem>
                  <SelectItem value="7">{t("admin.users.duration.week")}</SelectItem>
                  <SelectItem value="14">{t("admin.users.duration.twoWeeks")}</SelectItem>
                  <SelectItem value="30">{t("admin.users.duration.month")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("admin.vx.reason")} {t("admin.vx.optional")}</Label>
              <Textarea value={suspendReason} onChange={e => setSuspendReason(e.target.value)} placeholder={t("admin.users.suspendReasonPlaceholder")} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog}>{t("common.cancel")}</Button>
            <Button className="bg-orange-600 hover:bg-orange-700" onClick={suspendUser} disabled={loading}>
              {loading ? t("admin.users.suspending") : t("admin.users.confirmSuspend")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Points Dialog */}
      <Dialog open={dialog === "points"} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("admin.users.grantPointsTitle").replace("{name}", selected?.display_name || "")}</DialogTitle></DialogHeader>
          <div className="text-sm text-muted-foreground">{t("admin.users.currentBalance")} <span className="font-bold text-yellow-500">{t("admin.users.pointsCount").replace("{points}", String(selected?.points ?? 0))}</span></div>
          <div className="space-y-4">
            <div>
              <Label>{t("admin.users.pointsAmount")}</Label>
              <Input type="number" value={pointsAmount} onChange={e => setPointsAmount(e.target.value)} min="1" />
            </div>
            <div>
              <Label>{t("admin.vx.reason")}</Label>
              <Input value={pointsReason} onChange={e => setPointsReason(e.target.value)} placeholder={t("admin.users.pointsReasonPlaceholder")} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog}>{t("common.cancel")}</Button>
            <Button onClick={grantPoints} disabled={loading || !pointsAmount}>
              {loading ? t("admin.users.granting") : t("admin.users.grantPoints")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Features Dialog */}
      <Dialog open={dialog === "features"} onOpenChange={closeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("admin.users.manageFeaturesTitle").replace("{name}", selected?.display_name || "")}</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {FEATURES.map(f => (
              <div key={f.key} className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm font-medium">{t(`admin.users.feature.${f}`)}</span>
                <Switch
                  checked={userFeatures[f.key] ?? false}
                  onCheckedChange={v => setUserFeatures(prev => ({ ...prev, [f.key]: v }))}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog}>{t("common.cancel")}</Button>
            <Button onClick={saveFeatures} disabled={loading}>
              {loading ? t("admin.settings.saving") : t("admin.users.saveFeatures")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notification Dialog */}
      <Dialog open={dialog === "notify"} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("admin.users.sendNotificationTitle").replace("{name}", selected?.display_name || "")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("admin.users.notificationType")}</Label>
              <Select value={notifyType} onValueChange={setNotifyType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">{t("admin.users.notify.info")}</SelectItem>
                  <SelectItem value="success">{t("admin.users.notify.success")}</SelectItem>
                  <SelectItem value="warning">{t("admin.users.notify.warning")}</SelectItem>
                  <SelectItem value="error">{t("admin.users.notify.error")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("admin.content.field.title")}</Label>
              <Input value={notifyTitle} onChange={e => setNotifyTitle(e.target.value)} placeholder={t("admin.users.notificationTitlePlaceholder")} />
            </div>
            <div>
              <Label>{t("admin.requests.message")}</Label>
              <Textarea value={notifyBody} onChange={e => setNotifyBody(e.target.value)} placeholder={t("admin.users.notificationBodyPlaceholder")} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog}>{t("common.cancel")}</Button>
            <Button onClick={sendNotification} disabled={loading || !notifyTitle || !notifyBody}>
              {loading ? t("admin.users.sending") : t("admin.users.sendNotification")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
