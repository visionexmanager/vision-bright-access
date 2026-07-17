import { useEffect, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Mic2, Search, Plus, Users, Lock, Radio, RefreshCw, Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { AnimatedSection, StaggerGrid, StaggerItem } from "@/components/AnimatedSection";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface VoiceRoom {
  id: string;
  name: string;
  topic: string | null;
  is_private: boolean;
  room_mode: string | null;
  member_count: number;
  owner_id: string;
  owner_name?: string;
  created_at: string;
}

export default function VoiceRooms() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, dir } = useLanguage();
  const { playSound } = useSound();

  const [rooms, setRooms] = useState<VoiceRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [newRoomName, setNewRoomName] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const loadRooms = async () => {
    setLoading(true);
    await supabase.rpc("cleanup_stale_voice_rooms").then(() => {}, (error) => {
      console.warn("Voice room cleanup skipped:", error);
    });

    const { data, error } = await supabase
      .from("voice_rooms")
      .select(`
        id, room_name, room_topic, is_private, room_mode, created_at, owner_id,
        voice_room_members(count)
      `)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Error loading rooms:", error);
      setLoading(false);
      return;
    }

    // Fetch owner names
    const ownerIds = [...new Set((data ?? []).map((r: any) => r.owner_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .in("user_id", ownerIds);

    const nameMap: Record<string, string> = {};
    (profiles ?? []).forEach((p: any) => { nameMap[p.user_id] = p.display_name ?? ""; });

    const roomList: VoiceRoom[] = (data ?? []).map((r: any) => ({
      id: r.id,
      name: r.room_name,
      topic: r.room_topic,
      is_private: r.is_private,
      room_mode: r.room_mode,
      member_count: r.voice_room_members?.[0]?.count ?? 0,
      owner_id: r.owner_id,
      owner_name: nameMap[r.owner_id] ?? "",
      created_at: r.created_at,
    }));

    setRooms(roomList);
    setLoading(false);
  };

  useEffect(() => { loadRooms(); }, []);

  // Real-time updates: refresh when a room is added/removed/updated
  useEffect(() => {
    const channel = supabase
      .channel("voice_rooms_list")
      .on("postgres_changes", { event: "*", schema: "public", table: "voice_rooms" }, loadRooms)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleCreate = async () => {
    if (!user) {
      toast({ title: t("tv.toast.loginRequired"), variant: "destructive" });
      return;
    }
    const name = newRoomName.trim() || `${user.user_metadata?.display_name ?? "Room"}'s Room`;
    setCreating(true);
    const { data, error } = await supabase
      .from("voice_rooms")
      .insert({ room_name: name, owner_id: user.id, is_private: false, room_mode: "conversation" })
      .select("id")
      .single();
    setCreating(false);
    if (error || !data) {
      toast({ title: t("vroom.tokenError") || "Failed to create room", variant: "destructive" });
      return;
    }
    playSound("navigate");
    navigate(`/community/voice-room/${data.id}`);
  };

  const handleJoin = (room: VoiceRoom) => {
    playSound("navigate");
    navigate(`/community/voice-room/${room.id}`);
  };

  const handleRoomKeyDown = (event: KeyboardEvent, room: VoiceRoom) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleJoin(room);
    }
  };

  const filtered = rooms.filter(r =>
    !query.trim() ||
    r.name.toLowerCase().includes(query.toLowerCase()) ||
    (r.topic ?? "").toLowerCase().includes(query.toLowerCase())
  );

  return (
    <Layout>
      <div className="section-container py-10" dir={dir}>

        {/* Hero */}
        <AnimatedSection>
          <div className="mb-8 relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-950/80 via-violet-900/60 to-slate-900 p-8 border border-violet-500/20">
            <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-violet-500/20 rounded-xl border border-violet-400/30">
                    <Mic2 className="w-7 h-7 text-violet-400" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-extrabold text-white">{t("vrooms.title")}</h1>
                    <p className="text-violet-300/70 text-sm">{t("vrooms.subtitle")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <span className="flex items-center gap-1.5 text-xs text-violet-300/60">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                    {rooms.length} {t("vrooms.live")}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={loadRooms}
                  className="border-violet-500/30 text-violet-300 hover:bg-violet-500/10"
                  aria-label="Refresh"
                >
                  <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                </Button>
                {user && (
                  <Button
                    onClick={() => setShowCreate(!showCreate)}
                    className="bg-violet-600 hover:bg-violet-500 text-white font-bold shadow-lg shadow-violet-500/30 gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    {t("vrooms.create")}
                  </Button>
                )}
              </div>
            </div>

            {/* Create room inline form */}
            {showCreate && (
              <div className="mt-6 flex items-center gap-3 flex-wrap">
                <Input
                  placeholder={t("vrooms.title") + "…"}
                  value={newRoomName}
                  onChange={e => setNewRoomName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleCreate()}
                  className="max-w-xs bg-violet-950/50 border-violet-500/30 text-white placeholder:text-violet-400/50"
                  dir={dir}
                />
                <Button
                  onClick={handleCreate}
                  disabled={creating}
                  className="bg-green-600 hover:bg-green-500 text-white gap-2"
                >
                  {creating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {t("vrooms.create")}
                </Button>
              </div>
            )}
          </div>
        </AnimatedSection>

        {/* Search */}
        <div className="relative max-w-md mb-8">
          <Search className={cn("absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground", dir === "rtl" ? "right-3" : "left-3")} />
          <Input
            placeholder={t("vrooms.searchPlaceholder")}
            value={query}
            onChange={e => setQuery(e.target.value)}
            className={dir === "rtl" ? "pr-9" : "pl-9"}
            dir={dir}
          />
        </div>

        {/* Rooms grid */}
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} className="h-36 w-full rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="p-6 rounded-full bg-violet-500/10 border border-violet-500/20">
              <Radio className="w-14 h-14 text-violet-400/60" />
            </div>
            <p className="text-xl font-bold text-foreground">{t("vrooms.empty")}</p>
            <p className="text-muted-foreground max-w-xs">{t("vrooms.emptyDesc")}</p>
            {user && (
              <Button
                onClick={() => setShowCreate(true)}
                className="mt-2 bg-violet-600 hover:bg-violet-500 text-white gap-2"
              >
                <Plus className="w-4 h-4" />
                {t("vrooms.create")}
              </Button>
            )}
          </div>
        ) : (
          <StaggerGrid className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(room => (
              <StaggerItem key={room.id}>
                <Card
                  role="button"
                  tabIndex={0}
                  aria-label={`${t("vrooms.join")} ${room.name}${room.topic ? `, ${room.topic}` : ""}. ${room.member_count} ${t("vrooms.live")}`}
                  className="group overflow-hidden transition-all hover:shadow-lg hover:-translate-y-1 cursor-pointer border-border hover:border-violet-400/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
                  onClick={() => handleJoin(room)}
                  onKeyDown={(event) => handleRoomKeyDown(event, room)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="shrink-0 w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-400/20 flex items-center justify-center">
                          <Mic2 className="w-5 h-5 text-violet-400" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-foreground truncate">{room.name}</p>
                          {room.topic && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{room.topic}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {room.is_private && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 border-amber-500/40 text-amber-400">
                            <Lock className="w-2.5 h-2.5 me-1" aria-hidden="true" />
                            {t("vrooms.locked")}
                          </Badge>
                        )}
                        {room.room_mode === "stage" && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 border-blue-500/40 text-blue-400">
                            {t("vrooms.stageMode")}
                          </Badge>
                        )}
                        <Badge className="text-[10px] px-1.5 py-0.5 bg-green-500/20 text-green-400 border-green-400/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse me-1" />
                          {t("vrooms.live")}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" aria-hidden="true" />
                          {room.member_count}
                        </span>
                        {room.owner_name && (
                          <span className="truncate max-w-[120px]">
                            {t("vrooms.owner")}: {room.owner_name}
                          </span>
                        )}
                      </div>
                      <Button
                        size="sm"
                        className="bg-violet-600 hover:bg-violet-500 text-white text-xs opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
                        onClick={e => { e.stopPropagation(); handleJoin(room); }}
                      >
                        {t("vrooms.join")}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </StaggerItem>
            ))}
          </StaggerGrid>
        )}
      </div>
    </Layout>
  );
}
