import { useState, useEffect, useCallback, useRef } from "react";
import { Layout } from "@/components/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSound } from "@/contexts/SoundContext";
import { useAdmin } from "@/hooks/useAdmin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Mic, Users, Radio, Globe, Trash2, Loader2, LogIn,
  Lock, Share2, Check, X, Pencil, PowerOff, Power,
  Calendar, Clock, Bell,
} from "lucide-react";
import { VOICE_ROOM_CONFIGS } from "@/systems/voiceRoomSystem";
import { useVXWallet } from "@/hooks/useVXWallet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Link, useNavigate } from "react-router-dom";
import { AnimatedSection, StaggerGrid, StaggerItem, scaleFade } from "@/components/AnimatedSection";
import communityImg from "@/assets/community-illustration.jpg";
import { WatchAdButton } from "@/components/WatchAdButton";

type VoiceRoom = {
  id: string;
  owner_id: string | null;
  room_name: string;
  room_type: string;
  room_topic: string | null;
  max_users: number;
  cost_vx: number;
  join_cost_vx: number;
  is_private: boolean;
  is_active: boolean;
  is_default: boolean;
  scheduled_at: string | null;
  created_at: string;
};

type RoomMemberCount = Record<string, number>;

// ── Countdown hook ────────────────────────────────────────────────
function useCountdown(targetISO: string | null) {
  const calc = () => {
    if (!targetISO) return null;
    const diff = new Date(targetISO).getTime() - Date.now();
    if (diff <= 0) return null;
    const d = Math.floor(diff / 86_400_000);
    const h = Math.floor((diff % 86_400_000) / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    const s = Math.floor((diff % 60_000) / 1_000);
    return { d, h, m, s, diff };
  };
  const [remaining, setRemaining] = useState(calc);

  useEffect(() => {
    if (!targetISO) { setRemaining(null); return; }
    const id = setInterval(() => setRemaining(calc()), 1_000);
    return () => clearInterval(id);
  }, [targetISO]);

  return remaining;
}

// ── Countdown display ─────────────────────────────────────────────
function CountdownBadge({ targetISO, onExpire }: { targetISO: string; onExpire?: () => void }) {
  const rem = useCountdown(targetISO);
  const expiredRef = useRef(false);

  useEffect(() => {
    if (!rem && !expiredRef.current) {
      expiredRef.current = true;
      onExpire?.();
    }
  }, [rem, onExpire]);

  if (!rem) return <Badge className="gap-1 bg-emerald-500 text-white animate-pulse"><Bell className="h-3 w-3" /> Opening…</Badge>;

  const parts = [];
  if (rem.d > 0) parts.push(`${rem.d}d`);
  parts.push(`${String(rem.h).padStart(2, "0")}:${String(rem.m).padStart(2, "0")}:${String(rem.s).padStart(2, "0")}`);

  return (
    <Badge variant="outline" className="gap-1 border-amber-400 text-amber-600 font-mono tabular-nums">
      <Clock className="h-3 w-3" />
      {parts.join(" ")}
    </Badge>
  );
}

// ── Main page ─────────────────────────────────────────────────────
export default function Community() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const { playSound } = useSound();
  const { isAdmin } = useAdmin();
  const { spendVX } = useVXWallet();
  const navigate = useNavigate();

  const [defaultRooms, setDefaultRooms] = useState<VoiceRoom[]>([]);
  const [userRooms, setUserRooms] = useState<VoiceRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<string | null>(null);
  const [memberCounts, setMemberCounts] = useState<RoomMemberCount>({});
  const [makePrivate, setMakePrivate] = useState(false);
  const [roomTopic, setRoomTopic] = useState("");

  // Admin inline topic editing
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [topicDraft, setTopicDraft] = useState("");

  // Admin scheduling
  const [schedulingRoomId, setSchedulingRoomId] = useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState("");
  const [scheduleTopic, setScheduleTopic] = useState("");

  // ── Data fetching ───────────────────────────────────────────────
  const fetchRooms = useCallback(async () => {
    const defQuery = supabase
      .from("voice_rooms")
      .select("*")
      .eq("is_default", true)
      .order("room_name");

    let userQuery = supabase
      .from("voice_rooms")
      .select("*")
      .eq("is_active", true)
      .eq("is_default", false);

    if (user) {
      userQuery = userQuery.or(`is_private.eq.false,owner_id.eq.${user.id}`);
    } else {
      userQuery = userQuery.eq("is_private", false);
    }

    const [defRes, userRes] = await Promise.all([
      defQuery,
      userQuery.order("created_at", { ascending: false }),
    ]);

    let dRooms = (defRes.data as VoiceRoom[]) || [];
    // Non-admins only see: active rooms OR rooms with a scheduled_at (upcoming)
    if (!isAdmin) {
      dRooms = dRooms.filter((r) => r.is_active || r.scheduled_at);
    }

    setDefaultRooms(dRooms);
    setUserRooms((userRes.data as VoiceRoom[]) || []);
    setLoading(false);
  }, [user, isAdmin]);

  const fetchMemberCounts = useCallback(async () => {
    const { data } = await supabase.from("voice_room_members").select("room_id");
    if (data) {
      const counts: RoomMemberCount = {};
      data.forEach((m: { room_id: string }) => {
        counts[m.room_id] = (counts[m.room_id] || 0) + 1;
      });
      setMemberCounts(counts);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
    fetchMemberCounts();
  }, [fetchRooms, fetchMemberCounts]);

  // Realtime: member counts
  useEffect(() => {
    const ch = supabase
      .channel("voice-room-members-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "voice_room_members" }, fetchMemberCounts)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchMemberCounts]);

  // Realtime: room state changes (activation by cron or admin)
  useEffect(() => {
    const ch = supabase
      .channel("voice-rooms-live")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "voice_rooms" }, () => {
        fetchRooms();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchRooms]);

  // ── Actions ─────────────────────────────────────────────────────
  const joinRoom = (roomId: string) => {
    if (!user) return;
    playSound("navigate");
    navigate(`/community/room/${roomId}`);
  };

  const shareRoom = (roomId: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/community/room/${roomId}`);
    toast({ title: t("vroom.linkCopied") });
  };

  const deleteRoom = async (id: string) => {
    await supabase.from("voice_rooms").delete().eq("id", id);
    playSound("delete");
    toast({ title: t("community.roomDeleted") });
    fetchRooms();
  };

  const toggleDefaultRoom = async (room: VoiceRoom) => {
    await supabase.from("voice_rooms")
      .update({ is_active: !room.is_active, scheduled_at: null })
      .eq("id", room.id);
    toast({ title: room.is_active ? t("vroom.deactivated") : t("vroom.activated") });
    fetchRooms();
  };

  const saveDefaultTopic = async (roomId: string) => {
    await supabase.from("voice_rooms").update({ room_topic: topicDraft.trim() || null }).eq("id", roomId);
    setEditingTopicId(null);
    toast({ title: t("vroom.topicSaved") });
    fetchRooms();
  };

  // Schedule: set scheduled_at + topic, deactivate room until time arrives
  const confirmSchedule = async (roomId: string) => {
    if (!scheduledAt) {
      toast({ title: t("vroom.scheduleRequiredDate"), variant: "destructive" });
      return;
    }
    await supabase.from("voice_rooms").update({
      scheduled_at: new Date(scheduledAt).toISOString(),
      room_topic: scheduleTopic.trim() || null,
      is_active: false,
    }).eq("id", roomId);
    setSchedulingRoomId(null);
    setScheduledAt("");
    setScheduleTopic("");
    toast({ title: t("vroom.scheduleSet") });
    fetchRooms();
  };

  const cancelSchedule = async (roomId: string) => {
    await supabase.from("voice_rooms")
      .update({ scheduled_at: null })
      .eq("id", roomId);
    toast({ title: t("vroom.scheduleCancelled") });
    fetchRooms();
  };

  const createRoom = async (cfg: (typeof VOICE_ROOM_CONFIGS)[number]) => {
    if (!user) return;
    const cfgLabel = t(cfg.labelKey);
    const paid = await spendVX(cfg.costVX, "voice_room_create", cfgLabel);
    if (!paid) return;
    setCreating(cfg.type);
    const { data, error } = await supabase.from("voice_rooms").insert({
      owner_id: user.id,
      room_name: cfgLabel,
      room_type: cfg.type,
      room_topic: roomTopic.trim() || null,
      max_users: cfg.maxUsers ?? 999,
      cost_vx: cfg.costVX,
      join_cost_vx: cfg.joinCostVX,
      is_private: makePrivate,
      is_active: true,
      is_default: false,
    }).select("id").single();
    if (error) {
      playSound("error");
      toast({ title: t("community.errorTitle"), description: error.message, variant: "destructive" });
    } else {
      playSound("success");
      toast({ title: t("community.roomCreated") });
      fetchRooms();
      if (data?.id) navigate(`/community/room/${data.id}`);
    }
    setCreating(null);
  };

  // ── Helpers ──────────────────────────────────────────────────────
  const renderMemberBadge = (roomId: string, maxUsers?: number) => {
    const count = memberCounts[roomId] || 0;
    return (
      <Badge variant={count > 0 ? "default" : "outline"} className="gap-1">
        <Users className="h-3 w-3" />
        <span className="font-semibold">{count}</span>
        {maxUsers && maxUsers < 999 && <span className="text-xs">/ {maxUsers}</span>}
      </Badge>
    );
  };

  const renderJoinButton = (room: VoiceRoom) => {
    const count = memberCounts[room.id] || 0;
    const isFull = room.max_users < 999 && count >= room.max_users;
    if (!user) return <Button className="flex-1" disabled>{t("community.loginToJoin")}</Button>;
    return (
      <Button className="flex-1" disabled={isFull} onClick={() => joinRoom(room.id)}>
        <LogIn className="me-2 h-4 w-4" />
        {isFull ? t("community.roomFull") : (
          <span className="flex items-center gap-1.5">
            {t("community.joinRoom")}
            {room.join_cost_vx > 0 && (
              <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-xs font-semibold text-primary">
                {room.join_cost_vx} VX
              </span>
            )}
          </span>
        )}
      </Button>
    );
  };

  // Local datetime string for the input min value (now)
  const nowLocal = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };

  const formatScheduled = (iso: string) =>
    new Date(iso).toLocaleString(lang === "ar" ? "ar-SA" : undefined, {
      weekday: "short", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  // ── Active default room card ──────────────────────────────────────
  const renderActiveDefaultCard = (room: VoiceRoom) => {
    const isEditingTopic = editingTopicId === room.id;
    const isScheduling = schedulingRoomId === room.id;

    return (
      <StaggerItem key={room.id}>
        <Card className="transition-shadow hover:shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5 text-primary" />
              {room.room_name}
            </CardTitle>
            <CardDescription className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                {renderMemberBadge(room.id)}
                <Badge variant="outline">{t("community.open")}</Badge>
              </div>

              {/* Topic display / edit */}
              {isAdmin && isEditingTopic ? (
                <div className="flex items-center gap-1 pt-1">
                  <Input
                    value={topicDraft}
                    onChange={(e) => setTopicDraft(e.target.value)}
                    placeholder={t("vroom.topicPlaceholder")}
                    className="h-7 flex-1 text-xs"
                    maxLength={120}
                    autoFocus
                  />
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-green-600" onClick={() => saveDefaultTopic(room.id)}>
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingTopicId(null)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : room.room_topic ? (
                <p className="text-xs text-muted-foreground line-clamp-2">{room.room_topic}</p>
              ) : null}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {renderJoinButton(room)}
              <Button size="icon" variant="outline" onClick={() => shareRoom(room.id)} aria-label={t("vroom.shareRoom")}>
                <Share2 className="h-4 w-4" />
              </Button>
              {isAdmin && (
                <>
                  <Button size="icon" variant="destructive" onClick={() => toggleDefaultRoom(room)} title={t("vroom.deactivate")}>
                    <PowerOff className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="outline" onClick={() => { setTopicDraft(room.room_topic || ""); setEditingTopicId(room.id); }} title={t("vroom.editTopic")}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    className="border-amber-400 text-amber-600 hover:bg-amber-50"
                    onClick={() => { setScheduleTopic(room.room_topic || ""); setScheduledAt(""); setSchedulingRoomId(room.id); }}
                    title={t("vroom.scheduleRoom")}
                  >
                    <Calendar className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>

            {/* Admin scheduling form */}
            {isAdmin && isScheduling && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {t("vroom.scheduleRoom")}
                </p>
                <Input
                  type="datetime-local"
                  min={nowLocal()}
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="h-8 text-xs"
                />
                <Input
                  value={scheduleTopic}
                  onChange={(e) => setScheduleTopic(e.target.value)}
                  placeholder={t("vroom.topicPlaceholder")}
                  className="h-8 text-xs"
                  maxLength={120}
                />
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 h-7 text-xs bg-amber-500 hover:bg-amber-600" onClick={() => confirmSchedule(room.id)}>
                    <Check className="h-3 w-3 me-1" />{t("vroom.setSchedule")}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSchedulingRoomId(null)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </StaggerItem>
    );
  };

  // ── Scheduled (upcoming) default room card ────────────────────────
  const renderUpcomingCard = (room: VoiceRoom) => {
    const isScheduling = schedulingRoomId === room.id;

    return (
      <StaggerItem key={room.id}>
        <Card className="transition-shadow hover:shadow-lg border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              {room.room_name}
              <Badge variant="outline" className="border-amber-400 text-amber-600 text-xs">
                {t("vroom.upcoming")}
              </Badge>
            </CardTitle>
            <CardDescription className="space-y-1.5">
              {/* Countdown */}
              {room.scheduled_at && (
                <div className="flex items-center gap-2 flex-wrap">
                  <CountdownBadge targetISO={room.scheduled_at} onExpire={fetchRooms} />
                  <span className="text-xs text-muted-foreground">
                    {formatScheduled(room.scheduled_at)}
                  </span>
                </div>
              )}
              {room.room_topic && (
                <p className="text-xs text-muted-foreground line-clamp-2">{room.room_topic}</p>
              )}
            </CardDescription>
          </CardHeader>

          {isAdmin && (
            <CardContent className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {/* Re-schedule */}
                <Button
                  size="sm"
                  variant="outline"
                  className="border-amber-400 text-amber-600 hover:bg-amber-50 text-xs"
                  onClick={() => {
                    const existing = room.scheduled_at ? new Date(room.scheduled_at) : new Date();
                    existing.setMinutes(existing.getMinutes() - existing.getTimezoneOffset());
                    setScheduledAt(existing.toISOString().slice(0, 16));
                    setScheduleTopic(room.room_topic || "");
                    setSchedulingRoomId(room.id);
                  }}
                >
                  <Calendar className="h-3.5 w-3.5 me-1" />{t("vroom.reschedule")}
                </Button>
                {/* Cancel schedule */}
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive border-destructive/40 hover:bg-destructive/10 text-xs"
                  onClick={() => cancelSchedule(room.id)}
                >
                  <X className="h-3.5 w-3.5 me-1" />{t("vroom.cancelSchedule")}
                </Button>
                {/* Open now */}
                <Button
                  size="sm"
                  variant="outline"
                  className="border-green-500 text-green-600 hover:bg-green-50 text-xs"
                  onClick={() => toggleDefaultRoom(room)}
                >
                  <Power className="h-3.5 w-3.5 me-1" />{t("vroom.openNow")}
                </Button>
              </div>

              {/* Re-scheduling form */}
              {isScheduling && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />{t("vroom.reschedule")}
                  </p>
                  <Input type="datetime-local" min={nowLocal()} value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="h-8 text-xs" />
                  <Input value={scheduleTopic} onChange={(e) => setScheduleTopic(e.target.value)} placeholder={t("vroom.topicPlaceholder")} className="h-8 text-xs" maxLength={120} />
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 h-7 text-xs bg-amber-500 hover:bg-amber-600" onClick={() => confirmSchedule(room.id)}>
                      <Check className="h-3 w-3 me-1" />{t("vroom.setSchedule")}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSchedulingRoomId(null)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      </StaggerItem>
    );
  };

  // ── Inactive (no schedule) default room card — admin only ─────────
  const renderInactiveCard = (room: VoiceRoom) => {
    const isScheduling = schedulingRoomId === room.id;
    return (
      <StaggerItem key={room.id}>
        <Card className="opacity-60 transition-shadow hover:shadow-lg hover:opacity-80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5 text-muted-foreground" />
              {room.room_name}
              <Badge variant="outline" className="text-xs text-muted-foreground">{t("vroom.inactive")}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="border-green-500 text-green-600 hover:bg-green-50 text-xs"
                onClick={() => toggleDefaultRoom(room)}
              >
                <Power className="h-3.5 w-3.5 me-1" />{t("vroom.activate")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-amber-400 text-amber-600 hover:bg-amber-50 text-xs"
                onClick={() => { setScheduleTopic(room.room_topic || ""); setScheduledAt(""); setSchedulingRoomId(room.id); }}
              >
                <Calendar className="h-3.5 w-3.5 me-1" />{t("vroom.scheduleRoom")}
              </Button>
            </div>

            {isScheduling && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />{t("vroom.scheduleRoom")}
                </p>
                <Input type="datetime-local" min={nowLocal()} value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="h-8 text-xs" />
                <Input value={scheduleTopic} onChange={(e) => setScheduleTopic(e.target.value)} placeholder={t("vroom.topicPlaceholder")} className="h-8 text-xs" maxLength={120} />
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 h-7 text-xs bg-amber-500 hover:bg-amber-600" onClick={() => confirmSchedule(room.id)}>
                    <Check className="h-3 w-3 me-1" />{t("vroom.setSchedule")}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSchedulingRoomId(null)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </StaggerItem>
    );
  };

  // ── User room card ────────────────────────────────────────────────
  const renderUserRoomCard = (room: VoiceRoom) => {
    const cfg = VOICE_ROOM_CONFIGS.find((c) => c.type === room.room_type);
    return (
      <Card key={room.id} className="transition-shadow hover:shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <span className="text-2xl">{cfg?.icon || "🎙️"}</span>
            {room.room_name}
            {room.is_private && <Lock className="h-4 w-4 text-muted-foreground" aria-label={t("vroom.private")} />}
          </CardTitle>
          <CardDescription className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{room.room_type}</Badge>
              {renderMemberBadge(room.id, room.max_users)}
            </div>
            {room.room_topic && <p className="text-xs text-muted-foreground line-clamp-2">{room.room_topic}</p>}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          {renderJoinButton(room)}
          <Button size="icon" variant="outline" onClick={() => shareRoom(room.id)} aria-label={t("vroom.shareRoom")}>
            <Share2 className="h-4 w-4" />
          </Button>
          {(user?.id === room.owner_id || isAdmin) && (
            <Button variant="destructive" size="icon" onClick={() => deleteRoom(room.id)} aria-label={t("community.deleteRoom")}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  // Split default rooms into buckets
  const activeDefaults   = defaultRooms.filter((r) => r.is_active);
  const upcomingDefaults = defaultRooms.filter((r) => !r.is_active && r.scheduled_at);
  const inactiveDefaults = defaultRooms.filter((r) => !r.is_active && !r.scheduled_at);

  // ── Render ────────────────────────────────────────────────────────
  return (
    <Layout>
      <section className="section-container py-12">
        <AnimatedSection variants={scaleFade}>
          <div className="relative mb-10 overflow-hidden rounded-2xl">
            <img src={communityImg} alt="" role="presentation" className="h-48 w-full object-cover sm:h-56" width={800} height={512} loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
            <div className="absolute bottom-6 left-6 right-6 text-center">
              <h1 className="text-4xl font-bold tracking-tight">{t("community.title")}</h1>
              <p className="mt-2 text-lg text-muted-foreground">{t("community.subtitle")}</p>
            </div>
          </div>
        </AnimatedSection>

        <WatchAdButton variant="banner" className="mb-6" />

        {/* Active default rooms */}
        {activeDefaults.length > 0 && (
          <div className="mb-12">
            <h2 className="mb-4 text-2xl font-bold flex items-center gap-2">
              <Radio className="h-6 w-6 text-primary" />
              {t("community.voiceRooms")}
              {isAdmin && <Badge variant="outline" className="text-xs text-primary border-primary/40 ms-2">{t("vroom.adminMode")}</Badge>}
            </h2>
            <StaggerGrid className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {activeDefaults.map(renderActiveDefaultCard)}
            </StaggerGrid>
          </div>
        )}

        {/* Upcoming scheduled rooms — visible to ALL users */}
        {upcomingDefaults.length > 0 && (
          <div className="mb-12">
            <h2 className="mb-4 text-2xl font-bold flex items-center gap-2">
              <Clock className="h-6 w-6 text-amber-500" />
              {t("community.upcomingRooms")}
            </h2>
            <StaggerGrid className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {upcomingDefaults.map(renderUpcomingCard)}
            </StaggerGrid>
          </div>
        )}

        {/* Inactive rooms — admin only */}
        {isAdmin && inactiveDefaults.length > 0 && (
          <div className="mb-12">
            <h2 className="mb-4 text-xl font-semibold flex items-center gap-2 text-muted-foreground">
              <PowerOff className="h-5 w-5" />
              {t("vroom.inactiveRooms")}
            </h2>
            <StaggerGrid className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {inactiveDefaults.map(renderInactiveCard)}
            </StaggerGrid>
          </div>
        )}

        {/* User-created rooms */}
        {userRooms.length > 0 && (
          <div className="mb-12">
            <h2 className="mb-4 text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              {t("community.userRooms")}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {userRooms.map(renderUserRoomCard)}
            </div>
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {/* Create room */}
        {user && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Globe className="h-6 w-6 text-primary" />
                {t("community.createRoom")}
              </h2>
              <button
                onClick={() => setMakePrivate((v) => !v)}
                className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${makePrivate ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                aria-pressed={makePrivate}
              >
                <Lock className="h-4 w-4" />
                {makePrivate ? t("vroom.private") : t("community.publicRoom")}
              </button>
            </div>
            <div className="mb-4">
              <Input value={roomTopic} onChange={(e) => setRoomTopic(e.target.value)} placeholder={t("vroom.topicPlaceholder")} maxLength={120} className="max-w-lg" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {VOICE_ROOM_CONFIGS.map((cfg) => {
                const cfgLabel = t(cfg.labelKey);
                return (
                  <Card key={cfg.type} className="text-center">
                    <CardHeader>
                      <div className="mx-auto text-4xl">{cfg.icon}</div>
                      <CardTitle className="text-lg">{cfgLabel}</CardTitle>
                      <CardDescription>
                        {cfg.maxUsers ? `${cfg.maxUsers} ${t("community.users")}` : t("community.unlimited")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="mb-3 flex flex-col gap-1 items-center">
                        <Badge className="text-base">{cfg.costVX} VX</Badge>
                        {cfg.joinCostVX > 0 && (
                          <span className="text-xs text-muted-foreground">{t("community.joinCost")}: {cfg.joinCostVX} VX</span>
                        )}
                      </div>
                      <Button variant="outline" className="w-full" disabled={creating === cfg.type} onClick={() => createRoom(cfg)}>
                        {creating === cfg.type ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {t("community.create")}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {!user && (
          <div className="mt-8 rounded-lg border bg-muted/50 p-8 text-center">
            <p className="mb-4 text-muted-foreground">{t("community.loginPrompt")}</p>
            <Button asChild><Link to="/login">{t("nav.login")}</Link></Button>
          </div>
        )}
      </section>
    </Layout>
  );
}
