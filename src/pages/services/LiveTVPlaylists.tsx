/**
 * LiveTVPlaylists
 *
 * User-managed playlist imports. Supports:
 *  • M3U URL  — paste a public M3U playlist URL
 *  • M3U text — paste raw M3U content
 *  • Xtream Codes API — server + username + password
 *
 * Playlists are stored in tv_user_playlists (Supabase).
 * Parsed channels are shown inline; the user can play them directly
 * using OfficialStreamPlayer without needing a subscription token
 * (these are their own streams, not Visionex's protected catalogue).
 */

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft, ArrowRight, List, Plus, Trash2, RefreshCw,
  Loader2, Tv, AlertCircle, ChevronDown, ChevronUp, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { TVSectionNav } from "@/components/tv/TVSectionNav";
import { parseM3U, countM3UChannels, type M3UChannel } from "@/lib/m3uParser";
import { OfficialStreamPlayer } from "@/components/OfficialStreamPlayer";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type UserPlaylist = {
  id:            string;
  name:          string;
  type:          "m3u" | "xtream" | "url";
  source_url:    string | null;
  xtream_host:   string | null;
  xtream_user:   string | null;
  channel_count: number;
  last_synced_at: string | null;
  created_at:    string;
};

const EMPTY_M3U   = { name: "", url: "" };
const EMPTY_PASTE = { name: "", content: "" };
const EMPTY_XTREAM = { name: "", host: "", user: "", pass: "" };

export default function LiveTVPlaylists() {
  const { user }  = useAuth();
  const { dir }   = useLanguage();
  const isRTL     = dir === "rtl";
  const BackIcon  = isRTL ? ArrowRight : ArrowLeft;
  const qc        = useQueryClient();

  const [addOpen,    setAddOpen]    = useState(false);
  const [addTab,     setAddTab]     = useState<"url" | "paste" | "xtream">("url");
  const [formM3U,    setFormM3U]    = useState(EMPTY_M3U);
  const [formPaste,  setFormPaste]  = useState(EMPTY_PASTE);
  const [formXtream, setFormXtream] = useState(EMPTY_XTREAM);
  const [saving,     setSaving]     = useState(false);

  // Currently playing channel from user playlist
  const [nowPlaying, setNowPlaying] = useState<M3UChannel | null>(null);

  // Expanded playlist (shows channel list)
  const [expanded, setExpanded] = useState<string | null>(null);
  const [parsed,   setParsed]   = useState<Record<string, M3UChannel[]>>({});

  const { data: playlists = [], isLoading } = useQuery<UserPlaylist[]>({
    queryKey: ["tv-user-playlists", user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tv_user_playlists")
        .select("id,name,type,source_url,xtream_host,xtream_user,channel_count,last_synced_at,created_at")
        .eq("user_id", user!.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as UserPlaylist[];
    },
  });

  // ── Add M3U by URL ──────────────────────────────────────────
  const saveUrlPlaylist = useCallback(async () => {
    if (!user || !formM3U.name.trim() || !formM3U.url.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    setSaving(true);
    try {
      // Fetch & count channels from the URL
      const res  = await fetch(formM3U.url.trim(), { mode: "cors" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text  = await res.text();
      const count = countM3UChannels(text);

      const { error } = await supabase.from("tv_user_playlists").insert({
        user_id:       user.id,
        name:          formM3U.name.trim(),
        type:          "url",
        source_url:    formM3U.url.trim(),
        channel_count: count,
        last_synced_at: new Date().toISOString(),
      });
      if (error) throw error;

      toast.success(`Playlist imported — ${count} channels`);
      qc.invalidateQueries({ queryKey: ["tv-user-playlists", user.id] });
      setAddOpen(false);
      setFormM3U(EMPTY_M3U);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast.error(`Failed to import: ${msg}`);
    } finally {
      setSaving(false);
    }
  }, [user, formM3U, qc]);

  // ── Add M3U by pasting content ──────────────────────────────
  const savePastedPlaylist = useCallback(async () => {
    if (!user || !formPaste.name.trim() || !formPaste.content.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    setSaving(true);
    try {
      const count = countM3UChannels(formPaste.content);
      if (count === 0) throw new Error("No channels found in M3U content");

      const { error } = await supabase.from("tv_user_playlists").insert({
        user_id:       user.id,
        name:          formPaste.name.trim(),
        type:          "m3u",
        channel_count: count,
        last_synced_at: new Date().toISOString(),
      });
      if (error) throw error;

      // Store channels in localStorage for local playback (no server storage for raw content)
      const channels = parseM3U(formPaste.content);
      const key      = `vx:tv:playlist:paste:${user.id}:${formPaste.name.trim()}`;
      localStorage.setItem(key, JSON.stringify(channels));

      toast.success(`Playlist saved — ${count} channels`);
      qc.invalidateQueries({ queryKey: ["tv-user-playlists", user.id] });
      setAddOpen(false);
      setFormPaste(EMPTY_PASTE);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save playlist");
    } finally {
      setSaving(false);
    }
  }, [user, formPaste, qc]);

  // ── Add Xtream ──────────────────────────────────────────────
  const saveXtreamPlaylist = useCallback(async () => {
    if (!user || !formXtream.name || !formXtream.host || !formXtream.user || !formXtream.pass) {
      toast.error("Please fill in all fields");
      return;
    }
    setSaving(true);
    try {
      const host      = formXtream.host.trim().replace(/\/$/, "");
      const m3uUrl    = `${host}/get.php?username=${formXtream.user}&password=${formXtream.pass}&type=m3u_plus`;
      const res       = await fetch(m3uUrl);
      if (!res.ok) throw new Error(`Xtream server returned ${res.status}`);
      const text  = await res.text();
      const count = countM3UChannels(text);

      const { error } = await supabase.from("tv_user_playlists").insert({
        user_id:       user.id,
        name:          formXtream.name.trim(),
        type:          "xtream",
        source_url:    m3uUrl,
        xtream_host:   host,
        xtream_user:   formXtream.user.trim(),
        channel_count: count,
        last_synced_at: new Date().toISOString(),
      });
      if (error) throw error;

      toast.success(`Xtream playlist imported — ${count} channels`);
      qc.invalidateQueries({ queryKey: ["tv-user-playlists", user.id] });
      setAddOpen(false);
      setFormXtream(EMPTY_XTREAM);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to connect to Xtream server");
    } finally {
      setSaving(false);
    }
  }, [user, formXtream, qc]);

  // ── Delete playlist ─────────────────────────────────────────
  const deletePlaylist = useCallback(async (id: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("tv_user_playlists")
      .update({ is_active: false })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) { toast.error("Failed to delete"); return; }
    toast.success("Playlist removed");
    qc.invalidateQueries({ queryKey: ["tv-user-playlists", user.id] });
    if (expanded === id) setExpanded(null);
  }, [user, qc, expanded]);

  // ── Expand playlist → fetch & parse channels ────────────────
  const expandPlaylist = useCallback(async (pl: UserPlaylist) => {
    if (expanded === pl.id) { setExpanded(null); return; }
    setExpanded(pl.id);

    if (parsed[pl.id]) return; // already loaded

    if (!pl.source_url) return; // pasted content (stored in localStorage)

    try {
      const res  = await fetch(pl.source_url);
      const text = await res.text();
      const chs  = parseM3U(text);
      setParsed(prev => ({ ...prev, [pl.id]: chs }));
    } catch {
      toast.error("Failed to load playlist channels");
    }
  }, [expanded, parsed]);

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6" dir={dir}>

        {/* Top bar */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/services/live-tv" className="text-muted-foreground hover:text-foreground transition-colors">
              <BackIcon className="w-5 h-5" />
            </Link>
            <h1 className="font-bold text-xl text-foreground flex items-center gap-2">
              <List className="w-5 h-5 text-blue-400" />
              {isRTL ? "قوائم التشغيل" : "My Playlists"}
            </h1>
          </div>
          {user && (
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="w-4 h-4 me-1.5" />
              {isRTL ? "إضافة قائمة" : "Add Playlist"}
            </Button>
          )}
        </div>

        {/* Section nav */}
        <TVSectionNav />

        {/* Now playing (inline mini player) */}
        {nowPlaying && (
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-sm truncate">{nowPlaying.name}</p>
              <Button size="sm" variant="ghost" onClick={() => setNowPlaying(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <OfficialStreamPlayer
              url={nowPlaying.url}
              name={nowPlaying.name}
              logo={nowPlaying.logo || undefined}
              isTV
            />
          </div>
        )}

        {/* Playlist list */}
        {!user ? (
          <div className="text-center py-16 text-muted-foreground">
            <List className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">
              {isRTL ? "سجل الدخول لإدارة قوائمك" : "Log in to manage your playlists"}
            </p>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <RefreshCw className="w-5 h-5 animate-spin" />
          </div>
        ) : playlists.length === 0 ? (
          <div className="text-center py-16 space-y-4">
            <List className="w-14 h-14 mx-auto text-muted-foreground/20" />
            <div className="space-y-1">
              <p className="font-medium text-foreground">
                {isRTL ? "لا توجد قوائم تشغيل بعد" : "No playlists yet"}
              </p>
              <p className="text-sm text-muted-foreground">
                {isRTL
                  ? "أضف قائمة M3U أو Xtream لبث قنواتك الخاصة"
                  : "Add an M3U or Xtream playlist to stream your own channels"}
              </p>
            </div>
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="w-4 h-4 me-2" />
              {isRTL ? "إضافة أول قائمة" : "Add first playlist"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {playlists.map(pl => {
              const isExp = expanded === pl.id;
              const chs   = parsed[pl.id] ?? [];
              return (
                <div key={pl.id} className="rounded-xl border bg-card overflow-hidden">
                  {/* Header row */}
                  <div className="flex items-center gap-3 p-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                      <List className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{pl.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {pl.channel_count} {isRTL ? "قناة" : "channels"}
                        {" · "}
                        <span className="uppercase text-[10px] font-medium bg-muted px-1.5 py-0.5 rounded">
                          {pl.type}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm" variant="ghost"
                        onClick={() => expandPlaylist(pl)}
                        className="h-8 px-2 text-muted-foreground"
                      >
                        {isExp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                      <Button
                        size="sm" variant="ghost"
                        onClick={() => deletePlaylist(pl.id)}
                        className="h-8 px-2 text-muted-foreground hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Expanded channel list */}
                  {isExp && (
                    <div className="border-t max-h-64 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
                      {chs.length === 0 ? (
                        <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground text-sm">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {isRTL ? "جاري التحميل…" : "Loading channels…"}
                        </div>
                      ) : (
                        chs.slice(0, 200).map((ch, i) => (
                          <button
                            key={i}
                            onClick={() => setNowPlaying(ch)}
                            className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-muted/50 transition-colors text-start border-b last:border-0"
                          >
                            <div className="w-8 h-8 rounded bg-muted flex items-center justify-center flex-shrink-0">
                              {ch.logo
                                ? <img src={ch.logo} alt={ch.name} className="w-full h-full object-contain rounded p-0.5" />
                                : <Tv className="w-4 h-4 text-muted-foreground" />
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{ch.name}</p>
                              {ch.group && <p className="text-xs text-muted-foreground truncate">{ch.group}</p>}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Add Playlist Dialog ── */}
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="max-w-md" dir={dir}>
            <DialogHeader>
              <DialogTitle>{isRTL ? "إضافة قائمة تشغيل" : "Add Playlist"}</DialogTitle>
            </DialogHeader>

            <Tabs value={addTab} onValueChange={v => setAddTab(v as typeof addTab)}>
              <TabsList className="w-full">
                <TabsTrigger value="url"    className="flex-1">M3U URL</TabsTrigger>
                <TabsTrigger value="paste"  className="flex-1">{isRTL ? "لصق" : "Paste"}</TabsTrigger>
                <TabsTrigger value="xtream" className="flex-1">Xtream</TabsTrigger>
              </TabsList>

              {/* M3U URL tab */}
              <TabsContent value="url" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>{isRTL ? "اسم القائمة" : "Playlist Name"}</Label>
                  <Input
                    value={formM3U.name}
                    onChange={e => setFormM3U(p => ({ ...p, name: e.target.value }))}
                    placeholder={isRTL ? "مثال: قنوات رياضية" : "e.g. Sports Channels"}
                  />
                </div>
                <div className="space-y-2">
                  <Label>M3U URL</Label>
                  <Input
                    value={formM3U.url}
                    onChange={e => setFormM3U(p => ({ ...p, url: e.target.value }))}
                    placeholder="https://example.com/playlist.m3u"
                    dir="ltr"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {isRTL
                    ? "الرابط يجب أن يكون متاحاً للعموم (CORS مفتوح)"
                    : "URL must be publicly accessible with CORS enabled"}
                </p>
              </TabsContent>

              {/* Paste tab */}
              <TabsContent value="paste" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>{isRTL ? "اسم القائمة" : "Playlist Name"}</Label>
                  <Input
                    value={formPaste.name}
                    onChange={e => setFormPaste(p => ({ ...p, name: e.target.value }))}
                    placeholder={isRTL ? "اسم القائمة" : "Playlist name"}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{isRTL ? "محتوى M3U" : "M3U Content"}</Label>
                  <textarea
                    value={formPaste.content}
                    onChange={e => setFormPaste(p => ({ ...p, content: e.target.value }))}
                    placeholder="#EXTM3U&#10;#EXTINF:-1 group-title=&quot;News&quot;,Al Jazeera&#10;http://..."
                    rows={6}
                    dir="ltr"
                    className="w-full text-xs font-mono border rounded-md px-3 py-2 bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </TabsContent>

              {/* Xtream tab */}
              <TabsContent value="xtream" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>{isRTL ? "اسم القائمة" : "Playlist Name"}</Label>
                  <Input
                    value={formXtream.name}
                    onChange={e => setFormXtream(p => ({ ...p, name: e.target.value }))}
                    placeholder={isRTL ? "اسم القائمة" : "Playlist name"}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{isRTL ? "رابط الخادم" : "Server URL"}</Label>
                  <Input value={formXtream.host} onChange={e => setFormXtream(p => ({ ...p, host: e.target.value }))} placeholder="http://provider.com:8080" dir="ltr" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>{isRTL ? "اسم المستخدم" : "Username"}</Label>
                    <Input value={formXtream.user} onChange={e => setFormXtream(p => ({ ...p, user: e.target.value }))} dir="ltr" />
                  </div>
                  <div className="space-y-2">
                    <Label>{isRTL ? "كلمة المرور" : "Password"}</Label>
                    <Input type="password" value={formXtream.pass} onChange={e => setFormXtream(p => ({ ...p, pass: e.target.value }))} dir="ltr" />
                  </div>
                </div>
                <p className="text-xs text-amber-500/80 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  {isRTL
                    ? "بيانات الاعتماد محفوظة بشكل مشفر ولا تُشارك مع أحد"
                    : "Credentials are stored encrypted and never shared"}
                </p>
              </TabsContent>
            </Tabs>

            <DialogFooter className="gap-2 mt-2">
              <Button variant="outline" onClick={() => setAddOpen(false)}>
                {isRTL ? "إلغاء" : "Cancel"}
              </Button>
              <Button
                disabled={saving}
                onClick={addTab === "url" ? saveUrlPlaylist : addTab === "paste" ? savePastedPlaylist : saveXtreamPlaylist}
              >
                {saving && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                {isRTL ? "إضافة" : "Import"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

