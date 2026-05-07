import { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import { VOICE_ROOM_CONFIGS } from "@/systems/voiceRoomSystem";
import { useVXWallet } from "@/hooks/useVXWallet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Link, useNavigate } from "react-router-dom";
import { AnimatedSection, StaggerGrid, StaggerItem, scaleFade } from "@/components/AnimatedSection";
import communityImg from "@/assets/community-illustration.jpg";

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
  created_at: string;
};

type RoomMemberCount = Record<string, number>;

export default function Community() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { playSound } = useSound();
  const { isAdmin } = useAdmin();
  const { spendVX } = useVXWallet();
  const navigate = useNavigate();

  const [defaultRooms, setDefaultRooms] = useState<VoiceRoom[]>([]);
  const [userRooms, setUserRooms] = useState<VoiceRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<string | null>(null);
  const [joiningRoom, setJoiningRoom] = useState<string | null>(null);
  const [memberCounts, setMemberCounts] = useState<RoomMemberCount>({});
  const [makePrivate, setMakePrivate] = useState(false);
  const [roomTopic, setRoomTopic] = useState("");

  // Inline topic editing for default rooms (admin only)
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [topicDraft, setTopicDraft] = useState("");

  // ── Data fetching ───────────────────────────────────────────────
  const fetchRooms = useCallback(async () => {
    // Default rooms: admins see all (active + inactive), users see only active
    const defQuery = supabase
      .from("voice_rooms")
      .select("*")
      .eq("is_default", true)
      .order("room_name");

    // User rooms: exclude defaults, respect privacy
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
    // Non-admins only see active default rooms
    if (!isAdmin) dRooms = dRooms.filter((r) => r.is_active);

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

  useEffect(() => {
    const channel = supabase
      .channel("voice-room-members-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "voice_room_members" }, fetchMemberCounts)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchMemberCounts]);

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
    await supabase.from("voice_rooms").update({ is_active: !room.is_active }).eq("id", room.id);
    toast({
      title: room.is_active ? t("vroom.deactivated") : t("vroom.activated"),
    });
    fetchRooms();
  };

  const saveDefaultTopic = async (roomId: string) => {
    await supabase.from("voice_rooms").update({ room_topic: topicDraft.trim() || null }).eq("id", roomId);
    setEditingTopicId(null);
    toast({ title: t("vroom.topicSaved") });
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
      <Button className="flex-1" disabled={isFull || joiningRoom === room.id} onClick={() => joinRoom(room.id)}>
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

  // ── Default room card (admin sees extra controls) ─────────────────
  const renderDefaultRoomCard = (room: VoiceRoom) => {
    const isEditingTopic = editingTopicId === room.id;

    return (
      <StaggerItem key={room.id}>
        <Card className={`transition-shadow hover:shadow-lg ${!room.is_active ? "opacity-60" : ""}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5 text-primary" />
              {room.room_name}
              {!room.is_active && (
                <Badge variant="outline" className="text-xs text-muted-foreground">{t("vroom.inactive")}</Badge>
              )}
            </CardTitle>
            <CardDescription className="space-y-1">
              <div className="flex items-center gap-2">
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
          <CardContent className="flex flex-wrap gap-2">
            {room.is_active && renderJoinButton(room)}
            <Button size="icon" variant="outline" onClick={() => shareRoom(room.id)} aria-label={t("vroom.shareRoom")}>
              <Share2 className="h-4 w-4" />
            </Button>

            {/* Admin controls */}
            {isAdmin && (
              <>
                <Button
                  size="icon"
                  variant={room.is_active ? "destructive" : "outline"}
                  onClick={() => toggleDefaultRoom(room)}
                  title={room.is_active ? t("vroom.deactivate") : t("vroom.activate")}
                  className={!room.is_active ? "border-green-500 text-green-600 hover:bg-green-50" : ""}
                >
                  {room.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => { setTopicDraft(room.room_topic || ""); setEditingTopicId(room.id); }}
                  title={t("vroom.editTopic")}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </>
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
            {room.room_topic && (
              <p className="text-xs text-muted-foreground line-clamp-2">{room.room_topic}</p>
            )}
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

        {/* Default rooms section */}
        {(defaultRooms.length > 0) && (
          <div className="mb-12">
            <h2 className="mb-4 text-2xl font-bold flex items-center gap-2">
              <Radio className="h-6 w-6 text-primary" />
              {t("community.voiceRooms")}
              {isAdmin && (
                <Badge variant="outline" className="text-xs text-primary border-primary/40 ms-2">
                  {t("vroom.adminMode")}
                </Badge>
              )}
            </h2>
            <StaggerGrid className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {defaultRooms.map(renderDefaultRoomCard)}
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

            {/* Topic input */}
            <div className="mb-4">
              <Input
                value={roomTopic}
                onChange={(e) => setRoomTopic(e.target.value)}
                placeholder={t("vroom.topicPlaceholder")}
                maxLength={120}
                className="max-w-lg"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {VOICE_ROOM_CONFIGS.map((cfg) => {
                const cfgLabel = t(cfg.labelKey);
                return (
                  <Card key={cfg.type} className="text-center">
                    <CardHeader>
                      <div className="mx-auto text-4xl" aria-hidden="true">{cfg.icon}</div>
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
                      <Button
                        variant="outline"
                        className="w-full"
                        disabled={creating === cfg.type}
                        onClick={() => createRoom(cfg)}
                        aria-label={`${t("community.create")} ${cfgLabel} — ${cfg.costVX} VX`}
                      >
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
