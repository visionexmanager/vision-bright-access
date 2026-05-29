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
  ArrowLeft, Radio, Plus, Pencil, Trash2, Users, Star, RefreshCw, Eye, EyeOff,
} from "lucide-react";

type Genre = { id: string; name: string; name_ar: string; slug: string; icon: string; sort_order: number };
type Station = {
  id: string; name: string; name_ar: string; logo_url: string | null;
  stream_url: string; genre_id: string | null; bitrate: string; language: string;
  country: string | null; website_url: string | null;
  is_active: boolean; is_featured: boolean; sort_order: number;
  genre?: { name_ar: string };
};
type Subscription = {
  id: string; user_id: string; plan_name: string; plan_name_ar: string;
  expires_at: string; started_at: string; vx_paid: number; status: string;
  display_name?: string;
};

const EMPTY_STATION: Omit<Station, "id"> = {
  name: "", name_ar: "", logo_url: "", stream_url: "", genre_id: null,
  bitrate: "128", language: "ar", country: "", website_url: "",
  is_active: true, is_featured: false, sort_order: 0,
};

export default function AdminRadio() {
  const [stations,      setStations]      = useState<Station[]>([]);
  const [genres,        setGenres]        = useState<Genre[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [showStreamUrl, setShowStreamUrl] = useState<Record<string, boolean>>({});

  // Station form dialog
  const [stationDialog,  setStationDialog]  = useState(false);
  const [editingStation, setEditingStation] = useState<Station | null>(null);
  const [stationForm,    setStationForm]    = useState<Omit<Station, "id">>(EMPTY_STATION);
  const [saving,         setSaving]         = useState(false);

  // Genre form dialog
  const [genreDialog,  setGenreDialog]  = useState(false);
  const [genreForm,    setGenreForm]    = useState<Omit<Genre, "id">>({ name: "", name_ar: "", slug: "", icon: "radio", sort_order: 0 });
  const [editingGenre, setEditingGenre] = useState<Genre | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: st }, { data: gn }, { data: subs }] = await Promise.all([
      supabase.from("radio_stations").select("*, genre:radio_genres(name_ar)").order("sort_order"),
      supabase.from("radio_genres").select("*").order("sort_order"),
      supabase.from("radio_subscriptions")
        .select("id, user_id, plan_id, started_at, expires_at, vx_paid, status, plan:radio_subscription_plans(name, name_ar)")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    setStations((st ?? []) as Station[]);
    setGenres((gn ?? []) as Genre[]);

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

  // ── Station CRUD ──────────────────────────────────────────────
  const openNewStation = () => {
    setEditingStation(null);
    setStationForm(EMPTY_STATION);
    setStationDialog(true);
  };

  const openEditStation = (st: Station) => {
    setEditingStation(st);
    setStationForm({ ...st });
    setStationDialog(true);
  };

  const saveStation = async () => {
    if (!stationForm.name || !stationForm.name_ar || !stationForm.stream_url) {
      toast.error("يرجى ملء الحقول الإلزامية: الاسم، الاسم بالعربية، رابط البث");
      return;
    }
    setSaving(true);
    const payload = {
      name:        stationForm.name,
      name_ar:     stationForm.name_ar,
      logo_url:    stationForm.logo_url || null,
      stream_url:  stationForm.stream_url,
      genre_id:    stationForm.genre_id || null,
      bitrate:     stationForm.bitrate,
      language:    stationForm.language,
      country:     stationForm.country || null,
      website_url: stationForm.website_url || null,
      is_active:   stationForm.is_active,
      is_featured: stationForm.is_featured,
      sort_order:  stationForm.sort_order,
    };

    if (editingStation) {
      const { error } = await supabase.from("radio_stations").update(payload).eq("id", editingStation.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success("تم تحديث المحطة");
    } else {
      const { error } = await supabase.from("radio_stations").insert(payload);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success("تم إضافة المحطة");
    }
    setSaving(false);
    setStationDialog(false);
    load();
  };

  const deleteStation = async (id: string) => {
    if (!confirm("هل تريد حذف هذه المحطة نهائياً؟")) return;
    const { error } = await supabase.from("radio_stations").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم حذف المحطة");
    setStations(prev => prev.filter(s => s.id !== id));
  };

  const toggleStation = async (st: Station) => {
    const { error } = await supabase.from("radio_stations").update({ is_active: !st.is_active }).eq("id", st.id);
    if (error) { toast.error(error.message); return; }
    setStations(prev => prev.map(s => s.id === st.id ? { ...s, is_active: !s.is_active } : s));
  };

  // ── Genre CRUD ────────────────────────────────────────────────
  const openNewGenre = () => {
    setEditingGenre(null);
    setGenreForm({ name: "", name_ar: "", slug: "", icon: "radio", sort_order: 0 });
    setGenreDialog(true);
  };

  const saveGenre = async () => {
    if (!genreForm.name || !genreForm.name_ar || !genreForm.slug) {
      toast.error("جميع الحقول مطلوبة");
      return;
    }
    setSaving(true);
    if (editingGenre) {
      const { error } = await supabase.from("radio_genres").update(genreForm).eq("id", editingGenre.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success("تم تحديث النوع");
    } else {
      const { error } = await supabase.from("radio_genres").insert(genreForm);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success("تم إضافة النوع");
    }
    setSaving(false);
    setGenreDialog(false);
    load();
  };

  const deleteGenre = async (id: string) => {
    if (!confirm("حذف هذا النوع؟")) return;
    const { error } = await supabase.from("radio_genres").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setGenres(prev => prev.filter(g => g.id !== id));
    toast.success("تم الحذف");
  };

  const statusColor = (s: string) => {
    if (s === "active")    return "bg-green-500/10 text-green-600 border-green-500/30";
    if (s === "expired")   return "bg-red-500/10   text-red-600   border-red-500/30";
    if (s === "cancelled") return "bg-gray-500/10  text-gray-500  border-gray-500/30";
    return "bg-gray-500/10 text-gray-500";
  };

  const activeCount  = subscriptions.filter(s => s.status === "active").length;
  const totalRevenue = subscriptions.reduce((sum, s) => sum + s.vx_paid, 0);

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
                <Radio className="w-6 h-6 text-orange-500" /> إدارة VisionRadio
              </h1>
              <p className="text-sm text-muted-foreground">إدارة المحطات وأنواعها ومشتركي خدمة الراديو المباشر</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            تحديث
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "إجمالي المحطات",   value: stations.length,                      color: "text-orange-500" },
            { label: "المحطات النشطة",    value: stations.filter(s => s.is_active).length, color: "text-green-500" },
            { label: "اشتراكات نشطة",     value: activeCount,                          color: "text-purple-500" },
            { label: "إجمالي الإيرادات",  value: `${totalRevenue.toLocaleString()} VX`, color: "text-yellow-500" },
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
        <Tabs defaultValue="stations">
          <TabsList className="mb-4">
            <TabsTrigger value="stations">المحطات ({stations.length})</TabsTrigger>
            <TabsTrigger value="genres">الأنواع ({genres.length})</TabsTrigger>
            <TabsTrigger value="subscribers">المشتركون ({subscriptions.length})</TabsTrigger>
          </TabsList>

          {/* ── Stations Tab ─────────────────────────────────── */}
          <TabsContent value="stations">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base">قائمة المحطات</CardTitle>
                <Button size="sm" onClick={openNewStation} className="gap-2">
                  <Plus className="w-4 h-4" /> إضافة محطة
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">المحطة</TableHead>
                        <TableHead className="text-right">النوع</TableHead>
                        <TableHead className="text-right">البث</TableHead>
                        <TableHead className="text-right">مميزة</TableHead>
                        <TableHead className="text-right">الحالة</TableHead>
                        <TableHead className="text-right">رابط البث</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stations.map(st => (
                        <TableRow key={st.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {st.logo_url
                                ? <img src={st.logo_url} alt={st.name_ar} className="w-8 h-8 rounded object-cover" />
                                : <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                                    <Radio className="w-4 h-4 text-muted-foreground" />
                                  </div>
                              }
                              <div>
                                <p className="font-medium text-sm">{st.name_ar}</p>
                                <p className="text-xs text-muted-foreground">{st.name}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{st.genre?.name_ar ?? "—"}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {st.bitrate === "HI" ? "HI-FI" : `${st.bitrate}k`}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {st.is_featured && <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />}
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={st.is_active}
                              onCheckedChange={() => toggleStation(st)}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost" size="icon"
                              onClick={() => setShowStreamUrl(p => ({ ...p, [st.id]: !p[st.id] }))}
                              className="h-7 w-7"
                              title="عرض/إخفاء رابط البث"
                            >
                              {showStreamUrl[st.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </Button>
                            {showStreamUrl[st.id] && (
                              <p className="text-[10px] text-muted-foreground max-w-[200px] truncate mt-1 font-mono">
                                {st.stream_url}
                              </p>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditStation(st)}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteStation(st.id)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {stations.length === 0 && !loading && (
                    <p className="text-center text-muted-foreground py-8 text-sm">لا توجد محطات بعد — أضف المحطة الأولى</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Genres Tab ──────────────────────────────────── */}
          <TabsContent value="genres">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base">أنواع المحطات</CardTitle>
                <Button size="sm" onClick={openNewGenre} className="gap-2">
                  <Plus className="w-4 h-4" /> إضافة نوع
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">الاسم بالعربية</TableHead>
                      <TableHead className="text-right">الاسم بالإنجليزية</TableHead>
                      <TableHead className="text-right">Slug</TableHead>
                      <TableHead className="text-right">الأيقونة</TableHead>
                      <TableHead className="text-right">الترتيب</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {genres.map(genre => (
                      <TableRow key={genre.id}>
                        <TableCell className="font-medium">{genre.name_ar}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{genre.name}</TableCell>
                        <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{genre.slug}</code></TableCell>
                        <TableCell className="text-sm">{genre.icon}</TableCell>
                        <TableCell className="text-sm">{genre.sort_order}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7"
                              onClick={() => { setEditingGenre(genre); setGenreForm({ ...genre }); setGenreDialog(true); }}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => deleteGenre(genre.id)}>
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
                  <Users className="w-5 h-5 text-purple-500" /> المشتركون
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">المستخدم</TableHead>
                        <TableHead className="text-right">الخطة</TableHead>
                        <TableHead className="text-right">تاريخ الاشتراك</TableHead>
                        <TableHead className="text-right">تاريخ الانتهاء</TableHead>
                        <TableHead className="text-right">VX المدفوعة</TableHead>
                        <TableHead className="text-right">الحالة</TableHead>
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
                              {sub.status === "active" ? "نشط" : sub.status === "expired" ? "منتهٍ" : "ملغى"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {subscriptions.length === 0 && (
                    <p className="text-center text-muted-foreground py-8 text-sm">لا يوجد مشتركون بعد</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Station Dialog ──────────────────────────────────────── */}
      <Dialog open={stationDialog} onOpenChange={setStationDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingStation ? "تعديل المحطة" : "إضافة محطة جديدة"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>الاسم بالعربية *</Label>
                <Input value={stationForm.name_ar} onChange={e => setStationForm(p => ({ ...p, name_ar: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>الاسم بالإنجليزية *</Label>
                <Input value={stationForm.name} onChange={e => setStationForm(p => ({ ...p, name: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-1">
              <Label>رابط البث (MP3 / AAC / HLS .m3u8) *</Label>
              <Input
                value={stationForm.stream_url}
                onChange={e => setStationForm(p => ({ ...p, stream_url: e.target.value }))}
                placeholder="https://…/stream.mp3"
                className="font-mono text-sm"
                dir="ltr"
              />
            </div>

            <div className="space-y-1">
              <Label>رابط الشعار (Logo URL)</Label>
              <Input
                value={stationForm.logo_url ?? ""}
                onChange={e => setStationForm(p => ({ ...p, logo_url: e.target.value }))}
                placeholder="https://…/logo.png"
                dir="ltr"
              />
            </div>

            <div className="space-y-1">
              <Label>الموقع الرسمي (اختياري)</Label>
              <Input
                value={stationForm.website_url ?? ""}
                onChange={e => setStationForm(p => ({ ...p, website_url: e.target.value }))}
                placeholder="https://station.com"
                dir="ltr"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>النوع</Label>
                <Select
                  value={stationForm.genre_id ?? "none"}
                  onValueChange={v => setStationForm(p => ({ ...p, genre_id: v === "none" ? null : v }))}
                >
                  <SelectTrigger><SelectValue placeholder="اختر نوعاً" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">بدون تصنيف</SelectItem>
                    {genres.map(g => <SelectItem key={g.id} value={g.id}>{g.name_ar}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>جودة البث (kbps)</Label>
                <Select value={stationForm.bitrate} onValueChange={v => setStationForm(p => ({ ...p, bitrate: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["64","128","192","320","HI"].map(b => (
                      <SelectItem key={b} value={b}>{b === "HI" ? "HI-FI" : `${b} kbps`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>اللغة</Label>
                <Input value={stationForm.language} onChange={e => setStationForm(p => ({ ...p, language: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>الدولة</Label>
                <Input value={stationForm.country ?? ""} onChange={e => setStationForm(p => ({ ...p, country: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-1">
              <Label>الترتيب</Label>
              <Input
                type="number" value={stationForm.sort_order}
                onChange={e => setStationForm(p => ({ ...p, sort_order: Number(e.target.value) }))}
              />
            </div>

            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={stationForm.is_active} onCheckedChange={v => setStationForm(p => ({ ...p, is_active: v }))} />
                <Label>نشطة</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={stationForm.is_featured} onCheckedChange={v => setStationForm(p => ({ ...p, is_featured: v }))} />
                <Label>مميزة ⭐</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setStationDialog(false)}>إلغاء</Button>
            <Button onClick={saveStation} disabled={saving}>
              {saving ? "جاري الحفظ…" : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Genre Dialog ────────────────────────────────────────── */}
      <Dialog open={genreDialog} onOpenChange={setGenreDialog}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingGenre ? "تعديل النوع" : "إضافة نوع جديد"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>الاسم بالعربية *</Label>
              <Input value={genreForm.name_ar} onChange={e => setGenreForm(p => ({ ...p, name_ar: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>الاسم بالإنجليزية *</Label>
              <Input value={genreForm.name} onChange={e => setGenreForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Slug (مثال: news) *</Label>
              <Input
                value={genreForm.slug}
                onChange={e => setGenreForm(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") }))}
                dir="ltr"
              />
            </div>
            <div className="space-y-1">
              <Label>أيقونة (اسم من Lucide)</Label>
              <Input value={genreForm.icon} onChange={e => setGenreForm(p => ({ ...p, icon: e.target.value }))} dir="ltr" />
            </div>
            <div className="space-y-1">
              <Label>الترتيب</Label>
              <Input type="number" value={genreForm.sort_order} onChange={e => setGenreForm(p => ({ ...p, sort_order: Number(e.target.value) }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenreDialog(false)}>إلغاء</Button>
            <Button onClick={saveGenre} disabled={saving}>{saving ? "جاري الحفظ…" : "حفظ"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
