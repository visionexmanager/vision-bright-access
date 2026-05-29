import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useParticipants,
  useLocalParticipant,
  useTracks,
  useConnectionState,
  useAudioPlayback,
  VideoTrack,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Track, ConnectionState, RemoteAudioTrack, AudioPresets, LocalAudioTrack } from "livekit-client";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAdmin } from "@/hooks/useAdmin";
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
  Camera, CameraOff, Check, ChevronDown, ChevronUp, Copy, Hand, Headphones, Loader2,
  Lock, MessageSquare, Mic, MicOff, Monitor, MonitorOff, Pencil, PhoneOff, Radio,
  RefreshCw, Send, Settings2, ShieldX, Unlock, UserX, Users, Volume2, WifiOff, X,
} from "lucide-react";
import { useVXWallet } from "@/hooks/useVXWallet";

const FALLBACK_LIVEKIT_URL = "wss://visionex-hn3vb5hz.livekit.cloud";

// ── Reactions ──────────────────────────────────────────────────────
// Core reactions always visible in the bar
const REACTIONS = ["👍", "❤️", "😂", "😮", "👏"];

// Extra emojis shown in the collapsible picker
const EXTRA_EMOJIS = [
  // Faces
  "😁","😆","😅","🤣","😊","🥰","😍","😎","🤩","🥳",
  "😜","🤪","😝","🤔","🤨","😏","😒","🙄","😤","😡",
  "😢","😭","🥺","😳","🫣","🤯","😇","🥹","😴","🥱",
  "😬","🫠","🤐","😶","😐","🫡","🤭","🫢","🤫","😑",
  // Gestures & body
  "🙌","👋","🤝","✌️","🤞","🤙","👍🏼","👎","💪","🙏",
  "🫶","🫂","💃","🕺","🤜","🤛","🙋","🤦","🤷",
  // Symbols & objects
  "🔥","💯","⭐","🌟","✨","💫","🎉","🎊","🎈","🎁",
  "💥","🚀","💎","🏆","🥇","🎯","💡","❄️","🌈","🌊",
  "⚡","🌙","☀️","🍀","🦋","🌸","🌺","🌻",
  // Fun extras
  "🎵","🎶","🎮","⚽","🏀","🎸","🍕","🍔","🧁","🍭",
  "🐶","😺","🦄","🐧","🦊","🐸","👻","💀","🤖","👽",
];

// High-quality audio options for the LiveKit room — applied once on connect.
const ROOM_OPTIONS = {
  audioCaptureDefaults: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  publishDefaults: {
    audioPreset: AudioPresets.musicHighQuality, // 96 kbps, high fidelity
    dtx: false,  // always transmit, no silence gaps
    red: true,   // redundant encoding for packet-loss resilience
    stopMicTrackOnMute: false,
  },
};

function resolveLiveKitUrl() {
  const configuredUrl = import.meta.env.VITE_LIVEKIT_URL as string | undefined;
  const url = configuredUrl?.trim().replace(/^["']|["']$/g, "");
  if (!url || url.includes("YOUR_PROJECT") || !url.startsWith("wss://")) {
    return FALLBACK_LIVEKIT_URL;
  }
  return url;
}

// ── Spatial audio renderer ─────────────────────────────────────────
// Uses LiveKit's @internal Web Audio plugin API to route each remote
// participant's mic through a StereoPannerNode, spreading voices across
// the stereo field (left ↔ right) so they're easier to distinguish.
// When unmounted (spatial audio off) it restores normal playback.
function SpatialAudioRenderer({ currentUserId }: { currentUserId: string }) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  // Map: participantIdentity → { panner, track }
  const nodesRef = useRef<Map<string, { panner: StereoPannerNode; track: RemoteAudioTrack }>>(
    new Map()
  );

  const remoteTracks = useTracks(
    [{ source: Track.Source.Microphone, withPlaceholder: false }],
  ).filter((t) => t.participant.identity !== currentUserId && t.publication?.track);

  // Create AudioContext once; tear down on unmount
  useEffect(() => {
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    return () => {
      // Restore normal LiveKit audio element playback for every track
      for (const [, { track }] of nodesRef.current) {
        try { track.setAudioContext(undefined); track.setWebAudioPlugins([]); } catch { /* ignore */ }
      }
      nodesRef.current.clear();
      void ctx.close();
    };
  }, []);

  // Connect/update tracks whenever remote participants change
  useEffect(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});

    const liveIds = new Set(remoteTracks.map((t) => t.participant.identity));
    const total = remoteTracks.length;

    remoteTracks.forEach((trackRef, idx) => {
      const identity = trackRef.participant.identity;
      const track = trackRef.publication?.track as RemoteAudioTrack | undefined;
      if (!track) return;

      // Spread voices evenly: −0.7 (far left) … 0 (center) … +0.7 (far right)
      const panValue = total > 1 ? ((idx / (total - 1)) * 2 - 1) * 0.7 : 0;

      const existing = nodesRef.current.get(identity);
      if (existing) {
        existing.panner.pan.setTargetAtTime(panValue, ctx.currentTime, 0.05);
      } else {
        const panner = ctx.createStereoPanner();
        panner.pan.value = panValue;
        try {
          // setAudioContext → LiveKit mutes the <audio> element and routes
          //   through ctx.  setWebAudioPlugins inserts: src → panner → ctx.destination
          track.setAudioContext(ctx);
          track.setWebAudioPlugins([panner]);
          nodesRef.current.set(identity, { panner, track });
        } catch (e) {
          console.warn("[SpatialAudio] setup failed for", identity, e);
        }
      }
    });

    // Clean up nodes for participants who left
    for (const [id, { track }] of nodesRef.current) {
      if (!liveIds.has(id)) {
        try { track.setAudioContext(undefined); track.setWebAudioPlugins([]); } catch { /* ignore */ }
        nodesRef.current.delete(id);
      }
    }
  }, [remoteTracks]);

  return null;
}

// ── Types ──────────────────────────────────────────────────────────
interface FloatingReaction {
  id: string;
  emoji: string;
  x: number;
  visible: boolean;
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  ts: number;
}

// ── Participant tile ───────────────────────────────────────────────
interface ParticipantTileProps {
  participant: ReturnType<typeof useParticipants>[number];
  canModerate: boolean;
  isMe: boolean;
  isRaisingHand: boolean;
  onKick: (identity: string, name: string) => void;
  onBan: (identity: string, name: string) => void;
  onMuteUser: (identity: string) => void;
  t: (key: string) => string;
}

function ParticipantTile({ participant, canModerate, isMe, isRaisingHand, onKick, onBan, onMuteUser, t }: ParticipantTileProps) {
  const tracks = useTracks(
    [{ source: Track.Source.Microphone, withPlaceholder: true }],
    { participant }
  );
  const cameraTracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: false }],
    { participant }
  );
  const cameraTrack = cameraTracks[0];
  const isMuted = !tracks.some((tr) => tr.publication?.isMuted === false && tr.publication?.isEnabled);
  const isSpeaking = participant.isSpeaking;
  const displayName = participant.name || participant.identity;

  return (
    <div className={`relative flex flex-col items-center gap-2 rounded-2xl border p-4 transition-all ${isSpeaking ? "border-primary bg-primary/5 shadow-md" : "border-border bg-muted/30"}`}>
      {isRaisingHand && (
        <span className="absolute -top-2 -right-2 text-lg animate-bounce z-10 select-none">✋</span>
      )}
      {cameraTrack ? (
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black">
          <VideoTrack trackRef={cameraTrack} className="w-full h-full object-cover" />
          {isSpeaking && (
            <span className="absolute bottom-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
              <Volume2 className="h-2.5 w-2.5 text-primary-foreground" />
            </span>
          )}
        </div>
      ) : (
        <div className={`relative flex h-14 w-14 items-center justify-center rounded-full text-2xl font-bold text-primary-foreground ${isSpeaking ? "bg-primary" : "bg-muted-foreground/30"}`}>
          {displayName.charAt(0).toUpperCase()}
          {isSpeaking && (
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
              <Volume2 className="h-2.5 w-2.5 text-primary-foreground" />
            </span>
          )}
        </div>
      )}
      <span className="max-w-[80px] truncate text-xs font-medium">{displayName}</span>
      {isMuted && <MicOff className="h-3.5 w-3.5 text-muted-foreground" />}

      {canModerate && !isMe && (
        <div className="flex gap-1 mt-1">
          {/* Mute individual user */}
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-muted-foreground hover:bg-muted hover:text-foreground"
            title={t("vroom.muteUser")}
            onClick={() => onMuteUser(participant.identity)}
          >
            <MicOff className="h-3.5 w-3.5" />
          </Button>

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

// ── Room inner content ─────────────────────────────────────────────
interface RoomContentProps {
  onLeave: () => void;
  onKick: (identity: string, name: string) => void;
  onBan: (identity: string, name: string) => void;
  canModerate: boolean;
  currentUserId: string;
  roomId: string;
  raisedHands: Set<string>;
  t: (key: string) => string;
}

function RoomContent({ onLeave, onKick, onBan, canModerate, currentUserId, roomId, raisedHands, t }: RoomContentProps) {
  const participants = useParticipants();
  const { localParticipant, isScreenShareEnabled } = useLocalParticipant();
  const localParticipantRef = useRef(localParticipant);
  const connectionState = useConnectionState();
  const [muted, setMuted] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const [screenAudioEnabled, setScreenAudioEnabled] = useState(false);
  const [screenShareRestarting, setScreenShareRestarting] = useState(false);
  const [spatialAudioEnabled, setSpatialAudioEnabled] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  // Camera
  const [cameraEnabled, setCameraEnabled] = useState(false);
  // Chat
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  // Owner-controlled room permissions
  const [screenShareAllowed, setScreenShareAllowed] = useState(true);
  const [micAllowed, setMicAllowed] = useState(true);
  const [cameraAllowed, setCameraAllowed] = useState(true);
  const [reactionSoundsEnabled, setReactionSoundsEnabled] = useState(true);
  const reactionSoundsEnabledRef = useRef(true);
  const [showPermissionsPanel, setShowPermissionsPanel] = useState(false);
  // Audio-only share
  const [isAudioShareEnabled, setIsAudioShareEnabled] = useState(false);
  const audioShareTrackRef = useRef<LocalAudioTrack | null>(null);
  const broadcastChRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  // Mobile audio unlock — iOS/Android require a user gesture before playing remote audio
  const { canPlayAudio, startAudio } = useAudioPlayback();

  // Screen share tracks for all participants
  const screenShareTracks = useTracks([{ source: Track.Source.ScreenShare, withPlaceholder: false }]);

  // Join/leave sound + notification tracking
  const prevParticipantsRef = useRef<Map<string, string>>(new Map());
  const isInitialLoadRef = useRef(true);

  // Track reconnecting state for toast
  const wasReconnectingRef = useRef(false);

  useEffect(() => { localParticipantRef.current = localParticipant; }, [localParticipant]);
  useEffect(() => { reactionSoundsEnabledRef.current = reactionSoundsEnabled; }, [reactionSoundsEnabled]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  // Reconnecting banner + reconnected toast
  useEffect(() => {
    if (connectionState === ConnectionState.Reconnecting) {
      wasReconnectingRef.current = true;
    } else if (connectionState === ConnectionState.Connected && wasReconnectingRef.current) {
      wasReconnectingRef.current = false;
      toast({ title: t("vroom.reconnected") });
    }
  }, [connectionState, t]);

  // Join/leave notifications
  useEffect(() => {
    const currentMap = new Map<string, string>(
      participants.map((p) => [p.identity, p.name || p.identity])
    );

    if (isInitialLoadRef.current) {
      prevParticipantsRef.current = currentMap;
      isInitialLoadRef.current = false;
      return;
    }

    const prev = prevParticipantsRef.current;

    // Detect joined
    for (const [identity, name] of currentMap) {
      if (!prev.has(identity) && identity !== currentUserId) {
        playJoinLeaveSound(true);
        toast({ title: `${name} ${t("vroom.userJoined")}` });
      }
    }

    // Detect left
    for (const [identity, name] of prev) {
      if (!currentMap.has(identity) && identity !== currentUserId) {
        playJoinLeaveSound(false);
        toast({ title: `${name} ${t("vroom.userLeft")}` });
      }
    }

    prevParticipantsRef.current = currentMap;
  }, [participants, currentUserId, t]);

  // Broadcast channel: reactions + mute_all + hand_raised + screen_share
  useEffect(() => {
    const ch = supabase
      .channel(`room-bc-${roomId}`, { config: { broadcast: { self: true } } })
      .on("broadcast", { event: "reaction" }, ({ payload }: { payload: { emoji: string; senderId: string; senderName: string } }) => {
        const id = Math.random().toString(36).slice(2);
        const x = 5 + Math.random() * 85;
        const r: FloatingReaction = { id, emoji: payload.emoji, x, visible: true };
        setFloatingReactions((prev) => [...prev, r]);
        setTimeout(() => setFloatingReactions((prev) => prev.map((item) => item.id === id ? { ...item, visible: false } : item)), 1600);
        setTimeout(() => setFloatingReactions((prev) => prev.filter((item) => item.id !== id)), 2600);
        // Play sound + notify when someone else sends a reaction
        if (payload.senderId !== currentUserId) {
          playReactionSound(payload.emoji, reactionSoundsEnabledRef.current);
          toast({ title: `${payload.senderName || payload.senderId} ${payload.emoji}`, duration: 2500 });
        }
      })
      .on("broadcast", { event: "mute_all" }, ({ payload }: { payload: { byUserId: string } }) => {
        if (payload.byUserId === currentUserId) return;
        localParticipantRef.current?.setMicrophoneEnabled(false);
        setMuted(true);
        toast({ title: t("vroom.mutedByOwner") });
      })
      .on("broadcast", { event: "mute_user" }, ({ payload }: { payload: { userId: string } }) => {
        if (payload.userId !== currentUserId) return;
        localParticipantRef.current?.setMicrophoneEnabled(false);
        setMuted(true);
        toast({ title: t("vroom.mutedByOwner") });
      })
      .on("broadcast", { event: "force_leave" }, ({ payload }: { payload: { userId: string; action: string } }) => {
        if (payload.userId !== currentUserId) return;
        const msg = payload.action === "banned" ? t("vroom.youAreBanned") : t("vroom.youWereKicked");
        toast({ title: msg, variant: "destructive" });
        onLeave();
      })
      .on("broadcast", { event: "room_permissions" }, ({ payload }: { payload: { byUserId: string; screenShareAllowed?: boolean; micAllowed?: boolean; cameraAllowed?: boolean; reactionSoundsEnabled?: boolean } }) => {
        if (payload.byUserId === currentUserId) return;
        if (payload.screenShareAllowed !== undefined) setScreenShareAllowed(payload.screenShareAllowed);
        if (payload.micAllowed !== undefined) {
          setMicAllowed(payload.micAllowed);
          if (!payload.micAllowed) {
            localParticipantRef.current?.setMicrophoneEnabled(false);
            setMuted(true);
            toast({ title: t("vroom.micLockedByOwner") });
          }
        }
        if (payload.cameraAllowed !== undefined) {
          setCameraAllowed(payload.cameraAllowed);
          if (!payload.cameraAllowed) {
            localParticipantRef.current?.setCameraEnabled(false);
            setCameraEnabled(false);
            toast({ title: t("vroom.cameraLockedByOwner") });
          }
        }
        if (payload.reactionSoundsEnabled !== undefined) {
          setReactionSoundsEnabled(payload.reactionSoundsEnabled);
          reactionSoundsEnabledRef.current = payload.reactionSoundsEnabled;
        }
      })
      .on("broadcast", { event: "hand_raised" }, ({ payload }: { payload: { userId: string; userName: string } }) => {
        if (payload.userId === currentUserId) return;
        toast({ title: `✋ ${payload.userName} ${t("vroom.raisedHand")}`, duration: 3000 });
      })
      .on("broadcast", { event: "screen_share" }, ({ payload }: { payload: { userId: string; userName: string; started: boolean } }) => {
        if (payload.userId === currentUserId) return;
        const msg = payload.started ? t("vroom.startedScreenShare") : t("vroom.stoppedScreenShare");
        toast({ title: `🖥️ ${payload.userName} ${msg}`, duration: 3000 });
      })
      .on("broadcast", { event: "chat_message" }, ({ payload }: { payload: ChatMessage }) => {
        setChatMessages((prev) => [...prev, payload]);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") broadcastChRef.current = ch;
      });

    return () => {
      supabase.removeChannel(ch);
      broadcastChRef.current = null;
    };
  }, [roomId, currentUserId, t]);

  const toggleMic = async () => {
    // Block unmute if owner locked the mic (non-owners only)
    if (muted && !micAllowed && !canModerate) {
      toast({ title: t("vroom.micLockedByOwner") });
      return;
    }
    await localParticipant.setMicrophoneEnabled(muted);
    setMuted(!muted);
  };

  const toggleHand = async () => {
    const newVal = !handRaised;
    setHandRaised(newVal);
    await supabase
      .from("voice_room_members")
      .update({ raise_hand: newVal })
      .eq("room_id", roomId)
      .eq("user_id", currentUserId);
    // Notify all participants when raising (not lowering)
    if (newVal) {
      broadcastChRef.current?.send({
        type: "broadcast",
        event: "hand_raised",
        payload: {
          userId: currentUserId,
          userName: localParticipant.name || currentUserId,
        },
      });
    }
  };

  const muteAll = () => {
    broadcastChRef.current?.send({
      type: "broadcast",
      event: "mute_all",
      payload: { byUserId: currentUserId },
    });
    toast({ title: t("vroom.mutedAll") });
  };

  const sendReaction = (emoji: string) => {
    playReactionSound(emoji, reactionSoundsEnabled);
    broadcastChRef.current?.send({
      type: "broadcast",
      event: "reaction",
      payload: {
        emoji,
        senderId: currentUserId,
        senderName: localParticipant.name || currentUserId,
      },
    });
  };

  // Wrapper kick: broadcast force_leave first so the kicked user navigates instantly
  const kickUser = (identity: string, name: string) => {
    broadcastChRef.current?.send({
      type: "broadcast",
      event: "force_leave",
      payload: { userId: identity, action: "kicked" },
    });
    onKick(identity, name);
  };

  // Wrapper ban: broadcast + DB
  const banUser = (identity: string, name: string) => {
    broadcastChRef.current?.send({
      type: "broadcast",
      event: "force_leave",
      payload: { userId: identity, action: "banned" },
    });
    onBan(identity, name);
  };

  // Mute a specific user
  const muteUser = (identity: string) => {
    broadcastChRef.current?.send({
      type: "broadcast",
      event: "mute_user",
      payload: { userId: identity },
    });
  };

  // Owner: toggle screen share permission for all
  const toggleScreenSharePermission = () => {
    const newVal = !screenShareAllowed;
    setScreenShareAllowed(newVal);
    broadcastChRef.current?.send({
      type: "broadcast",
      event: "room_permissions",
      payload: { byUserId: currentUserId, screenShareAllowed: newVal },
    });
    toast({ title: newVal ? t("vroom.screenShareEnabled") : t("vroom.screenShareDisabled") });
  };

  // Owner: lock/unlock mic for all
  const toggleMicPermission = () => {
    const newVal = !micAllowed;
    setMicAllowed(newVal);
    broadcastChRef.current?.send({
      type: "broadcast",
      event: "room_permissions",
      payload: { byUserId: currentUserId, micAllowed: newVal },
    });
    toast({ title: newVal ? t("vroom.micUnlocked") : t("vroom.micLocked") });
  };

  // Owner: toggle reaction sounds for all
  const toggleReactionSounds = () => {
    const newVal = !reactionSoundsEnabled;
    setReactionSoundsEnabled(newVal);
    reactionSoundsEnabledRef.current = newVal;
    broadcastChRef.current?.send({
      type: "broadcast",
      event: "room_permissions",
      payload: { byUserId: currentUserId, reactionSoundsEnabled: newVal },
    });
  };

  // Camera toggle
  const toggleCamera = async () => {
    if (!cameraEnabled && !cameraAllowed && !canModerate) {
      toast({ title: t("vroom.cameraLockedByOwner") });
      return;
    }
    try {
      await localParticipant.setCameraEnabled(!cameraEnabled);
      setCameraEnabled((v) => !v);
    } catch {
      toast({ title: t("vroom.cameraError"), variant: "destructive" });
    }
  };

  // Owner: toggle camera permission for all
  const toggleCameraPermission = () => {
    const newVal = !cameraAllowed;
    setCameraAllowed(newVal);
    broadcastChRef.current?.send({
      type: "broadcast",
      event: "room_permissions",
      payload: { byUserId: currentUserId, cameraAllowed: newVal },
    });
    toast({ title: newVal ? t("vroom.cameraUnlocked") : t("vroom.cameraLocked") });
  };

  // Send chat message
  const sendChatMessage = () => {
    const text = chatInput.trim();
    if (!text) return;
    const msg: ChatMessage = {
      id: Math.random().toString(36).slice(2),
      senderId: currentUserId,
      senderName: localParticipant.name || currentUserId,
      text,
      ts: Date.now(),
    };
    broadcastChRef.current?.send({
      type: "broadcast",
      event: "chat_message",
      payload: msg,
    });
    setChatInput("");
  };

  // Audio-only share (system/tab audio without visible screen)
  const toggleAudioShare = async () => {
    if (isAudioShareEnabled) {
      if (audioShareTrackRef.current) {
        await localParticipant.unpublishTrack(audioShareTrackRef.current);
        audioShareTrackRef.current.stop();
        audioShareTrackRef.current = null;
      }
      setIsAudioShareEnabled(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { width: 1, height: 1, frameRate: 1 } as MediaTrackConstraints,
          audio: true,
        });
        // Stop video immediately — we only want the audio track
        stream.getVideoTracks().forEach((t) => t.stop());
        const mediaAudioTrack = stream.getAudioTracks()[0];
        if (!mediaAudioTrack) {
          toast({ title: t("vroom.noAudioTrack"), variant: "destructive" });
          return;
        }
        const lkTrack = new LocalAudioTrack(mediaAudioTrack, undefined, false);
        await localParticipant.publishTrack(lkTrack, { source: Track.Source.ScreenShareAudio });
        audioShareTrackRef.current = lkTrack;
        setIsAudioShareEnabled(true);
        mediaAudioTrack.onended = () => {
          setIsAudioShareEnabled(false);
          audioShareTrackRef.current = null;
        };
      } catch {
        toast({ title: t("vroom.screenShareError"), variant: "destructive" });
      }
    }
  };

  const toggleScreenShare = async () => {
    if (!isScreenShareEnabled && !screenShareAllowed && !canModerate) {
      toast({ title: t("vroom.screenShareDisabled") });
      return;
    }
    try {
      const willEnable = !isScreenShareEnabled;
      await localParticipant.setScreenShareEnabled(
        willEnable,
        willEnable ? { audio: screenAudioEnabled } : undefined,
      );
      broadcastChRef.current?.send({
        type: "broadcast",
        event: "screen_share",
        payload: {
          userId: currentUserId,
          userName: localParticipant.name || currentUserId,
          started: willEnable,
        },
      });
    } catch {
      toast({ title: t("vroom.screenShareError"), variant: "destructive" });
    }
  };

  // Toggle screen-share audio on/off. If already sharing, restarts the share
  // so the browser can capture (or stop capturing) system audio.
  const toggleScreenAudio = async () => {
    const newVal = !screenAudioEnabled;
    setScreenAudioEnabled(newVal);
    if (!isScreenShareEnabled) return; // not sharing — just flip the flag
    setScreenShareRestarting(true);
    try {
      await localParticipant.setScreenShareEnabled(false);
      await localParticipant.setScreenShareEnabled(true, { audio: newVal });
    } catch {
      toast({ title: t("vroom.screenShareError"), variant: "destructive" });
    } finally {
      setScreenShareRestarting(false);
    }
  };

  // Show screen share button on all devices; getDisplayMedia may not work on some mobile
  // browsers but we handle the error gracefully instead of hiding the button.
  const canScreenShare = true;

  return (
    <div className="flex flex-col gap-6">
      {/* Mobile audio unlock — shown when browser blocks autoplay (iOS Safari, etc.) */}
      {!canPlayAudio && (
        <button
          onClick={startAudio}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-400 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 transition-colors hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700 animate-pulse"
          aria-label={t("vroom.tapToHear")}
        >
          <Volume2 className="h-4 w-4 shrink-0" />
          {t("vroom.tapToHear")}
        </button>
      )}

      {/* Reconnecting banner */}
      {connectionState === ConnectionState.Reconnecting && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-amber-700">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm font-medium">{t("vroom.reconnecting")}</span>
        </div>
      )}

      {/* Screen share tracks */}
      {screenShareTracks.length > 0 && (
        <div className="flex flex-col gap-3">
          {screenShareTracks.map((track) => {
            const isOwn = track.participant.identity === currentUserId;
            const participantName = track.participant.name || track.participant.identity;
            return (
              <div key={track.participant.identity} className="relative aspect-video rounded-xl bg-black border overflow-hidden">
                <VideoTrack trackRef={track} />
                <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
                  {participantName} — {t("vroom.sharingScreen")}
                </span>
                {isOwn && (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="absolute top-2 right-2 h-7 text-xs"
                    onClick={toggleScreenShare}
                  >
                    <MonitorOff className="h-3.5 w-3.5 me-1" />
                    {t("vroom.stopSharing")}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Participants grid */}
      <div className="relative">
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
              canModerate={canModerate}
              isMe={p.identity === currentUserId}
              isRaisingHand={raisedHands.has(p.identity)}
              onKick={kickUser}
              onBan={banUser}
              onMuteUser={muteUser}
              t={t}
            />
          ))}
        </div>

        {/* Floating reactions overlay */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {floatingReactions.map((r) => (
            <div
              key={r.id}
              className={`absolute bottom-0 text-4xl transition-all duration-1000 ease-out select-none ${r.visible ? "-translate-y-24 opacity-100" : "-translate-y-48 opacity-0"}`}
              style={{ left: `${r.x}%` }}
            >
              {r.emoji}
            </div>
          ))}
        </div>
      </div>

      {/* Reaction bar + collapsible emoji picker */}
      <div className="flex flex-col gap-2">
        {/* Expanded emoji picker */}
        {showEmojiPicker && (
          <div className="rounded-xl border bg-card p-3 shadow-md">
            <div className="flex max-h-44 flex-wrap gap-1 overflow-y-auto">
              {EXTRA_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => { sendReaction(emoji); setShowEmojiPicker(false); }}
                  className="rounded-lg p-1 text-xl leading-none transition-transform hover:scale-125 hover:bg-muted active:scale-95"
                  aria-label={emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Core reactions + toggle button */}
        <div className="flex items-center justify-center gap-3 rounded-xl border bg-muted/20 py-2.5 px-4">
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => sendReaction(emoji)}
              className="text-2xl transition-transform hover:scale-125 active:scale-95"
              aria-label={emoji}
            >
              {emoji}
            </button>
          ))}

          {/* Divider */}
          <span className="mx-0.5 h-5 w-px rounded-full bg-border" aria-hidden="true" />

          {/* More emojis toggle */}
          <button
            onClick={() => setShowEmojiPicker((v) => !v)}
            className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
              showEmojiPicker
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
            }`}
            aria-label={t("vroom.moreReactions")}
            aria-expanded={showEmojiPicker}
          >
            <span className="text-base leading-none">😀</span>
            {showEmojiPicker
              ? <ChevronDown className="h-3 w-3" />
              : <ChevronUp className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {/* Owner permissions panel */}
      {canModerate && showPermissionsPanel && (
        <div className="rounded-xl border bg-card p-4 shadow-md flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("vroom.roomControls")}</p>
          <div className="flex flex-wrap gap-2">
            {/* Mute all — moved inside the panel */}
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs text-orange-500 border-orange-300 hover:bg-orange-50 hover:border-orange-500"
              onClick={muteAll}
            >
              <MicOff className="h-3.5 w-3.5" />
              {t("vroom.muteAll")}
            </Button>
            <Button
              size="sm"
              variant={micAllowed ? "outline" : "destructive"}
              className="gap-1.5 text-xs"
              onClick={toggleMicPermission}
            >
              <MicOff className="h-3.5 w-3.5" />
              {micAllowed ? t("vroom.lockMic") : t("vroom.unlockMic")}
            </Button>
            <Button
              size="sm"
              variant={screenShareAllowed ? "outline" : "destructive"}
              className="gap-1.5 text-xs"
              onClick={toggleScreenSharePermission}
            >
              <Monitor className="h-3.5 w-3.5" />
              {screenShareAllowed ? t("vroom.disableScreenShare") : t("vroom.enableScreenShare")}
            </Button>
            <Button
              size="sm"
              variant={cameraAllowed ? "outline" : "destructive"}
              className="gap-1.5 text-xs"
              onClick={toggleCameraPermission}
            >
              <Camera className="h-3.5 w-3.5" />
              {cameraAllowed ? t("vroom.lockCamera") : t("vroom.unlockCamera")}
            </Button>
            <Button
              size="sm"
              variant={reactionSoundsEnabled ? "outline" : "secondary"}
              className="gap-1.5 text-xs"
              onClick={toggleReactionSounds}
            >
              <Volume2 className="h-3.5 w-3.5" />
              {reactionSoundsEnabled ? t("vroom.muteReactionSounds") : t("vroom.unmuteReactionSounds")}
            </Button>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 pt-2 flex-wrap">
        {canModerate && (
          <Button
            size="lg"
            variant={showPermissionsPanel ? "secondary" : "outline"}
            className="h-14 w-14 rounded-full p-0"
            onClick={() => setShowPermissionsPanel((v) => !v)}
            title={t("vroom.roomControls")}
            aria-label={t("vroom.roomControls")}
          >
            <Settings2 className="h-6 w-6" />
          </Button>
        )}
        <Button
          size="lg"
          variant={muted ? "destructive" : "outline"}
          className="h-14 w-14 rounded-full p-0"
          onClick={toggleMic}
          aria-label={muted ? t("vroom.unmute") : t("vroom.mute")}
        >
          {muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </Button>

        {/* Camera toggle */}
        <Button
          size="lg"
          variant="outline"
          className={`h-14 w-14 rounded-full p-0 transition-colors ${cameraEnabled ? "bg-teal-500 hover:bg-teal-600 border-teal-500 text-white" : ""}`}
          onClick={toggleCamera}
          aria-label={cameraEnabled ? t("vroom.cameraOff") : t("vroom.cameraOn")}
          title={cameraEnabled ? t("vroom.cameraOff") : t("vroom.cameraOn")}
        >
          {cameraEnabled ? <Camera className="h-6 w-6" /> : <CameraOff className="h-6 w-6" />}
        </Button>

        {/* Chat toggle */}
        <Button
          size="lg"
          variant="outline"
          className={`h-14 w-14 rounded-full p-0 transition-colors ${showChat ? "bg-indigo-500 hover:bg-indigo-600 border-indigo-500 text-white" : ""}`}
          onClick={() => setShowChat((v) => !v)}
          aria-label={t("vroom.chat")}
          title={t("vroom.chat")}
        >
          <MessageSquare className="h-6 w-6" />
        </Button>
        <Button
          size="lg"
          variant="outline"
          className={`h-14 w-14 rounded-full p-0 transition-colors ${handRaised ? "bg-amber-500 hover:bg-amber-600 border-amber-500 text-white" : ""}`}
          onClick={toggleHand}
          aria-label={handRaised ? t("vroom.lowerHand") : t("vroom.raiseHand")}
          title={handRaised ? t("vroom.lowerHand") : t("vroom.raiseHand")}
        >
          <Hand className="h-6 w-6" />
        </Button>

        {/* Spatial audio toggle */}
        <Button
          size="lg"
          variant="outline"
          className={`h-14 w-14 rounded-full p-0 transition-colors ${spatialAudioEnabled ? "bg-purple-500 hover:bg-purple-600 border-purple-500 text-white" : ""}`}
          onClick={() => setSpatialAudioEnabled((v) => !v)}
          aria-pressed={spatialAudioEnabled}
          aria-label={t("vroom.spatialAudio")}
          title={t("vroom.spatialAudio")}
        >
          <Headphones className="h-6 w-6" />
        </Button>

        {/* Screen share — audio sub-toggle appears only while sharing */}
        {canScreenShare && (
          <div className="flex flex-col items-center gap-1">
            <Button
              size="lg"
              variant="outline"
              className={`h-14 w-14 rounded-full p-0 transition-colors ${isScreenShareEnabled ? "bg-blue-500 hover:bg-blue-600 border-blue-500 text-white" : ""}`}
              onClick={toggleScreenShare}
              aria-label={isScreenShareEnabled ? t("vroom.stopSharing") : t("vroom.shareScreen")}
              title={isScreenShareEnabled ? t("vroom.stopSharing") : t("vroom.shareScreen")}
            >
              <Monitor className="h-6 w-6" />
            </Button>
            {isScreenShareEnabled && (
              <button
                type="button"
                disabled={screenShareRestarting}
                className={`flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  screenAudioEnabled
                    ? "border-blue-400 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
                onClick={toggleScreenAudio}
                aria-pressed={screenAudioEnabled}
                aria-label={t("vroom.shareAudio")}
                title={t("vroom.shareAudio")}
              >
                {screenShareRestarting
                  ? <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  : <Volume2 className="h-2.5 w-2.5" />
                }
                <span>{t("vroom.audio")}</span>
              </button>
            )}
          </div>
        )}

        {/* Audio-only share (system/tab audio without screen video) */}
        <Button
          size="lg"
          variant="outline"
          className={`h-14 w-14 rounded-full p-0 transition-colors ${isAudioShareEnabled ? "bg-green-500 hover:bg-green-600 border-green-500 text-white" : ""}`}
          onClick={toggleAudioShare}
          aria-pressed={isAudioShareEnabled}
          aria-label={isAudioShareEnabled ? t("vroom.stopAudioShare") : t("vroom.shareAudioOnly")}
          title={isAudioShareEnabled ? t("vroom.stopAudioShare") : t("vroom.shareAudioOnly")}
        >
          <Radio className="h-6 w-6" />
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

      {/* Chat panel */}
      {showChat && (
        <div className="flex flex-col rounded-2xl border bg-card shadow-md overflow-hidden">
          <div className="flex items-center gap-2 border-b px-4 py-2.5 bg-muted/30">
            <MessageSquare className="h-4 w-4 text-indigo-500" />
            <span className="text-sm font-semibold">{t("vroom.chat")}</span>
          </div>
          <div className="flex flex-col gap-2 p-3 h-64 overflow-y-auto">
            {chatMessages.length === 0 && (
              <p className="text-center text-xs text-muted-foreground mt-8">{t("vroom.chatEmpty")}</p>
            )}
            {chatMessages.map((msg) => {
              const isMe = msg.senderId === currentUserId;
              return (
                <div key={msg.id} className={`flex flex-col gap-0.5 max-w-[80%] ${isMe ? "self-end items-end" : "self-start items-start"}`}>
                  {!isMe && (
                    <span className="text-[10px] text-muted-foreground px-1">{msg.senderName}</span>
                  )}
                  <div className={`rounded-2xl px-3 py-2 text-sm leading-snug ${isMe ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted rounded-bl-sm"}`}>
                    {msg.text}
                  </div>
                  <span className="text-[10px] text-muted-foreground px-1">
                    {new Date(msg.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>
          <form
            className="flex gap-2 border-t px-3 py-2.5"
            onSubmit={(e) => { e.preventDefault(); sendChatMessage(); }}
          >
            <input
              className="flex-1 rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder={t("vroom.chatPlaceholder")}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              maxLength={500}
              autoComplete="off"
            />
            <Button type="submit" size="icon" className="h-9 w-9 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white shrink-0" disabled={!chatInput.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}

      {/* Spatial audio processor — only mounted while the feature is on */}
      {spatialAudioEnabled && <SpatialAudioRenderer currentUserId={currentUserId} />}
    </div>
  );
}

// ── Web Audio join/leave tones ─────────────────────────────────────
function playJoinLeaveSound(joined: boolean) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const startFreq = joined ? 880 : 660;
    const endFreq = joined ? 1047 : 494;
    osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(endFreq, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
    osc.onended = () => ctx.close();
  } catch {
    // AudioContext not available — ignore
  }
}

// ── Reaction sounds ────────────────────────────────────────────────
const LAUGH_EMOJIS = new Set(["😂","🤣","😆","😅","😁","😜","🤪","😝","😄","😃"]);
const LOVE_EMOJIS  = new Set(["❤️","🥰","😍","🫶","💕","💓","💗","💝","😘","🤩"]);
const WOW_EMOJIS   = new Set(["😮","🤯","😱","😳","🫣","🫠"]);
const CLAP_EMOJIS  = new Set(["👏","🙌","🎉","🎊","🥳","🏆","🥇"]);
const SAD_EMOJIS   = new Set(["😢","😭","🥺","😔","😞"]);
const BOO_EMOJIS   = new Set(["👎","😡","😤","😒"]);
const FIRE_EMOJIS  = new Set(["🔥","💯","⚡","💥","🚀"]);

function playReactionSound(emoji: string, enabled: boolean) {
  if (!enabled) return;
  try {
    const ctx = new AudioContext();
    const t0 = ctx.currentTime;
    const sr = ctx.sampleRate;

    const makeNoiseBuf = (dur: number, env: (j: number, len: number) => number) => {
      const len = Math.floor(sr * dur);
      const buf = ctx.createBuffer(1, len, sr);
      const d = buf.getChannelData(0);
      for (let j = 0; j < len; j++) d[j] = (Math.random() * 2 - 1) * env(j, len);
      return buf;
    };

    if (CLAP_EMOJIS.has(emoji) || emoji === "👍") {
      // Realistic clap: transient snap + body noise + tail, layered
      const claps = emoji === "👍" ? 1 : 3;
      for (let i = 0; i < claps; i++) {
        const dt = t0 + i * 0.16 + (i > 0 ? (Math.random() * 0.02 - 0.01) : 0);

        // Sharp attack snap (high-freq noise burst ~2kHz-5kHz)
        const snapBuf = makeNoiseBuf(0.015, (j, len) => Math.exp(-j / (len * 0.25)));
        const snapSrc = ctx.createBufferSource();
        snapSrc.buffer = snapBuf;
        const snapHP = ctx.createBiquadFilter();
        snapHP.type = "highpass"; snapHP.frequency.value = 2200;
        const snapG = ctx.createGain();
        snapG.gain.setValueAtTime(1.2, dt);
        snapSrc.connect(snapHP); snapHP.connect(snapG); snapG.connect(ctx.destination);
        snapSrc.start(dt);

        // Body noise (mid-freq 600-1800Hz)
        const bodyBuf = makeNoiseBuf(0.12, (j, len) => Math.exp(-j / (len * 0.35)));
        const bodySrc = ctx.createBufferSource();
        bodySrc.buffer = bodyBuf;
        const bodyBP = ctx.createBiquadFilter();
        bodyBP.type = "bandpass"; bodyBP.frequency.value = 900; bodyBP.Q.value = 0.5;
        const bodyG = ctx.createGain();
        bodyG.gain.setValueAtTime(0.85, dt);
        bodySrc.connect(bodyBP); bodyBP.connect(bodyG); bodyG.connect(ctx.destination);
        bodySrc.start(dt);

        // Low thump (adds warmth)
        const thumpBuf = makeNoiseBuf(0.06, (j, len) => Math.exp(-j / (len * 0.2)));
        const thumpSrc = ctx.createBufferSource();
        thumpSrc.buffer = thumpBuf;
        const thumpLP = ctx.createBiquadFilter();
        thumpLP.type = "lowpass"; thumpLP.frequency.value = 350;
        const thumpG = ctx.createGain();
        thumpG.gain.setValueAtTime(0.5, dt);
        thumpSrc.connect(thumpLP); thumpLP.connect(thumpG); thumpG.connect(ctx.destination);
        thumpSrc.start(dt);
      }
      setTimeout(() => ctx.close(), 1000);

    } else if (LAUGH_EMOJIS.has(emoji)) {
      // Laughing: "ha ha ha" — pulsed sawtooth with pitch wobble & breathiness
      const pulses = emoji === "🤣" ? 4 : 3;
      for (let i = 0; i < pulses; i++) {
        const dt = t0 + i * 0.17;
        // Voiced part (sawtooth formant)
        const osc = ctx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(280, dt);
        osc.frequency.linearRampToValueAtTime(320, dt + 0.04);
        osc.frequency.linearRampToValueAtTime(260, dt + 0.09);
        const vgain = ctx.createGain();
        vgain.gain.setValueAtTime(0, dt);
        vgain.gain.linearRampToValueAtTime(0.18, dt + 0.03);
        vgain.gain.linearRampToValueAtTime(0, dt + 0.10);
        // Formant filter (vowel "a")
        const f1 = ctx.createBiquadFilter(); f1.type = "peaking"; f1.frequency.value = 750; f1.gain.value = 8; f1.Q.value = 2;
        const f2 = ctx.createBiquadFilter(); f2.type = "peaking"; f2.frequency.value = 1200; f2.gain.value = 4; f2.Q.value = 3;
        osc.connect(f1); f1.connect(f2); f2.connect(vgain); vgain.connect(ctx.destination);
        osc.start(dt); osc.stop(dt + 0.12);

        // Breath noise layered
        const breathBuf = makeNoiseBuf(0.08, (j, len) => Math.exp(-j / (len * 0.5)) * 0.3);
        const bSrc = ctx.createBufferSource(); bSrc.buffer = breathBuf;
        const bBP = ctx.createBiquadFilter(); bBP.type = "bandpass"; bBP.frequency.value = 3000; bBP.Q.value = 0.8;
        const bG = ctx.createGain(); bG.gain.setValueAtTime(0.12, dt);
        bSrc.connect(bBP); bBP.connect(bG); bG.connect(ctx.destination);
        bSrc.start(dt);
      }
      setTimeout(() => ctx.close(), 900);

    } else if (LOVE_EMOJIS.has(emoji)) {
      // Cute heartbeat: soft "ba-bum" with warm harmonics + sparkle
      const playThump = (at: number, freq: number, vol: number) => {
        const osc = ctx.createOscillator(); osc.type = "sine"; osc.frequency.value = freq;
        const h2 = ctx.createOscillator(); h2.type = "sine"; h2.frequency.value = freq * 2;
        const masterG = ctx.createGain();
        masterG.gain.setValueAtTime(0, at);
        masterG.gain.linearRampToValueAtTime(vol, at + 0.018);
        masterG.gain.exponentialRampToValueAtTime(0.001, at + 0.22);
        const h2G = ctx.createGain(); h2G.gain.value = 0.3;
        osc.connect(masterG); h2.connect(h2G); h2G.connect(masterG); masterG.connect(ctx.destination);
        osc.start(at); osc.stop(at + 0.25);
        h2.start(at); h2.stop(at + 0.25);
      };
      // "ba" — deeper
      playThump(t0, 95, 0.22);
      // "bum" — slightly higher
      playThump(t0 + 0.14, 80, 0.18);

      // Sparkle ping on top (cute glitter)
      const sparkOsc = ctx.createOscillator(); sparkOsc.type = "sine"; sparkOsc.frequency.value = 1400;
      const sparkG = ctx.createGain();
      sparkG.gain.setValueAtTime(0.12, t0);
      sparkG.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35);
      sparkOsc.connect(sparkG); sparkG.connect(ctx.destination);
      sparkOsc.start(t0); sparkOsc.stop(t0 + 0.36);
      sparkOsc.onended = () => ctx.close();

    } else if (WOW_EMOJIS.has(emoji)) {
      // Gasp / sharp inhale: rising filtered noise burst mimicking breath intake
      const gaspBuf = makeNoiseBuf(0.32, (j, len) => {
        const env = Math.sin((j / len) * Math.PI); // rises then falls
        return env * Math.exp(-j / (len * 1.2)) * 1.4;
      });
      const gaspSrc = ctx.createBufferSource(); gaspSrc.buffer = gaspBuf;

      // Rising bandpass to mimic vocal tract opening
      const bp1 = ctx.createBiquadFilter(); bp1.type = "bandpass"; bp1.Q.value = 1.8;
      bp1.frequency.setValueAtTime(800, t0);
      bp1.frequency.exponentialRampToValueAtTime(2400, t0 + 0.18);
      bp1.frequency.exponentialRampToValueAtTime(1200, t0 + 0.32);

      const bp2 = ctx.createBiquadFilter(); bp2.type = "bandpass"; bp2.frequency.value = 600; bp2.Q.value = 0.6;

      const masterG = ctx.createGain();
      masterG.gain.setValueAtTime(0, t0);
      masterG.gain.linearRampToValueAtTime(0.55, t0 + 0.06);
      masterG.gain.linearRampToValueAtTime(0.35, t0 + 0.2);
      masterG.gain.linearRampToValueAtTime(0, t0 + 0.32);

      gaspSrc.connect(bp1); bp1.connect(bp2); bp2.connect(masterG); masterG.connect(ctx.destination);
      gaspSrc.start(t0);

      // Small voiced "oh" undertone for realism
      const osc = ctx.createOscillator(); osc.type = "sine";
      osc.frequency.setValueAtTime(220, t0);
      osc.frequency.linearRampToValueAtTime(380, t0 + 0.12);
      const oscG = ctx.createGain();
      oscG.gain.setValueAtTime(0, t0);
      oscG.gain.linearRampToValueAtTime(0.07, t0 + 0.05);
      oscG.gain.linearRampToValueAtTime(0, t0 + 0.2);
      osc.connect(oscG); oscG.connect(ctx.destination);
      osc.start(t0); osc.stop(t0 + 0.22);
      setTimeout(() => ctx.close(), 500);

    } else if (SAD_EMOJIS.has(emoji)) {
      // Sad "aww": descending voiced sigh with breathiness
      const osc = ctx.createOscillator(); osc.type = "sawtooth";
      osc.frequency.setValueAtTime(380, t0);
      osc.frequency.exponentialRampToValueAtTime(200, t0 + 0.5);
      const f1 = ctx.createBiquadFilter(); f1.type = "peaking"; f1.frequency.value = 800; f1.gain.value = 6; f1.Q.value = 2;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.14, t0 + 0.06);
      gain.gain.linearRampToValueAtTime(0.08, t0 + 0.35);
      gain.gain.linearRampToValueAtTime(0, t0 + 0.52);
      osc.connect(f1); f1.connect(gain); gain.connect(ctx.destination);
      osc.start(t0); osc.stop(t0 + 0.54);

      // Breath layer
      const breathBuf = makeNoiseBuf(0.4, (j, len) => 0.15 * Math.exp(-j / (len * 0.8)));
      const bSrc = ctx.createBufferSource(); bSrc.buffer = breathBuf;
      const bBP = ctx.createBiquadFilter(); bBP.type = "bandpass"; bBP.frequency.value = 2500; bBP.Q.value = 0.5;
      const bG = ctx.createGain(); bG.gain.value = 0.25;
      bSrc.connect(bBP); bBP.connect(bG); bG.connect(ctx.destination);
      bSrc.start(t0);
      osc.onended = () => ctx.close();

    } else if (BOO_EMOJIS.has(emoji)) {
      // Boo: low groan / rumble
      const osc = ctx.createOscillator(); osc.type = "sawtooth";
      osc.frequency.setValueAtTime(130, t0);
      osc.frequency.linearRampToValueAtTime(90, t0 + 0.4);
      const f1 = ctx.createBiquadFilter(); f1.type = "peaking"; f1.frequency.value = 500; f1.gain.value = 5; f1.Q.value = 1.5;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.13, t0 + 0.05);
      gain.gain.linearRampToValueAtTime(0, t0 + 0.42);
      osc.connect(f1); f1.connect(gain); gain.connect(ctx.destination);
      osc.start(t0); osc.stop(t0 + 0.44);
      osc.onended = () => ctx.close();

    } else if (FIRE_EMOJIS.has(emoji)) {
      // Hype: bright shimmer rise + crowd energy
      const osc = ctx.createOscillator(); osc.type = "triangle";
      osc.frequency.setValueAtTime(880, t0);
      osc.frequency.exponentialRampToValueAtTime(1760, t0 + 0.08);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.18, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t0); osc.stop(t0 + 0.36);

      // Shimmer overtone
      const osc2 = ctx.createOscillator(); osc2.type = "sine"; osc2.frequency.value = 2640;
      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0.08, t0);
      g2.gain.exponentialRampToValueAtTime(0.001, t0 + 0.2);
      osc2.connect(g2); g2.connect(ctx.destination);
      osc2.start(t0); osc2.stop(t0 + 0.22);
      osc.onended = () => ctx.close();

    } else {
      // Default: soft resonant pop
      const osc = ctx.createOscillator(); osc.type = "sine";
      osc.frequency.setValueAtTime(700, t0);
      osc.frequency.exponentialRampToValueAtTime(350, t0 + 0.12);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.12, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t0); osc.stop(t0 + 0.19);
      osc.onended = () => ctx.close();
    }
  } catch { /* AudioContext unavailable */ }
}

// ── Main page ──────────────────────────────────────────────────────
export default function VoiceRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { spendVX } = useVXWallet();

  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roomName, setRoomName] = useState("");
  const [roomTopic, setRoomTopic] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [editingTopic, setEditingTopic] = useState(false);
  const [topicDraft, setTopicDraft] = useState("");
  const [raisedHands, setRaisedHands] = useState<Set<string>>(new Set());
  const [connectionLost, setConnectionLost] = useState(false);
  const [connectionKey, setConnectionKey] = useState(0);

  const leftIntentionally = useRef(false);
  const roomTopicRef = useRef(roomTopic);
  const livekitUrl = resolveLiveKitUrl();

  useEffect(() => { roomTopicRef.current = roomTopic; }, [roomTopic]);

  const cleanup = useCallback(async () => {
    if (user && roomId) {
      await supabase.from("voice_room_members").delete().eq("room_id", roomId).eq("user_id", user.id);
    }
  }, [user, roomId]);

  // Keep cleanup in a ref so the join effect never re-runs just because the
  // cleanup useCallback got a new reference (e.g. after auth session refresh).
  const cleanupRef = useRef(cleanup);
  useEffect(() => { cleanupRef.current = cleanup; }, [cleanup]);

  const handleKick = useCallback(async (identity: string, name: string) => {
    if (!roomId) return;
    await supabase.from("voice_room_members").delete().eq("room_id", roomId).eq("user_id", identity);
    toast({ title: t("vroom.kickedUser").replace("{name}", name) });
  }, [roomId, t]);

  const handleBan = useCallback(async (identity: string, name: string) => {
    if (!roomId || !user) return;
    await supabase.from("voice_room_bans").upsert(
      { room_id: roomId, user_id: identity, banned_by: user.id },
      { onConflict: "room_id,user_id", ignoreDuplicates: true }
    );
    await supabase.from("voice_room_members").delete().eq("room_id", roomId).eq("user_id", identity);
    toast({ title: t("vroom.bannedUser").replace("{name}", name) });
  }, [roomId, user, t]);

  const saveTopic = async () => {
    if (!roomId) return;
    await supabase.from("voice_rooms").update({ room_topic: topicDraft }).eq("id", roomId);
    setRoomTopic(topicDraft);
    setEditingTopic(false);
    toast({ title: t("vroom.topicSaved") });
  };

  const togglePrivacy = useCallback(async () => {
    if (!roomId) return;
    const newValue = !isPrivate;
    setIsPrivate(newValue);
    await supabase.from("voice_rooms").update({ is_private: newValue }).eq("id", roomId);
    toast({ title: t(newValue ? "vroom.roomNowPrivate" : "vroom.roomNowPublic") });
  }, [roomId, isPrivate, t]);

  const handleReconnect = useCallback(async () => {
    if (!user || !roomId) return;
    // Re-upsert into voice_room_members
    await supabase.from("voice_room_members").upsert(
      { room_id: roomId, user_id: user.id, raise_hand: false },
      { onConflict: "room_id,user_id" }
    );
    // Re-fetch token
    const { data, error: fnErr } = await supabase.functions.invoke("livekit-token", {
      body: {
        roomId,
        userId: user.id,
        userName: user.user_metadata?.display_name || user.email,
      },
    });
    if (fnErr || !data?.token) {
      toast({ title: t("vroom.tokenError"), variant: "destructive" });
      return;
    }
    setToken(data.token);
    setConnectionKey((k) => k + 1);
    setConnectionLost(false);
  }, [user, roomId, t]);

  useEffect(() => {
    // Wait for Supabase auth to fully resolve before acting.  Without this guard,
    // user is null during the brief window before the session is loaded, causing
    // an immediate navigate("/login") that results in a redirect loop — and, on
    // the way back, LiveKit receives a CLIENT_INITIATED disconnect while still
    // connecting, which bubbles up as a spurious "Client initiated disconnect" error.
    if (authLoading) return;
    if (!user) { navigate("/login"); return; }
    if (!roomId) { navigate("/community"); return; }
    // Wait for the async admin check to complete before joining.
    // Without this guard, isAdmin starts as false and changes to true after the
    // DB check, which causes the effect cleanup to run (deleting the member from
    // voice_room_members), triggering the kick subscription and booting the user.
    if (adminLoading) return;

    const getToken = async () => {
      const { data: room } = await supabase
        .from("voice_rooms")
        .select("room_name, room_topic, is_private, owner_id, join_cost_vx, is_default, is_active")
        .eq("id", roomId)
        .single();

      if (!room) {
        setError(t("vroom.notConfigured"));
        setLoading(false);
        return;
      }

      if (!room.is_active && !isAdmin) {
        toast({ title: t("vroom.roomInactive"), variant: "destructive" });
        navigate("/community");
        return;
      }

      setRoomName(room.room_name);
      setRoomTopic(room.room_topic || "");
      setTopicDraft(room.room_topic || "");
      setIsPrivate(room.is_private);
      setOwnerId(room.owner_id);

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

      const { data: existingMember } = await supabase
        .from("voice_room_members")
        .select("id")
        .eq("room_id", roomId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!existingMember && room.owner_id !== user.id && room.join_cost_vx > 0) {
        const ok = await spendVX(room.join_cost_vx, "voice_room_join", roomId, roomId);
        if (!ok) { navigate("/community"); return; }
      }

      // Upsert with raise_hand reset on (re)join
      const { error: membershipError } = await supabase.from("voice_room_members").upsert(
        { room_id: roomId, user_id: user.id, raise_hand: false },
        { onConflict: "room_id,user_id" }
      );
      if (membershipError) { setError(membershipError.message); setLoading(false); return; }

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
    return () => { cleanupRef.current(); };
  // authLoading + adminLoading guard the entry point so the effect only fires
  // once both the Supabase session AND the admin DB check have settled.
  // isAdmin/t/cleanup are intentionally omitted — stable or accessed via refs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, roomId, authLoading, adminLoading]);

  // Listen for being kicked
  useEffect(() => {
    if (!user || !roomId || !token) return;
    const channel = supabase
      .channel(`kick-watch-${roomId}-${user.id}`)
      .on("postgres_changes", {
        event: "DELETE",
        schema: "public",
        table: "voice_room_members",
        filter: `room_id=eq.${roomId}`,
      }, (payload) => {
        const deleted = payload.old as { user_id?: string };
        if (deleted.user_id === user.id && !leftIntentionally.current) {
          toast({ title: t("vroom.youWereKicked"), variant: "destructive" });
          navigate("/community");
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, roomId, token, navigate, t]);

  // Unified room data subscription (topic, privacy, ownership)
  useEffect(() => {
    if (!roomId || !token) return;
    const ch = supabase
      .channel(`room-data-${roomId}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "voice_rooms",
        filter: `id=eq.${roomId}`,
      }, (payload) => {
        const updated = payload.new as { owner_id?: string; room_topic?: string; is_private?: boolean };
        if (updated.owner_id !== undefined) setOwnerId(updated.owner_id);
        if (updated.room_topic !== undefined) {
          setRoomTopic(updated.room_topic);
          // Keep topicDraft in sync unless user is currently editing
          setTopicDraft((prev) => prev === roomTopicRef.current ? updated.room_topic! : prev);
        }
        if (updated.is_private !== undefined) setIsPrivate(updated.is_private);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [roomId, token]);

  // Raised hands: initial load + realtime updates
  useEffect(() => {
    if (!roomId || !token) return;

    supabase
      .from("voice_room_members")
      .select("user_id, raise_hand")
      .eq("room_id", roomId)
      .eq("raise_hand", true)
      .then(({ data }) => {
        if (data) setRaisedHands(new Set(data.map((m) => m.user_id)));
      });

    const ch = supabase
      .channel(`room-hands-${roomId}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "voice_room_members",
        filter: `room_id=eq.${roomId}`,
      }, (payload) => {
        const updated = payload.new as { user_id?: string; raise_hand?: boolean };
        if (!updated.user_id) return;
        setRaisedHands((prev) => {
          const next = new Set(prev);
          if (updated.raise_hand) next.add(updated.user_id!);
          else next.delete(updated.user_id!);
          return next;
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [roomId, token]);

  const handleLeave = async () => {
    leftIntentionally.current = true;
    await cleanup();
    navigate("/community");
  };

  const canModerate = user?.id === ownerId || isAdmin;

  if (authLoading || loading || adminLoading) {
    return (
      <Layout>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground">{t("vroom.connecting")}</p>
        </div>
      </Layout>
    );
  }

  if (error || !token || !livekitUrl) {
    // Only show the "please configure LiveKit" hint when there's genuinely no
    // token/URL. For runtime LiveKit errors (e.g. "Client initiated disconnect")
    // just show the error message with a retry button instead.
    const isConfigError = !token || !livekitUrl;
    return (
      <Layout>
        <div className="section-container py-16 text-center">
          <div className="mx-auto max-w-md space-y-4">
            <p className="text-lg font-semibold text-destructive">{error || t("vroom.notConfigured")}</p>
            {isConfigError && (
              <p className="text-sm text-muted-foreground">{t("vroom.configDesc")}</p>
            )}
            <div className="flex justify-center gap-3">
              {error && token && (
                <Button variant="outline" onClick={() => { setError(null); setConnectionLost(false); }}>
                  {t("vroom.reconnect")}
                </Button>
              )}
              <Button onClick={() => navigate("/community")}>{t("vroom.backToCommunity")}</Button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

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
                {canModerate ? (
                  <button
                    onClick={togglePrivacy}
                    aria-label={t(isPrivate ? "vroom.makePublic" : "vroom.makePrivate")}
                    title={t(isPrivate ? "vroom.makePublic" : "vroom.makePrivate")}
                    className="inline-flex items-center"
                  >
                    {isPrivate
                      ? <Lock className="h-4 w-4 text-amber-500" />
                      : <Unlock className="h-4 w-4 text-muted-foreground" />
                    }
                  </button>
                ) : (
                  isPrivate && <Lock className="h-4 w-4 text-muted-foreground" aria-label={t("vroom.private")} />
                )}
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
            <Button variant="outline" size="sm" onClick={handleLeave}>{t("vroom.leave")}</Button>
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
              <span className="flex-1 text-sm text-muted-foreground">{roomTopic || t("vroom.noTopic")}</span>
              {canModerate && (
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
            {connectionLost ? (
              <div className="flex flex-col items-center gap-4 py-10 text-center">
                <WifiOff className="h-12 w-12 text-muted-foreground" />
                <div>
                  <p className="text-lg font-semibold">{t("vroom.connectionLost")}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t("vroom.connectionLostDesc")}</p>
                </div>
                <div className="flex gap-3">
                  <Button onClick={handleReconnect}>
                    <RefreshCw className="h-4 w-4 me-2" />
                    {t("vroom.reconnect")}
                  </Button>
                  <Button variant="outline" onClick={handleLeave}>
                    <PhoneOff className="h-4 w-4 me-2" />
                    {t("vroom.leave")}
                  </Button>
                </div>
              </div>
            ) : (
              <LiveKitRoom
                key={connectionKey}
                serverUrl={livekitUrl}
                token={token}
                connect
                audio
                video={false}
                options={ROOM_OPTIONS}
                onDisconnected={() => {
                  if (!leftIntentionally.current) {
                    setConnectionLost(true);
                    toast({ title: t("vroom.connectionLost"), variant: "destructive" });
                  } else {
                    void cleanup();
                  }
                }}
                onError={(err) => {
                  // "Client initiated disconnect" is LiveKit cleanup — not a real error.
                  if (err.message?.toLowerCase().includes("client initiated")) return;

                  // Microphone/camera permission denied by the browser (NotAllowedError).
                  // The user can still be in the room — they're just muted.
                  // Show a non-blocking toast instead of replacing the whole UI.
                  const isMediaPermissionError =
                    (err as { name?: string }).name === "NotAllowedError" ||
                    err.message?.toLowerCase().includes("permission denied") ||
                    err.message?.toLowerCase().includes("notallowederror");
                  if (isMediaPermissionError) {
                    toast({
                      title: t("vroom.micPermissionDenied"),
                      description: t("vroom.micPermissionDesc"),
                      variant: "destructive",
                    });
                    return;
                  }

                  setError(err.message);
                  toast({ title: t("vroom.connectionError"), description: err.message, variant: "destructive" });
                }}
              >
                <RoomAudioRenderer />
                <RoomContent
                  onLeave={handleLeave}
                  onKick={handleKick}
                  onBan={handleBan}
                  canModerate={canModerate}
                  currentUserId={user?.id ?? ""}
                  roomId={roomId ?? ""}
                  raisedHands={raisedHands}
                  t={t}
                />
              </LiveKitRoom>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
