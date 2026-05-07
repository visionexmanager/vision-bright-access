import { useEffect, useRef, useState, useCallback } from "react";
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
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Copy, Loader2, Lock, Mic, MicOff, Pencil, PhoneOff,
  ShieldX, UserX, Users, Volume2, Check, X,
} from "lucide-react";
import { DEFAULT_ROOMS, PUBLIC_ROOM_JOIN_COST } from "@/systems/voiceRoomSystem";
import { useVXWallet } from "@/hooks/useVXWallet";

const FALLBACK_LIVEKIT_URL = "wss://visionex-hn3vb5hz.livekit.cloud";

function resolveLiveKitUrl() {
  const configuredUrl = import.meta.env.VITE_LIVEKIT_URL as string | undefined;
  const url = configuredUrl?.trim().replace(/^["']|["']$/g, "");
  if (!url || url.includes("YOUR_PROJECT") || !url.startsWith("wss://")) {
    return FALLBACK_LIVEKIT_URL;
  }
  return url;
}

// ── Participant tile ───────────────────────────────────────────────
interface ParticipantTileProps {
  participant: ReturnType<typeof useParticipants>[number];
  isOwner: boolean;
  isMe: boolean;
  roomId: string;
  onKick: (identity: string, name: string) => void;
  onBan: (identity: string, name: string) => void;
  t: (key: string) => string;
}

function ParticipantTile({ participant, isOwner, isMe, onKick, onBan, t }: ParticipantTileProps) {
  const tracks = useTracks(
    [{ source: Track.Source.Microphone, withPlaceholder: true }],
    { participant }
  );
  const isMuted = !tracks.some((tr) => tr.publication?.isMuted === false && tr.publication?.isEnabled);
  const isSpeaking = participant.isSpeaking;
  const displayName = participant.name || participant.identity;

  return (
    <div
      className={`flex flex-col items-center gap-2 rounded-2xl border p-4 transition-all ${
        isSpeaking ? "border-primary bg-primary/5 shadow-md" : "border-border bg-muted/30"
      }`}
    >
      <div className={`relative flex h-14 w-14 items-center justify-center rounded-full text-2xl font-bold text-primary-foreground ${isSpeaking ? "bg-primary" : "bg-muted-foreground/30"}`}>
        {displayName.charAt(0).toUpperCase()}
        {isSpeaking && (
          <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
            <Volume2 className="h-2.5 w-2.5 text-primary-foreground" />
          </span>
        )}
      </div>
      <span className="max-w-[80px] truncate text-xs font-medium">{displayName}</span>
      {isMuted && <MicOff className="h-3.5 w-3.5 text-muted-foreground" />}

      {/* Kick / Ban — only owner sees, not on themselves */}
      {isOwner && !isMe && (
        <div className="flex gap-1 mt-1">
          {/* Kick */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="icon" variant="ghost" className="h-6 w-6 text-orange-500 hover:bg-orange-50 hover:text-orange-600" title={t("vroom.kick")}>
                <UserX className="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("vroom.kick")}</AlertDialogTitle>
                <AlertDialogDescription>{t("vroom.kickConfirm").replace("{name}", displayName)}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("vroom.cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={() => onKick(participant.identity, displayName)} className="bg-orange-500 hover:bg-orange-600">
                  {t("vroom.kick")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Ban */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:bg-destructive/10" title={t("vroom.ban")}>
                <ShieldX className="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("vroom.ban")}</AlertDialogTitle>
                <AlertDialogDescription>{t("vroom.banConfirm").replace("{name}", displayName)}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("vroom.cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={() => onBan(participant.identity, displayName)} className="bg-destructive hover:bg-destructive/90">
                  {t("vroom.ban")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}

// ── Room inner content (inside LiveKitRoom context) ────────────────
interface RoomContentProps {
  onLeave: () => void;
  onKick: (identity: string, name: string) => void;
  onBan: (identity: string, name: string) => void;
  ownerId: string;
  currentUserId: string;
  roomId: string;
  t: (key: string) => string;
}

function RoomContent({ onLeave, onKick, onBan, ownerId, currentUserId, roomId, t }: RoomContentProps) {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const [muted, setMuted] = useState(false);
  const isOwner = currentUserId === ownerId;

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
            <ParticipantTile
              key={p.sid}
              participant={p}
              isOwner={isOwner}
              isMe={p.identity === currentUserId}
              roomId={roomId}
              onKick={onKick}
              onBan={onBan}
              t={t}
            />
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

      <p className="text-center text-xs text-muted-foreground">{t("vroom.hint")}</p>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────
export default function VoiceRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { spendVX } = useVXWallet();

  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roomName, setRoomName] = useState("");
  const [roomTopic, setRoomTopic] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [ownerId, setOwnerId] = useState("");

  // Topic editing
  const [editingTopic, setEditingTopic] = useState(false);
  const [topicDraft, setTopicDraft] = useState("");

  const leftIntentionally = useRef(false);
  const livekitUrl = resolveLiveKitUrl();

  const cleanup = useCallback(async () => {
    if (user && roomId) {
      await supabase
        .from("voice_room_members")
        .delete()
        .eq("room_id", roomId)
        .eq("user_id", user.id);
    }
  }, [user, roomId]);

  // Kick a participant: remove their membership row
  const handleKick = useCallback(async (identity: string, name: string) => {
    if (!roomId) return;
    await supabase
      .from("voice_room_members")
      .delete()
      .eq("room_id", roomId)
      .eq("user_id", identity);
    toast({ title: t("vroom.kickedUser").replace("{name}", name) });
  }, [roomId, t]);

  // Ban: insert into bans table then kick
  const handleBan = useCallback(async (identity: string, name: string) => {
    if (!roomId || !user) return;
    await supabase.from("voice_room_bans").upsert(
      { room_id: roomId, user_id: identity, banned_by: user.id },
      { onConflict: "room_id,user_id", ignoreDuplicates: true }
    );
    await supabase
      .from("voice_room_members")
      .delete()
      .eq("room_id", roomId)
      .eq("user_id", identity);
    toast({ title: t("vroom.bannedUser").replace("{name}", name) });
  }, [roomId, user, t]);

  // Save topic
  const saveTopic = async () => {
    if (!roomId) return;
    await supabase.from("voice_rooms").update({ room_topic: topicDraft }).eq("id", roomId);
    setRoomTopic(topicDraft);
    setEditingTopic(false);
    toast({ title: t("vroom.topicSaved") });
  };

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    if (!roomId) { navigate("/community"); return; }

    const isDefault = DEFAULT_ROOMS.some((r) => r.id === roomId);

    // Resolve room name + topic + owner
    const def = DEFAULT_ROOMS.find((r) => r.id === roomId);
    if (def) {
      setRoomName(t(def.nameKey));
    } else {
      supabase
        .from("voice_rooms")
        .select("room_name, room_topic, is_private, owner_id")
        .eq("id", roomId)
        .single()
        .then(({ data }) => {
          if (data) {
            setRoomName(data.room_name);
            setRoomTopic(data.room_topic || "");
            setTopicDraft(data.room_topic || "");
            setIsPrivate(data.is_private);
            setOwnerId(data.owner_id);
          }
        });
    }

    const getToken = async () => {
      // Check ban
      if (!isDefault) {
        const { data: ban } = await supabase
          .from("voice_room_bans")
          .select("id")
          .eq("room_id", roomId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (ban) {
          toast({ title: t("vroom.youAreBanned"), variant: "destructive" });
          navigate("/community");
          return;
        }
      }

      // Check if already a member to avoid double-charging
      const { data: existingMember } = await supabase
        .from("voice_room_members")
        .select("id")
        .eq("room_id", roomId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!existingMember) {
        if (isDefault) {
          const ok = await spendVX(PUBLIC_ROOM_JOIN_COST, "voice_room_join", roomId, roomId);
          if (!ok) { navigate("/community"); return; }
        } else {
          const { data: room } = await supabase
            .from("voice_rooms")
            .select("join_cost_vx, is_private, owner_id")
            .eq("id", roomId)
            .single();
          if (room) {
            setIsPrivate(room.is_private);
            setOwnerId(room.owner_id);
            if (room.owner_id !== user.id && room.join_cost_vx > 0) {
              const ok = await spendVX(room.join_cost_vx, "voice_room_join", roomId, roomId);
              if (!ok) { navigate("/community"); return; }
            }
          }
        }
      }

      const { error: membershipError } = await supabase.from("voice_room_members").upsert(
        { room_id: roomId, user_id: user.id },
        { onConflict: "room_id,user_id", ignoreDuplicates: true }
      );

      if (membershipError) {
        setError(membershipError.message);
        setLoading(false);
        return;
      }

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

    return () => { cleanup(); };
  }, [user, roomId, navigate, t, cleanup, spendVX]);

  // Listen for being kicked (membership row deleted by someone else)
  useEffect(() => {
    if (!user || !roomId || !token) return;

    const channel = supabase
      .channel(`kick-watch-${roomId}-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "voice_room_members",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const deleted = payload.old as { user_id?: string };
          if (deleted.user_id === user.id && !leftIntentionally.current) {
            toast({ title: t("vroom.youWereKicked"), variant: "destructive" });
            navigate("/community");
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, roomId, token, navigate, t]);

  const handleLeave = async () => {
    leftIntentionally.current = true;
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
            <p className="text-sm text-muted-foreground">{t("vroom.configDesc")}</p>
            <Button onClick={() => navigate("/community")}>{t("vroom.backToCommunity")}</Button>
          </div>
        </div>
      </Layout>
    );
  }

  const isOwner = user?.id === ownerId;

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
              <h1 className="text-xl font-bold flex items-center gap-2">
                {roomName}
                {isPrivate && <Lock className="h-4 w-4 text-muted-foreground" aria-label={t("vroom.private")} />}
              </h1>
              <Badge variant="outline" className="mt-0.5 gap-1 text-xs text-emerald-600 border-emerald-500/40">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {t("vroom.live")}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                toast({ title: t("vroom.linkCopied") });
              }}
              aria-label={t("vroom.shareRoom")}
            >
              <Copy className="h-4 w-4 me-1.5" />
              {t("vroom.shareRoom")}
            </Button>
            <Button variant="outline" size="sm" onClick={handleLeave}>
              {t("vroom.leave")}
            </Button>
          </div>
        </div>

        {/* Topic bar */}
        <div className="mb-4 flex items-center gap-2 rounded-xl border bg-muted/30 px-4 py-2.5">
          {editingTopic ? (
            <>
              <Input
                value={topicDraft}
                onChange={(e) => setTopicDraft(e.target.value)}
                placeholder={t("vroom.topicPlaceholder")}
                className="h-7 flex-1 border-none bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
                maxLength={120}
                autoFocus
              />
              <Button size="icon" variant="ghost" className="h-6 w-6 text-green-600" onClick={saveTopic}>
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground" onClick={() => { setEditingTopic(false); setTopicDraft(roomTopic); }}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : (
            <>
              <span className="flex-1 text-sm text-muted-foreground">
                {roomTopic || t("vroom.noTopic")}
              </span>
              {isOwner && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-muted-foreground"
                  onClick={() => { setTopicDraft(roomTopic); setEditingTopic(true); }}
                  aria-label={t("vroom.editTopic")}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
            </>
          )}
        </div>

        <Card>
          <CardContent className="p-6">
            <LiveKitRoom
              serverUrl={livekitUrl}
              token={token}
              connect
              audio
              video={false}
              onDisconnected={() => { void cleanup(); }}
              onError={(err) => {
                setError(err.message);
                toast({ title: t("vroom.connectionError"), description: err.message, variant: "destructive" });
              }}
            >
              <RoomAudioRenderer />
              <RoomContent
                onLeave={handleLeave}
                onKick={handleKick}
                onBan={handleBan}
                ownerId={ownerId}
                currentUserId={user?.id ?? ""}
                roomId={roomId ?? ""}
                t={t}
              />
            </LiveKitRoom>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
