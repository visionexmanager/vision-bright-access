import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import {
  ArrowLeft, Tv, Plus, Pencil, Trash2, Users, Star, RefreshCw, Eye, EyeOff,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

type Category = { id: string; name: string; name_ar: string; slug: string; icon: string; sort_order: number };
type Channel  = {
  id: string; name: string; name_ar: string; logo_url: string | null;
  stream_url: string; category_id: string | null; quality: string; language: string;
  country: string | null; is_active: boolean; is_featured: boolean; sort_order: number;
  category?: { name_ar: string };
};
type Subscription = {
  id: string; user_id: string; plan_name: string; plan_name_ar: string;
  expires_at: string; started_at: string; vx_paid: number; status: string;
  display_name?: string; email?: string;
};

const EMPTY_CHANNEL: Omit<Channel, "id"> = {
  name: "", name_ar: "", logo_url: "", stream_url: "", category_id: null,
  quality: "HD", language: "ar", country: "", is_active: true, is_featured: false, sort_order: 0,
};

const STATUS_LABEL_KEY: Record<string, string> = {
  active: "admin.tv.status.active",
  expired: "admin.tv.status.expired",
  cancelled: "admin.tv.status.cancelled",
};

export default function AdminTV() {
  const { t } = useLanguage();
  const [channels,      setChannels]      = useState<Channel[]>([]);
  const [categories,    setCategories]    = useState<Category[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [showStreamUrl, setShowStreamUrl] = useState<Record<string, boolean>>({});

  // Channel form dialog
  const [channelDialog,  setChannelDialog]  = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [channelForm,    setChannelForm]    = useState<Omit<Channel, "id">>(EMPTY_CHANNEL);
  const [saving,         setSaving]         = useState(false);

  // Category form dialog
  const [catDialog,  setCatDialog]  = useState(false);
  const [catForm,    setCatForm]    = useState<Omit<Category, "id">>({ name: "", name_ar: "", slug: "", icon: "tv", sort_order: 0 });
  const [editingCat, setEditingCat] = useState<Category | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: ch }, { data: cat }, { data: subs }] = await Promise.all([
      supabase.from("tv_channels").select("*, category:tv_categories(name_ar)").order("sort_order"),
      supabase.from("tv_categories").select("*").order("sort_order"),
      supabase.from("tv_subscriptions")
        .select("id, user_id, plan_id, started_at, expires_at, vx_paid, status, plan:tv_subscription_plans(name, name_ar)")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    setChannels((ch ?? []) as Channel[]);
    setCategories((cat ?? []) as Category[]);

    // Enrich subscriptions with user profile data
    if (subs && subs.length > 0) {
      const userIds = [...new Set(subs.map((s: Record<string, unknown>) => s.user_id as string))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);
      const profileMap: Record<string, string> = {};
      profiles?.forEach((p: { user_id: string; display_name: string | null }) => {
        profileMap[p.user_id] = p.display_name ?? p.user_id;
      });

      setSubscriptions(subs.map((s: Record<string, unknown>) => ({
        id:           s.id as string,
        user_id:      s.user_id as string,
        plan_name:    (s.plan as { name: string } | null)?.name ?? "",
        plan_name_ar: (s.plan as { name_ar: string } | null)?.name_ar ?? "",
        expires_at:   s.expires_at as string,
        started_at:   s.started_at as string,
        vx_paid:      s.vx_paid as number,
        status:       s.status as string,
        display_name: profileMap[s.user_id as string] ?? s.user_id as string,
      })));
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // ── Channel CRUD ──────────────────────────────────────────────
  const openNewChannel = () => {
    setEditingChannel(null);
    setChannelForm(EMPTY_CHANNEL);
    setChannelDialog(true);
  };

  const openEditChannel = (ch: Channel) => {
    setEditingChannel(ch);
    setChannelForm({ ...ch });
    setChannelDialog(true);
  };

  const saveChannel = async () => {
    if (!channelForm.name || !channelForm.name_ar || !channelForm.stream_url) {
      toast.error(t("admin.tv.toast.channelValidation"));
      return;
    }
    setSaving(true);
    const payload = {
      name:        channelForm.name,
      name_ar:     channelForm.name_ar,
      logo_url:    channelForm.logo_url || null,
      stream_url:  channelForm.stream_url,
      category_id: channelForm.category_id || null,
      quality:     channelForm.quality,
      language:    channelForm.language,
      country:     channelForm.country || null,
      is_active:   channelForm.is_active,
      is_featured: channelForm.is_featured,
      sort_order:  channelForm.sort_order,
    };

    if (editingChannel) {
      const { error } = await supabase.from("tv_channels").update(payload).eq("id", editingChannel.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success(t("admin.tv.toast.channelUpdated"));
    } else {
      const { error } = await supabase.from("tv_channels").insert(payload);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success(t("admin.tv.toast.channelAdded"));
    }
    setSaving(false);
    setChannelDialog(false);
    load();
  };

  const deleteChannel = async (id: string) => {
    if (!confirm(t("admin.tv.confirm.deleteChannel"))) return;
    const { error } = await supabase.from("tv_channels").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(t("admin.tv.toast.channelDeleted"));
    setChannels(prev => prev.filter(c => c.id !== id));
  };

  const toggleChannel = async (ch: Channel) => {
    const { error } = await supabase.from("tv_channels").update({ is_active: !ch.is_active }).eq("id", ch.id);
    if (error) { toast.error(error.message); return; }
    setChannels(prev => prev.map(c => c.id === ch.id ? { ...c, is_active: !c.is_active } : c));
  };

  // ── Category CRUD ─────────────────────────────────────────────
  const openNewCat = () => {
    setEditingCat(null);
    setCatForm({ name: "", name_ar: "", slug: "", icon: "tv", sort_order: 0 });
    setCatDialog(true);
  };

  const saveCat = async () => {
    if (!catForm.name || !catForm.name_ar || !catForm.slug) {
      toast.error(t("admin.tv.toast.categoryValidation"));
      return;
    }
    setSaving(true);
    if (editingCat) {
      const { error } = await supabase.from("tv_categories").update(catForm).eq("id", editingCat.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success(t("admin.tv.toast.categoryUpdated"));
    } else {
      const { error } = await supabase.from("tv_categories").insert(catForm);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success(t("admin.tv.toast.categoryAdded"));
    }
    setSaving(false);
    setCatDialog(false);
    load();
  };

  const deleteCat = async (id: string) => {
    if (!confirm(t("admin.tv.confirm.deleteCategory"))) return;
    const { error } = await supabase.from("tv_categories").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setCategories(prev => prev.filter(c => c.id !== id));
    toast.success(t("admin.tv.toast.categoryDeleted"));
  };

  const statusColor = (s: string) => {
    if (s === "active")    return "bg-green-500/10 text-green-600 border-green-500/30";
    if (s === "expired")   return "bg-red-500/10   text-red-600   border-red-500/30";
    if (s === "cancelled") return "bg-gray-500/10  text-gray-500  border-gray-500/30";
    return "bg-gray-500/10 text-gray-500";
  };

  const activeCount   = subscriptions.filter(s => s.status === "active").length;
  const totalRevenue  = subscriptions.reduce((sum, s) => sum + s.vx_paid, 0);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6" dir="rtl">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Link to="/admin" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Tv className="w-6 h-6 text-blue-500" /> {t("admin.tv.title")}
              </h1>
              <p className="text-sm text-muted-foreground">{t("admin.tv.subtitle")}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            {t("admin.tv.refresh")}
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: t("admin.tv.stats.totalChannels"),   value: channels.length,                     color: "text-blue-500" },
            { label: t("admin.tv.stats.activeChannels"),   value: channels.filter(c => c.is_active).length, color: "text-green-500" },
            { label: t("admin.tv.stats.activeSubscriptions"),    value: activeCount,                         color: "text-purple-500" },
            { label: t("admin.tv.stats.totalRevenue"), value: `${totalRevenue.toLocaleString()} VX`, color: "text-yellow-500" },
          ].map(({ label, value, color }) => (
            <Card key={label}>
              <CardContent className="pt-5 pb-4 text-center">
                <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
                <p className="text-xs text-muted-foreground mt-1">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="channels">
          <TabsList className="mb-4">
            <TabsTrigger value="channels">{t("admin.tv.tabs.channels")} ({channels.length})</TabsTrigger>
            <TabsTrigger value="categories">{t("admin.tv.tabs.categories")} ({categories.length})</TabsTrigger>
            <TabsTrigger value="subscribers">{t("admin.tv.tabs.subscribers")} ({subscriptions.length})</TabsTrigger>
          </TabsList>

          {/* ── Channels Tab ─────────────────────────────────── */}
          <TabsContent value="channels">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base">{t("admin.tv.channelsList")}</CardTitle>
                <Button size="sm" onClick={openNewChannel} className="gap-2">
                  <Plus className="w-4 h-4" /> {t("admin.tv.addChannel")}
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">{t("admin.tv.table.channel")}</TableHead>
                        <TableHead className="text-right">{t("admin.tv.table.category")}</TableHead>
                        <TableHead className="text-right">{t("admin.tv.table.quality")}</TableHead>
                        <TableHead className="text-right">{t("admin.tv.table.featured")}</TableHead>
                        <TableHead className="text-right">{t("admin.tv.table.status")}</TableHead>
                        <TableHead className="text-right">{t("admin.tv.table.stream")}</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {channels.map(ch => (
                        <TableRow key={ch.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {ch.logo_url
                                ? <img src={ch.logo_url} alt={ch.name_ar} className="w-8 h-8 rounded object-cover" />
                                : <div className="w-8 h-8 rounded bg-muted flex items-center justify-center"><Tv className="w-4 h-4 text-muted-foreground" /></div>
                              }
                              <div>
                                <p className="font-medium text-sm">{ch.name_ar}</p>
                                <p className="text-xs text-muted-foreground">{ch.name}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{ch.category?.name_ar ?? "—"}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{ch.quality}</Badge>
                          </TableCell>
                          <TableCell>
                            {ch.is_featured && <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />}
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={ch.is_active}
                              onCheckedChange={() => toggleChannel(ch)}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost" size="icon"
                              onClick={() => setShowStreamUrl(p => ({ ...p, [ch.id]: !p[ch.id] }))}
                              className="h-7 w-7"
                              title={t("admin.tv.toggleStreamUrl")}
                            >
                              {showStreamUrl[ch.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </Button>
                            {showStreamUrl[ch.id] && (
                              <p className="text-[10px] text-muted-foreground max-w-[200px] truncate mt-1 font-mono">
                                {ch.stream_url}
                              </p>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditChannel(ch)}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteChannel(ch.id)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {channels.length === 0 && !loading && (
                    <p className="text-center text-muted-foreground py-8 text-sm">{t("admin.tv.noChannels")}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Categories Tab ───────────────────────────────── */}
          <TabsContent value="categories">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base">{t("admin.tv.categoriesList")}</CardTitle>
                <Button size="sm" onClick={openNewCat} className="gap-2">
                  <Plus className="w-4 h-4" /> {t("admin.tv.addCategory")}
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">{t("admin.tv.table.nameAr")}</TableHead>
                      <TableHead className="text-right">{t("admin.tv.table.nameEn")}</TableHead>
                      <TableHead className="text-right">{t("admin.tv.table.slug")}</TableHead>
                      <TableHead className="text-right">{t("admin.tv.table.icon")}</TableHead>
                      <TableHead className="text-right">{t("admin.tv.table.sortOrder")}</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map(cat => (
                      <TableRow key={cat.id}>
                        <TableCell className="font-medium">{cat.name_ar}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{cat.name}</TableCell>
                        <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{cat.slug}</code></TableCell>
                        <TableCell className="text-sm">{cat.icon}</TableCell>
                        <TableCell className="text-sm">{cat.sort_order}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7"
                              onClick={() => { setEditingCat(cat); setCatForm({ ...cat }); setCatDialog(true); }}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => deleteCat(cat.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Subscribers Tab ──────────────────────────────── */}
          <TabsContent value="subscribers">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-500" /> {t("admin.tv.subscribersList")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">{t("admin.tv.table.user")}</TableHead>
                        <TableHead className="text-right">{t("admin.tv.table.plan")}</TableHead>
                        <TableHead className="text-right">{t("admin.tv.table.startDate")}</TableHead>
                        <TableHead className="text-right">{t("admin.tv.table.expiryDate")}</TableHead>
                        <TableHead className="text-right">{t("admin.tv.table.vxPaid")}</TableHead>
                        <TableHead className="text-right">{t("admin.tv.table.status")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subscriptions.map(sub => (
                        <TableRow key={sub.id}>
                          <TableCell className="font-medium text-sm">{sub.display_name}</TableCell>
                          <TableCell className="text-sm">{sub.plan_name_ar}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(sub.started_at).toLocaleDateString("ar-EG")}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(sub.expires_at).toLocaleDateString("ar-EG")}
                          </TableCell>
                          <TableCell className="text-sm font-medium">
                            {sub.vx_paid.toLocaleString()} VX
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-xs ${statusColor(sub.status)}`}>
                              {t(STATUS_LABEL_KEY[sub.status] ?? STATUS_LABEL_KEY.cancelled)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {subscriptions.length === 0 && (
                    <p className="text-center text-muted-foreground py-8 text-sm">{t("admin.tv.noSubscribers")}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Channel Dialog ──────────────────────────────────────── */}
      <Dialog open={channelDialog} onOpenChange={setChannelDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingChannel ? t("admin.tv.dialog.editChannelTitle") : t("admin.tv.dialog.newChannelTitle")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{t("admin.tv.form.nameArRequired")}</Label>
                <Input value={channelForm.name_ar} onChange={e => setChannelForm(p => ({ ...p, name_ar: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>{t("admin.tv.form.nameEnRequired")}</Label>
                <Input value={channelForm.name} onChange={e => setChannelForm(p => ({ ...p, name: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-1">
              <Label>{t("admin.tv.form.streamUrl")}</Label>
              <Input
                value={channelForm.stream_url}
                onChange={e => setChannelForm(p => ({ ...p, stream_url: e.target.value }))}
                placeholder="https://…/stream.m3u8"
                className="font-mono text-sm"
                dir="ltr"
              />
            </div>

            <div className="space-y-1">
              <Label>{t("admin.tv.form.logoUrl")}</Label>
              <Input
                value={channelForm.logo_url ?? ""}
                onChange={e => setChannelForm(p => ({ ...p, logo_url: e.target.value }))}
                placeholder="https://…/logo.png"
                dir="ltr"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{t("admin.tv.form.category")}</Label>
                <Select
                  value={channelForm.category_id ?? "none"}
                  onValueChange={v => setChannelForm(p => ({ ...p, category_id: v === "none" ? null : v }))}
                >
                  <SelectTrigger><SelectValue placeholder={t("admin.tv.form.selectCategory")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("admin.tv.form.noCategory")}</SelectItem>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name_ar}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{t("admin.tv.form.quality")}</Label>
                <Select value={channelForm.quality} onValueChange={v => setChannelForm(p => ({ ...p, quality: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["SD","HD","FHD","4K"].map(q => <SelectItem key={q} value={q}>{q}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{t("admin.tv.form.language")}</Label>
                <Input value={channelForm.language} onChange={e => setChannelForm(p => ({ ...p, language: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>{t("admin.tv.form.country")}</Label>
                <Input value={channelForm.country ?? ""} onChange={e => setChannelForm(p => ({ ...p, country: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-1">
              <Label>{t("admin.tv.form.sortOrder")}</Label>
              <Input
                type="number" value={channelForm.sort_order}
                onChange={e => setChannelForm(p => ({ ...p, sort_order: Number(e.target.value) }))}
              />
            </div>

            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={channelForm.is_active} onCheckedChange={v => setChannelForm(p => ({ ...p, is_active: v }))} />
                <Label>{t("admin.tv.form.active")}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={channelForm.is_featured} onCheckedChange={v => setChannelForm(p => ({ ...p, is_featured: v }))} />
                <Label>{t("admin.tv.form.featured")}</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setChannelDialog(false)}>{t("admin.tv.cancel")}</Button>
            <Button onClick={saveChannel} disabled={saving}>
              {saving ? t("admin.tv.savingEllipsis") : t("admin.tv.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Category Dialog ─────────────────────────────────────── */}
      <Dialog open={catDialog} onOpenChange={setCatDialog}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingCat ? t("admin.tv.dialog.editCategoryTitle") : t("admin.tv.dialog.newCategoryTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>{t("admin.tv.form.nameArRequired")}</Label>
              <Input value={catForm.name_ar} onChange={e => setCatForm(p => ({ ...p, name_ar: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>{t("admin.tv.form.nameEnRequired")}</Label>
              <Input value={catForm.name} onChange={e => setCatForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>{t("admin.tv.form.slugLabel")}</Label>
              <Input value={catForm.slug} onChange={e => setCatForm(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") }))} dir="ltr" />
            </div>
            <div className="space-y-1">
              <Label>{t("admin.tv.form.iconLabel")}</Label>
              <Input value={catForm.icon} onChange={e => setCatForm(p => ({ ...p, icon: e.target.value }))} dir="ltr" />
            </div>
            <div className="space-y-1">
              <Label>{t("admin.tv.form.sortOrder")}</Label>
              <Input type="number" value={catForm.sort_order} onChange={e => setCatForm(p => ({ ...p, sort_order: Number(e.target.value) }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDialog(false)}>{t("admin.tv.cancel")}</Button>
            <Button onClick={saveCat} disabled={saving}>{saving ? t("admin.tv.savingEllipsis") : t("admin.tv.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
