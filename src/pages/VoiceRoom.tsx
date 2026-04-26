import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useParticipants,
  useLocalParticipant,
  useTracks,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Track } from "livekit-client";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mic, MicOff, PhoneOff, Users, Volume2 } from "lucide-react";
import { DEFAULT_ROOMS } from "@/systems/voiceRoomSystem";

// ── Participant tile ──────────────────────────────────────────────
function ParticipantTile({ participant }: { participant: ReturnType<typeof useParticipants>[number] }) {
  const tracks = useTracks(
    [{ source: Track.Source.Microphone, withPlaceholder: true }],
    { participant }
  );
  const isMuted = !tracks.some((t) => t.publication?.isMuted === false && t.publication?.isEnabled);
  const isSpeaking = participant.isSpeaking;

  return (
    <div
      className={`flex flex-col items-center gap-2 rounded-2xl border p-4 transition-all ${
        isSpeaking ? "border-primary bg-primary/5 shadow-md" : "border-border bg-muted/30"
      }`}
    >
      <div className={`relative flex h-14 w-14 items-center justify-center rounded-full text-2xl font-bold text-primary-foreground ${isSpeaking ? "bg-primary" : "bg-muted-foreground/30"}`}>
        {(participant.name || participant.identity).charAt(0).toUpperCase()}
        {isSpeaking && (
          <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
            <Volume2 className="h-2.5 w-2.5 text-primary-foreground" />
          </span>
        )}
      </div>
      <span className="max-w-[80px] truncate text-xs font-medium">
        {participant.name || participant.identity}
      </span>
      {isMuted && <MicOff className="h-3.5 w-3.5 text-muted-foreground" />}
    </div>
  );
}

// ── Room inner content (inside LiveKitRoom context) ────────────────
function RoomContent({ onLeave, t }: { onLeave: () => void; t: (key: string) => string }) {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const [muted, setMuted] = useState(false);

  const toggleMic = async () => {
    await localParticipant.setMicrophoneEnabled(muted);
    setMuted(!muted);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Participants grid */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">
            {participants.length} {t("vroom.participants")}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {participants.map((p) => (
            <ParticipantTile key={p.sid} participant={p} />
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 pt-2">
        <Button
          size="lg"
          variant={muted ? "destructive" : "outline"}
          className="h-14 w-14 rounded-full p-0"
          onClick={toggleMic}
          aria-label={muted ? t("vroom.unmute") : t("vroom.mute")}
        >
          {muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </Button>

        <Button
          size="lg"
          variant="destructive"
          className="h-14 w-14 rounded-full p-0"
          onClick={onLeave}
          aria-label={t("vroom.leaveRoom")}
        >
          <PhoneOff className="h-6 w-6" />
        </Button>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        {t("vroom.hint")}
      </p>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────
export default function VoiceRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { lang, t } = useLanguage();
  const isAr = lang === "ar";

  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roomName, setRoomName] = useState("");

  const livekitUrl = import.meta.env.VITE_LIVEKIT_URL as string | undefined;

  const cleanup = useCallback(async () => {
    if (user && roomId) {
      await supabase
        .from("voice_room_members")
        .delete()
        .eq("room_id", roomId)
        .eq("user_id", user.id);
    }
  }, [user, roomId]);

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    if (!roomId) { navigate("/community"); return; }

    // Resolve room name
    const def = DEFAULT_ROOMS.find((r) => r.id === roomId);
    if (def) {
      setRoomName(isAr ? def.nameAr : def.name);
    } else {
      supabase
        .from("voice_rooms")
        .select("room_name")
        .eq("id", roomId)
        .single()
        .then(({ data }) => { if (data) setRoomName(data.room_name); });
    }

    // Register membership
    supabase.from("voice_room_members").upsert(
      { room_id: roomId, user_id: user.id },
      { onConflict: "room_id,user_id" }
    );

    // Get LiveKit token via Edge Function
    const getToken = async () => {
      const { data, error: fnErr } = await supabase.functions.invoke("livekit-token", {
        body: {
          roomId,
          userId: user.id,
          userName: user.user_metadata?.display_name || user.email,
        },
      });

      if (fnErr || !data?.token) {
        setError(fnErr?.message || t("vroom.tokenError"));
      } else {
        setToken(data.token);
      }
      setLoading(false);
    };

    getToken();

    // Cleanup on unmount
    return () => { cleanup(); };
  }, [user, roomId, navigate, isAr, cleanup]);

  const handleLeave = async () => {
    await cleanup();
    navigate("/community");
  };

  // ── Loading state ──
  if (loading) {
    return (
      <Layout>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground">{t("vroom.connecting")}</p>
        </div>
      </Layout>
    );
  }

  // ── Error / missing config ──
  if (error || !token || !livekitUrl) {
    return (
      <Layout>
        <div className="section-container py-16 text-center">
          <div className="mx-auto max-w-md space-y-4">
            <p className="text-lg font-semibold text-destructive">
              {error || t("vroom.notConfigured")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("vroom.configDesc")}
            </p>
            <Button onClick={() => navigate("/community")}>
              {t("vroom.backToCommunity")}
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  // ── Voice room ──
  return (
    <Layout>
      <div className="section-container py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5">
              <Mic className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{roomName}</h1>
              <Badge variant="outline" className="mt-0.5 gap-1 text-xs text-emerald-600 border-emerald-500/40">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {t("vroom.live")}
              </Badge>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleLeave}>
            {t("vroom.leave")}
          </Button>
        </div>

        <Card>
          <CardContent className="p-6">
            <LiveKitRoom
              serverUrl={livekitUrl}
              token={token}
              connect
              audio
              video={false}
              onDisconnected={handleLeave}
              onError={(err) => {
                toast({ title: t("vroom.connectionError"), description: err.message, variant: "destructive" });
              }}
            >
              <RoomAudioRenderer />
              <RoomContent onLeave={handleLeave} t={t} />
            </LiveKitRoom>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
