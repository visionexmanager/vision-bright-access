import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mic, Users, Radio, Globe, Trash2, Loader2 } from "lucide-react";
import { DEFAULT_ROOMS, VOICE_ROOM_CONFIGS, type VoiceRoomType } from "@/systems/voiceRoomSystem";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

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

export default function Community() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const isAr = lang === "ar";

  const [rooms, setRooms] = useState<VoiceRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<string | null>(null);

  const fetchRooms = useCallback(async () => {
    const { data } = await supabase
      .from("voice_rooms")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    setRooms((data as VoiceRoom[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

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
      toast({ title: t("community.errorTitle"), description: error.message, variant: "destructive" });
    } else {
      toast({ title: t("community.roomCreated") });
      fetchRooms();
    }
    setCreating(null);
  };

  const deleteRoom = async (id: string) => {
    await supabase.from("voice_rooms").delete().eq("id", id);
    toast({ title: t("community.roomDeleted") });
    fetchRooms();
  };

  return (
    <Layout>
      <section className="mx-auto max-w-5xl px-4 py-12">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold tracking-tight">{t("community.title")}</h1>
          <p className="mt-2 text-lg text-muted-foreground">{t("community.subtitle")}</p>
        </div>

        {/* Default public rooms */}
        <div className="mb-12">
          <h2 className="mb-4 text-2xl font-bold flex items-center gap-2">
            <Radio className="h-6 w-6 text-primary" />
            {t("community.voiceRooms")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {DEFAULT_ROOMS.map((room) => (
              <Card key={room.id} className="transition-shadow hover:shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mic className="h-5 w-5 text-primary" />
                    {isAr ? room.nameAr : room.name}
                  </CardTitle>
                  <CardDescription>
                    <Badge variant="outline">
                      <Users className="mr-1 h-3 w-3" /> {t("community.open")}
                    </Badge>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" disabled={!user}>
                    {user ? t("community.joinRoom") : t("community.loginToJoin")}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* User-created rooms from DB */}
        {rooms.length > 0 && (
          <div className="mb-12">
            <h2 className="mb-4 text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              {t("community.userRooms")}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                        <Badge variant="secondary">
                          <Users className="mr-1 h-3 w-3" />
                          {room.max_users >= 999 ? "∞" : room.max_users}
                        </Badge>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex gap-2">
                      <Button className="flex-1" disabled={!user}>
                        {t("community.joinRoom")}
                      </Button>
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
