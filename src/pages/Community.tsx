import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSound } from "@/contexts/SoundContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mic, Users, Radio, Globe, Trash2, Loader2, LogIn } from "lucide-react";
import { DEFAULT_ROOMS, VOICE_ROOM_CONFIGS } from "@/systems/voiceRoomSystem";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Link, useNavigate } from "react-router-dom";
import { AnimatedSection, StaggerGrid, StaggerItem, scaleFade } from "@/components/AnimatedSection";
import communityImg from "@/assets/community-illustration.jpg";

type VoiceRoom = {
  id: string;
  owner_id: string;
  room_name: string;
  room_type: string;
  max_users: number;
  cost_vx: number;
  is_active: boolean;
  created_at: string;
};

type RoomMemberCount = Record<string, number>;
type RoomMyMembership = Record<string, boolean>;

export default function Community() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const { playSound } = useSound();
  const navigate = useNavigate();
  const isAr = lang === "ar";

  const [rooms, setRooms] = useState<VoiceRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<string | null>(null);
  const [memberCounts, setMemberCounts] = useState<RoomMemberCount>({});
  const [myMemberships, setMyMemberships] = useState<RoomMyMembership>({});

  const defaultRoomIds = DEFAULT_ROOMS.map((r) => r.id);

  const fetchRooms = useCallback(async () => {
    const { data } = await supabase
      .from("voice_rooms")
      .select("*")
      .eq("is_active", true)
      .not("id", "in", `(${defaultRoomIds.join(",")})`)
      .order("created_at", { ascending: false });
    setRooms((data as VoiceRoom[]) || []);
    setLoading(false);
  }, []);

  const fetchMemberCounts = useCallback(async () => {
    const { data } = await supabase
      .from("voice_room_members")
      .select("room_id");
    if (data) {
      const counts: RoomMemberCount = {};
      data.forEach((m: { room_id: string }) => {
        counts[m.room_id] = (counts[m.room_id] || 0) + 1;
      });
      setMemberCounts(counts);
    }
  }, []);

  const fetchMyMemberships = useCallback(async () => {
    if (!user) { setMyMemberships({}); return; }
    const { data } = await supabase
      .from("voice_room_members")
      .select("room_id")
      .eq("user_id", user.id);
    if (data) {
      const map: RoomMyMembership = {};
      data.forEach((m: { room_id: string }) => { map[m.room_id] = true; });
      setMyMemberships(map);
    }
  }, [user]);

  useEffect(() => {
    fetchRooms();
    fetchMemberCounts();
    fetchMyMemberships();
  }, [fetchRooms, fetchMemberCounts, fetchMyMemberships]);

  useEffect(() => {
    const channel = supabase
      .channel("voice-room-members-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "voice_room_members" },
        () => {
          fetchMemberCounts();
          fetchMyMemberships();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchMemberCounts, fetchMyMemberships]);

  const joinRoom = (roomId: string) => {
    if (!user) return;
    playSound("navigate");
    navigate(`/community/room/${roomId}`);
  };

  const leaveRoom = async (roomId: string) => {
    if (!user) return;
    setJoiningRoom(roomId);
    await supabase
      .from("voice_room_members")
      .delete()
      .eq("room_id", roomId)
      .eq("user_id", user.id);
    playSound("close");
    toast({ title: t("community.leftRoom") });
    setJoiningRoom(null);
  };

  const createRoom = async (cfg: (typeof VOICE_ROOM_CONFIGS)[number]) => {
    if (!user) return;
    setCreating(cfg.type);
    const { error } = await supabase.from("voice_rooms").insert({
      owner_id: user.id,
      room_name: cfg.label,
      room_type: cfg.type,
      max_users: cfg.maxUsers ?? 999,
      cost_vx: cfg.costVX,
      is_active: true,
    });
    if (error) {
      playSound("error");
      toast({ title: t("community.errorTitle"), description: error.message, variant: "destructive" });
    } else {
      playSound("success");
      toast({ title: t("community.roomCreated") });
      fetchRooms();
    }
    setCreating(null);
  };

  const deleteRoom = async (id: string) => {
    await supabase.from("voice_rooms").delete().eq("id", id);
    playSound("delete");
    toast({ title: t("community.roomDeleted") });
    fetchRooms();
  };

  const renderJoinButton = (roomId: string, maxUsers: number) => {
    const count = memberCounts[roomId] || 0;
    const isFull = maxUsers < 999 && count >= maxUsers;

    if (!user) {
      return <Button className="flex-1" disabled>{t("community.loginToJoin")}</Button>;
    }

    return (
      <Button className="flex-1" disabled={isFull} onClick={() => joinRoom(roomId)}>
        <LogIn className="mr-2 h-4 w-4" />
        {isFull ? t("community.roomFull") : t("community.joinRoom")}
      </Button>
    );
  };

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

        {/* Default public rooms */}
        <div className="mb-12">
          <h2 className="mb-4 text-2xl font-bold flex items-center gap-2">
            <Radio className="h-6 w-6 text-primary" />
            {t("community.voiceRooms")}
          </h2>
          <StaggerGrid className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {DEFAULT_ROOMS.map((room) => (
            <StaggerItem key={room.id}>
              <Card className="transition-shadow hover:shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mic className="h-5 w-5 text-primary" />
                    {isAr ? room.nameAr : room.name}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    {renderMemberBadge(room.id)}
                    <Badge variant="outline">{t("community.open")}</Badge>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {renderJoinButton(room.id, 999)}
                </CardContent>
              </Card>
            </StaggerItem>
            ))}
          </StaggerGrid>
        </div>

        {/* User-created rooms from DB */}
        {rooms.length > 0 && (
          <div className="mb-12">
            <h2 className="mb-4 text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              {t("community.userRooms")}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {rooms.map((room) => {
                const cfg = VOICE_ROOM_CONFIGS.find((c) => c.type === room.room_type);
                return (
                  <Card key={room.id} className="transition-shadow hover:shadow-lg">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <span className="text-2xl">{cfg?.icon || "🎙️"}</span>
                        {room.room_name}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        <Badge variant="outline">{room.room_type}</Badge>
                        {renderMemberBadge(room.id, room.max_users)}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex gap-2">
                      {renderJoinButton(room.id, room.max_users)}
                      {user?.id === room.owner_id && (
                        <Button variant="destructive" size="icon" onClick={() => deleteRoom(room.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {/* Create private room */}
        {user && (
          <div>
            <h2 className="mb-4 text-2xl font-bold flex items-center gap-2">
              <Globe className="h-6 w-6 text-primary" />
              {t("community.createRoom")}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {VOICE_ROOM_CONFIGS.map((cfg) => (
                <Card key={cfg.type} className="text-center">
                  <CardHeader>
                    <div className="mx-auto text-4xl">{cfg.icon}</div>
                    <CardTitle className="text-lg">{cfg.label}</CardTitle>
                    <CardDescription>
                      {cfg.maxUsers ? `${cfg.maxUsers} ${t("community.users")}` : t("community.unlimited")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Badge className="mb-3 text-base">{cfg.costVX} VX</Badge>
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={creating === cfg.type}
                      onClick={() => createRoom(cfg)}
                    >
                      {creating === cfg.type ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      {t("community.create")}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {!user && (
          <div className="mt-8 rounded-lg border bg-muted/50 p-8 text-center">
            <p className="mb-4 text-muted-foreground">{t("community.loginPrompt")}</p>
            <Button asChild>
              <Link to="/login">{t("nav.login")}</Link>
            </Button>
          </div>
        )}
      </section>
    </Layout>
  );
}
