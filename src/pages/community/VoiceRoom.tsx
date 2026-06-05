import { useEffect, useRef, useState, useCallback, useMemo } from "react";
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
  BarChart2, Bell, Check, ChevronDown, ChevronUp, Copy, Crown, Hand, Headphones,
  ImageIcon, LayoutGrid, Loader2, Lock, MessageSquare, Mic, MicOff, Monitor, MonitorOff,
  Music2, Pencil, PhoneOff, RefreshCw, Send, Settings2, ShieldX, Sparkles, Timer,
  Unlock, Upload, UserX, Users, Users2, Video, VideoOff, Volume2, WifiOff, X,
} from "lucide-react";
import { useVXWallet } from "@/hooks/useVXWallet";
import { JoinModal } from "@/components/voice-room/JoinModal";
import { LivePollWidget } from "@/components/voice-room/LivePollWidget";
import type { Poll } from "@/components/voice-room/LivePollWidget";
import { SpeakerQueuePanel } from "@/components/voice-room/SpeakerQueuePanel";
import type { QueueEntry } from "@/components/voice-room/SpeakerQueuePanel";
import { VoiceEffectsPanel } from "@/components/voice-room/VoiceEffectsPanel";
import type { VoiceEffectType } from "@/components/voice-room/VoiceEffectsPanel";

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
interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  ts: number;
}

interface FloatingReaction {
  id: string;
  emoji: string;
  x: number;
  visible: boolean;
}

interface RoomPerms {
  camera: boolean;
  mic: boolean;
  chat: boolean;
  screen: boolean;
}

interface RoomActivityEvent {
  id: string;
  icon: string;
  text: string;
  ts: number;
}

type LayoutType = "gallery" | "speaker" | "cameras";

// ── Participant tile ───────────────────────────────────────────────
interface ParticipantTileProps {
  participant: ReturnType<typeof useParticipants>[number];
  canModerate: boolean;
  isMe: boolean;
  isRaisingHand: boolean;
  onKick: (identity: string, name: string) => void;
  onBan: (identity: string, name: string) => void;
  t: (key: string) => string;
}

function ParticipantTile({ participant, canModerate, isMe, isRaisingHand, onKick, onBan, t }: ParticipantTileProps) {
  const tracks = useTracks(
    [{ source: Track.Source.Microphone, withPlaceholder: true }],
    { participant }
  );
  const isMuted = !tracks.some((tr) => tr.publication?.isMuted === false && tr.publication?.isEnabled);
  const isSpeaking = participant.isSpeaking;
  const displayName = participant.name || participant.identity;

  return (
    <div className={`relative flex flex-col items-center gap-2 rounded-2xl border p-4 transition-all ${isSpeaking ? "border-primary bg-primary/5 shadow-md" : "border-border bg-muted/30"}`}>
      {isRaisingHand && (
        <span className="absolute -top-2 -right-2 text-lg animate-bounce z-10 select-none">✋</span>
      )}
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

      {canModerate && !isMe && (
        <div className="flex gap-1 mt-1">
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
  isOwner: boolean;
  currentUserId: string;
  roomId: string;
  raisedHands: Set<string>;
  roomPerms: RoomPerms;
  onUpdatePerms: (key: keyof RoomPerms, val: boolean) => Promise<void>;
  t: (key: string) => string;
  isOnStage: boolean;
  isListener: boolean;
  isStageMode: boolean;
  stageMembers: Set<string>;
  onPromoteToStage: (userId: string) => Promise<void>;
  onDemoteFromStage: (userId: string) => Promise<void>;
  joinTimeRef: React.MutableRefObject<number>;
}

function RoomContent({ onLeave, onKick, onBan, canModerate, isOwner, currentUserId, roomId, raisedHands, roomPerms, onUpdatePerms, t, isOnStage, isListener, isStageMode, stageMembers, onPromoteToStage, onDemoteFromStage, joinTimeRef }: RoomContentProps) {
  const participants = useParticipants();
  const { localParticipant, isScreenShareEnabled, isCameraEnabled } = useLocalParticipant();
  const localParticipantRef = useRef(localParticipant);
  const connectionState = useConnectionState();
  const [muted, setMuted] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const [screenAudioEnabled, setScreenAudioEnabled] = useState(false);
  const [screenShareRestarting, setScreenShareRestarting] = useState(false);
  const [spatialAudioEnabled, setSpatialAudioEnabled] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [showRoomControls, setShowRoomControls] = useState(false);
  const [audioShareEnabled, setAudioShareEnabled] = useState(false);
  const audioShareTrackRef = useRef<MediaStreamTrack | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [roomEvents, setRoomEvents] = useState<RoomActivityEvent[]>([]);
  const [roomBanners, setRoomBanners] = useState<{ id: string; icon: string; text: string }[]>([]);
  const notifEndRef = useRef<HTMLDivElement>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const broadcastChRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Mobile audio unlock — iOS/Android require a user gesture before playing remote audio
  const { canPlayAudio, startAudio } = useAudioPlayback();

  // New feature state
  const [layout, setLayout] = useState<LayoutType>("gallery");
  const [voiceEffect, setVoiceEffect] = useState<VoiceEffectType>("none");
  const [cameraBlurred, setCameraBlurred] = useState(false);
  const [activePoll, setActivePoll] = useState<Poll | null>(null);
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [showEffects, setShowEffects] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const voiceEffectCleanupRef = useRef<(() => void) | null>(null);

  // Screen share tracks for all participants
  const screenShareTracks = useTracks([{ source: Track.Source.ScreenShare, withPlaceholder: false }]);
  // Camera tracks for all participants
  const allCameraTracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: false }])
    .filter((tr) => tr.publication?.isEnabled && tr.publication?.track);

  // Join/leave sound + notification tracking
  const prevParticipantsRef = useRef<Map<string, string>>(new Map());
  const isInitialLoadRef = useRef(true);

  // Track reconnecting state for toast
  const wasReconnectingRef = useRef(false);

  useEffect(() => { localParticipantRef.current = localParticipant; }, [localParticipant]);

  const addEvent = useCallback((icon: string, text: string) => {
    const id = Math.random().toString(36).slice(2);
    setRoomEvents((prev) => [...prev.slice(-99), { id, icon, text, ts: Date.now() }]);
    setNotifOpen((open) => {
      if (!open) setUnreadNotifs((n) => n + 1);
      return open;
    });
    // Show banner — max 4 visible at once, auto-dismiss after 4s
    setRoomBanners((prev) => [...prev.slice(-3), { id, icon, text }]);
    setTimeout(() => setRoomBanners((prev) => prev.filter((b) => b.id !== id)), 4000);
  }, []);

  // Auto-scroll notifications panel
  useEffect(() => {
    if (notifOpen) {
      setUnreadNotifs(0);
      setTimeout(() => notifEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }, [notifOpen, roomEvents]);

  // Reconnecting banner + reconnected toast
  useEffect(() => {
    if (connectionState === ConnectionState.Reconnecting) {
      wasReconnectingRef.current = true;
    } else if (connectionState === ConnectionState.Connected && wasReconnectingRef.current) {
      wasReconnectingRef.current = false;
      toast({ title: t("vroom.reconnected") });
      addEvent("🔄", t("vroom.reconnected"));
    }
  }, [connectionState, t, addEvent]);

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
        addEvent("🟢", `${name} ${t("vroom.userJoined")}`);
      }
    }

    // Detect left
    for (const [identity, name] of prev) {
      if (!currentMap.has(identity) && identity !== currentUserId) {
        playJoinLeaveSound(false);
        toast({ title: `${name} ${t("vroom.userLeft")}` });
        addEvent("🔴", `${name} ${t("vroom.userLeft")}`);
      }
    }

    prevParticipantsRef.current = currentMap;
  }, [participants, currentUserId, t, addEvent]);

  // Broadcast channel: reactions + mute_all + hand_raised + screen_share + camera + audio_share + perms
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
        addEvent(payload.emoji, `${payload.senderName || payload.senderId} ${payload.emoji}`);
        if (payload.senderId !== currentUserId) {
          toast({ title: `${payload.senderName || payload.senderId} ${payload.emoji}`, duration: 2500 });
        }
      })
      .on("broadcast", { event: "mute_all" }, ({ payload }: { payload: { byUserId: string; byName: string } }) => {
        if (payload.byUserId === currentUserId) return;
        localParticipantRef.current?.setMicrophoneEnabled(false);
        setMuted(true);
        toast({ title: t("vroom.mutedByOwner") });
        addEvent("🔇", `${payload.byName || t("vroom.owner")} ${t("vroom.mutedAll")}`);
      })
      .on("broadcast", { event: "hand_raised" }, ({ payload }: { payload: { userId: string; userName: string } }) => {
        if (payload.userId === currentUserId) return;
        toast({ title: `✋ ${payload.userName} ${t("vroom.raisedHand")}`, duration: 3000 });
        addEvent("✋", `${payload.userName} ${t("vroom.raisedHand")}`);
      })
      .on("broadcast", { event: "screen_share" }, ({ payload }: { payload: { userId: string; userName: string; started: boolean } }) => {
        if (payload.userId === currentUserId) return;
        const msg = payload.started ? t("vroom.startedScreenShare") : t("vroom.stoppedScreenShare");
        toast({ title: `🖥️ ${payload.userName} ${msg}`, duration: 3000 });
        addEvent("🖥️", `${payload.userName} ${msg}`);
      })
      .on("broadcast", { event: "camera_toggle" }, ({ payload }: { payload: { userId: string; userName: string; on: boolean } }) => {
        if (payload.userId === currentUserId) return;
        const msg = payload.on ? t("vroom.cameraOn") : t("vroom.cameraOff");
        addEvent(payload.on ? "📷" : "📷", `${payload.userName}: ${msg}`);
      })
      .on("broadcast", { event: "audio_share" }, ({ payload }: { payload: { userId: string; userName: string; started: boolean } }) => {
        if (payload.userId === currentUserId) return;
        const msg = payload.started ? t("vroom.audioShareActive") : t("vroom.audioShare");
        toast({ title: `🎵 ${payload.userName} — ${msg}`, duration: 3000 });
        addEvent("🎵", `${payload.userName} — ${msg}`);
      })
      .on("broadcast", { event: "perms_changed" }, ({ payload }: { payload: Partial<RoomPerms> & { byUserId: string; byName: string } }) => {
        if (payload.byUserId !== currentUserId) {
          if (payload.mic === false) { localParticipantRef.current?.setMicrophoneEnabled(false); setMuted(true); }
          if (payload.camera === false) { localParticipantRef.current?.setCameraEnabled(false); }
          if (payload.screen === false && isScreenShareEnabled) { localParticipantRef.current?.setScreenShareEnabled(false); }
        }
        // Log the perm change for everyone
        const permLabels: Record<string, string> = {
          mic: t("vroom.allowMic"), camera: t("vroom.allowCamera"),
          chat: t("vroom.allowChat"), screen: t("vroom.allowScreenShare"),
        };
        for (const [key, val] of Object.entries(payload)) {
          if (key === "byUserId" || key === "byName") continue;
          const label = permLabels[key];
          if (label !== undefined) {
            addEvent(val ? "✅" : "🚫", `${payload.byName || t("vroom.owner")}: ${label} ${val ? "✅" : "🚫"}`);
          }
        }
      })
      .on("broadcast", { event: "chat_message" }, ({ payload }: { payload: ChatMessage }) => {
        setChatMessages((prev) => [...prev, payload]);
        addEvent("💬", `${payload.senderName}: ${payload.text.slice(0, 60)}`);
        setChatOpen((open) => {
          if (!open) {
            setUnreadCount((n) => n + 1);
            if (payload.senderId !== currentUserId) {
              toast({ title: `💬 ${payload.senderName}: ${payload.text.slice(0, 60)}`, duration: 4000 });
            }
          }
          return open;
        });
      })
      .on("broadcast", { event: "poll_create" }, ({ payload }: { payload: Poll }) => {
        setActivePoll(payload);
        addEvent("📊", `${t("vroom.newPoll")}: ${payload.question}`);
        if (payload.createdBy !== currentUserId) {
          toast({ title: `📊 ${t("vroom.newPoll")}: ${payload.question}`, duration: 5000 });
        }
      })
      .on("broadcast", { event: "poll_vote" }, ({ payload }: { payload: { pollId: string; optionIndex: number; voterId: string } }) => {
        setActivePoll((prev) => {
          if (!prev || prev.id !== payload.pollId) return prev;
          if (prev.voterIds.includes(payload.voterId)) return prev;
          const newVotes = { ...prev.votes, [payload.optionIndex]: (prev.votes[payload.optionIndex] || 0) + 1 };
          return { ...prev, votes: newVotes, voterIds: [...prev.voterIds, payload.voterId] };
        });
      })
      .on("broadcast", { event: "poll_close" }, () => {
        setActivePoll((prev) => prev ? { ...prev, isActive: false } : null);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") broadcastChRef.current = ch;
      });

    return () => {
      supabase.removeChannel(ch);
      broadcastChRef.current = null;
    };
  }, [roomId, currentUserId, t, addEvent]);

  useEffect(() => {
    if (chatOpen) {
      setUnreadCount(0);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }, [chatOpen, chatMessages]);

  const sendChatMessage = () => {
    const text = chatInput.trim();
    if (!text || !broadcastChRef.current) return;
    const msg: ChatMessage = {
      id: Math.random().toString(36).slice(2),
      senderId: currentUserId,
      senderName: localParticipant.name || currentUserId,
      text,
      ts: Date.now(),
    };
    broadcastChRef.current.send({ type: "broadcast", event: "chat_message", payload: msg });
    setChatInput("");
  };

  // ── Voice effects ────────────────────────────────────────────────
  const applyVoiceEffect = async (effect: VoiceEffectType) => {
    if (voiceEffectCleanupRef.current) {
      voiceEffectCleanupRef.current();
      voiceEffectCleanupRef.current = null;
      await localParticipant.setMicrophoneEnabled(false);
    }
    setVoiceEffect(effect);
    if (effect === "none") {
      await localParticipant.setMicrophoneEnabled(true);
      return;
    }
    try {
      const rawStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(rawStream);
      const dest = ctx.createMediaStreamDestination();

      if (effect === "robot") {
        const carrier = ctx.createOscillator();
        carrier.frequency.value = 50;
        carrier.start();
        const ringGain = ctx.createGain();
        carrier.connect(ringGain.gain);
        source.connect(ringGain);
        ringGain.connect(dest);
        voiceEffectCleanupRef.current = () => { carrier.stop(); rawStream.getTracks().forEach((t) => t.stop()); ctx.close(); };
      } else if (effect === "echo") {
        const delay = ctx.createDelay(1.0);
        delay.delayTime.value = 0.3;
        const feedback = ctx.createGain();
        feedback.gain.value = 0.4;
        source.connect(dest);
        source.connect(delay);
        delay.connect(feedback);
        feedback.connect(delay);
        delay.connect(dest);
        voiceEffectCleanupRef.current = () => { rawStream.getTracks().forEach((t) => t.stop()); ctx.close(); };
      } else if (effect === "reverb") {
        const convolver = ctx.createConvolver();
        const len = ctx.sampleRate * 2;
        const buf = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let ch = 0; ch < 2; ch++) {
          const d = buf.getChannelData(ch);
          for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.5);
        }
        convolver.buffer = buf;
        const wet = ctx.createGain(); wet.gain.value = 0.5;
        const dry = ctx.createGain(); dry.gain.value = 0.5;
        source.connect(convolver); convolver.connect(wet); wet.connect(dest);
        source.connect(dry); dry.connect(dest);
        voiceEffectCleanupRef.current = () => { rawStream.getTracks().forEach((t) => t.stop()); ctx.close(); };
      } else if (effect === "deep") {
        const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1800;
        const modOsc = ctx.createOscillator(); modOsc.frequency.value = 5; modOsc.start();
        const modGain = ctx.createGain(); modGain.gain.value = 0.2;
        modOsc.connect(modGain.gain);
        source.connect(lp); lp.connect(modGain); modGain.connect(dest);
        voiceEffectCleanupRef.current = () => { modOsc.stop(); rawStream.getTracks().forEach((t) => t.stop()); ctx.close(); };
      }

      const processedTrack = dest.stream.getAudioTracks()[0];
      const lkTrack = new LocalAudioTrack(processedTrack, undefined, false);
      await localParticipant.publishTrack(lkTrack, { source: Track.Source.Microphone });
      setMuted(false);
      addEvent("🎙️", `${t("vroom.you")}: ${t("vroom.voiceEffect")} — ${effect}`);
    } catch {
      toast({ title: t("vroom.voiceEffectError"), variant: "destructive" });
      setVoiceEffect("none");
    }
  };

  // ── Camera background blur ────────────────────────────────────────
  const toggleCameraBlur = async () => {
    if (!isCameraEnabled) {
      toast({ title: t("vroom.enableCameraFirst"), variant: "destructive" });
      return;
    }
    const newVal = !cameraBlurred;
    try {
      const pub = localParticipant.getTrackPublication(Track.Source.Camera);
      if (pub?.track?.mediaStreamTrack) {
        await pub.track.mediaStreamTrack.applyConstraints({
          advanced: [{ backgroundBlur: newVal } as MediaTrackConstraintSet],
        });
        setCameraBlurred(newVal);
        addEvent("📷", `${t("vroom.you")}: ${newVal ? t("vroom.cameraBlurOn") : t("vroom.cameraBlurOff")}`);
      }
    } catch {
      toast({ title: t("vroom.blurNotSupported"), variant: "destructive" });
    }
  };

  // ── File share in chat ────────────────────────────────────────────
  const shareFile = async (file: File) => {
    const path = `rooms/${roomId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error } = await supabase.storage.from("voice-room-uploads").upload(path, file);
    if (error) { toast({ title: t("vroom.uploadFailed"), variant: "destructive" }); return; }
    const { data: { publicUrl } } = supabase.storage.from("voice-room-uploads").getPublicUrl(path);
    const isImage = file.type.startsWith("image/");
    const msg: ChatMessage = {
      id: Math.random().toString(36).slice(2),
      senderId: currentUserId,
      senderName: localParticipant.name || currentUserId,
      text: isImage ? `[img]${publicUrl}[/img]` : `[file]${file.name}|${publicUrl}[/file]`,
      ts: Date.now(),
    };
    broadcastChRef.current?.send({ type: "broadcast", event: "chat_message", payload: msg });
  };

  // ── Poll actions ──────────────────────────────────────────────────
  const handleCreatePoll = (question: string, options: string[]) => {
    const poll: Poll = {
      id: Math.random().toString(36).slice(2),
      question,
      options,
      votes: {},
      voterIds: [],
      createdBy: currentUserId,
      isActive: true,
    };
    broadcastChRef.current?.send({ type: "broadcast", event: "poll_create", payload: poll });
    setShowPollCreator(false);
  };

  const handleVote = (pollId: string, optionIndex: number) => {
    broadcastChRef.current?.send({
      type: "broadcast", event: "poll_vote",
      payload: { pollId, optionIndex, voterId: currentUserId },
    });
  };

  const handleClosePoll = () => {
    broadcastChRef.current?.send({ type: "broadcast", event: "poll_close", payload: {} });
  };

  // ── Featured speaker ──────────────────────────────────────────────
  const featuredSpeaker = useMemo(() => {
    if (layout !== "speaker") return null;
    return participants.find((p) => p.isSpeaking) || null;
  }, [participants, layout]);

  // ── Speaker queue (raised hands with time) ────────────────────────
  const speakerQueue = useMemo<QueueEntry[]>(() => {
    return participants
      .filter((p) => p.identity !== currentUserId && raisedHands.has(p.identity))
      .map((p) => ({ id: p.identity, name: p.name || p.identity, raisedAt: Date.now() - 30000 }))
      .slice(0, 10);
  }, [participants, raisedHands, currentUserId]);

  const toggleMic = async () => {
    if (!roomPerms.mic && muted && !isOwner) {
      toast({ title: t("vroom.permDisabledByOwner"), variant: "destructive" });
      return;
    }
    const next = muted; // muted=true means we're about to unmute
    await localParticipant.setMicrophoneEnabled(next);
    setMuted(!next);
    playMuteSound(next); // next=true → unmuting, next=false → muting
    addEvent(next ? "🎙️" : "🔇", `${t("vroom.you")}: ${next ? t("vroom.unmute") : t("vroom.mute")}`);
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
    const myName = localParticipant.name || currentUserId;
    broadcastChRef.current?.send({
      type: "broadcast",
      event: "mute_all",
      payload: { byUserId: currentUserId, byName: myName },
    });
    addEvent("🔇", `${t("vroom.you")}: ${t("vroom.mutedAll")}`);
    toast({ title: t("vroom.mutedAll") });
  };

  const sendReaction = (emoji: string) => {
    playReactionSound(emoji);
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

  const toggleCamera = async () => {
    if (!roomPerms.camera && !isOwner) {
      toast({ title: t("vroom.permDisabledByOwner"), variant: "destructive" });
      return;
    }
    try {
      const next = !isCameraEnabled;
      await localParticipant.setCameraEnabled(next);
      broadcastChRef.current?.send({
        type: "broadcast", event: "camera_toggle",
        payload: { userId: currentUserId, userName: localParticipant.name || currentUserId, on: next },
      });
      addEvent(next ? "📷" : "📷", `${t("vroom.you")}: ${next ? t("vroom.cameraOn") : t("vroom.cameraOff")}`);
    } catch {
      toast({ title: t("vroom.cameraOff"), variant: "destructive" });
    }
  };

  const toggleAudioShare = async () => {
    if (audioShareEnabled) {
      audioShareTrackRef.current?.stop();
      audioShareTrackRef.current = null;
      setAudioShareEnabled(false);
      return;
    }
    if (!roomPerms.screen && !isOwner) {
      toast({ title: t("vroom.permDisabledByOwner"), variant: "destructive" });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      stream.getVideoTracks().forEach((vt) => vt.stop());
      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) {
        toast({ title: t("vroom.audioShareFailed"), variant: "destructive" });
        return;
      }
      const lkTrack = new LocalAudioTrack(audioTrack, undefined, false);
      await localParticipant.publishTrack(lkTrack, { source: Track.Source.ScreenShareAudio, name: "audio-share" });
      audioShareTrackRef.current = audioTrack;
      setAudioShareEnabled(true);
      broadcastChRef.current?.send({ type: "broadcast", event: "audio_share", payload: { userId: currentUserId, userName: localParticipant.name || currentUserId, started: true } });
      addEvent("🎵", `${t("vroom.you")}: ${t("vroom.audioShareActive")}`);
      audioTrack.onended = () => {
        setAudioShareEnabled(false);
        broadcastChRef.current?.send({ type: "broadcast", event: "audio_share", payload: { userId: currentUserId, userName: localParticipant.name || currentUserId, started: false } });
        addEvent("🎵", `${t("vroom.you")}: ${t("vroom.audioShare")} ⏹`);
      };
      toast({ title: t("vroom.audioShareActive") });
    } catch {
      toast({ title: t("vroom.audioShareFailed"), variant: "destructive" });
    }
  };

  const toggleScreenShare = async () => {
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
      addEvent("🖥️", `${t("vroom.you")}: ${willEnable ? t("vroom.startedScreenShare") : t("vroom.stoppedScreenShare")}`);
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

  const canScreenShare = typeof navigator?.mediaDevices?.getDisplayMedia === "function";

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
                  <div className="absolute top-2 right-2 flex items-center gap-1.5">
                    {/* Include system audio — only visible while screen sharing */}
                    <button
                      type="button"
                      disabled={screenShareRestarting}
                      className={`flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold backdrop-blur transition-colors disabled:opacity-50 ${
                        screenAudioEnabled
                          ? "border-blue-400 bg-blue-500/80 text-white"
                          : "border-white/30 bg-black/50 text-white hover:bg-black/70"
                      }`}
                      onClick={toggleScreenAudio}
                      aria-pressed={screenAudioEnabled}
                      title={t("vroom.shareAudio")}
                    >
                      {screenShareRestarting
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <Volume2 className="h-3 w-3" />
                      }
                      <span>{t("vroom.audio")}</span>
                    </button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 text-xs"
                      onClick={toggleScreenShare}
                    >
                      <MonitorOff className="h-3.5 w-3.5 me-1" />
                      {t("vroom.stopSharing")}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Room event banners — slide in from top, auto-dismiss */}
      {roomBanners.length > 0 && (
        <div className="flex flex-col gap-1.5" aria-live="polite">
          {roomBanners.map((b) => (
            <div
              key={b.id}
              className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-card/95 backdrop-blur px-3.5 py-2.5 shadow-md text-sm animate-in slide-in-from-top-3 duration-300"
            >
              <span className="text-lg leading-none shrink-0">{b.icon}</span>
              <span className="flex-1 text-foreground font-medium leading-snug">{b.text}</span>
              <button
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setRoomBanners((prev) => prev.filter((x) => x.id !== b.id))}
                aria-label={t("common.dismiss")}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Audience banner for non-stage users in stage mode */}
      {isStageMode && !isOnStage && !isListener && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700">
          <Crown className="h-4 w-4 shrink-0" />
          <span className="text-sm font-medium">{t("vroom.youAreAudience")}</span>
        </div>
      )}
      {isListener && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-4 py-2.5 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700">
          <Headphones className="h-4 w-4 shrink-0" />
          <span className="text-sm font-medium">{t("vroom.youAreListener")}</span>
        </div>
      )}

      {/* Live Poll */}
      {(activePoll || showPollCreator) && (
        <LivePollWidget
          poll={activePoll}
          isOwner={isOwner}
          currentUserId={currentUserId}
          showCreator={showPollCreator}
          t={t}
          onCreatePoll={handleCreatePoll}
          onVote={handleVote}
          onClosePoll={handleClosePoll}
          onHideCreator={() => setShowPollCreator(false)}
        />
      )}

      {/* Speaker Queue */}
      {showQueue && isOwner && (
        <SpeakerQueuePanel
          queue={speakerQueue}
          t={t}
          onInvite={onPromoteToStage}
          onClose={() => setShowQueue(false)}
        />
      )}

      {/* Voice Effects Panel */}
      {showEffects && (
        <VoiceEffectsPanel
          currentEffect={voiceEffect}
          t={t}
          onSelect={applyVoiceEffect}
          onClose={() => setShowEffects(false)}
          disabled={isListener}
        />
      )}

      {/* Camera video grid — shown when any participant has camera on */}
      {allCameraTracks.length > 0 && (() => {
        const visibleTracks = layout === "cameras"
          ? allCameraTracks
          : allCameraTracks;

        if (layout === "speaker" && featuredSpeaker) {
          const featuredTrack = visibleTracks.find((t) => t.participant.identity === featuredSpeaker.identity);
          const otherTracks = visibleTracks.filter((t) => t.participant.identity !== featuredSpeaker.identity);
          return (
            <div className="flex flex-col gap-3">
              {featuredTrack && (
                <div className="relative aspect-video rounded-xl overflow-hidden bg-zinc-900 border-2 border-primary shadow-lg shadow-primary/30">
                  <VideoTrack trackRef={featuredTrack} className="w-full h-full object-cover" />
                  <div className="absolute top-2 left-2">
                    <Badge className="gap-1 text-xs bg-primary/80 backdrop-blur">
                      <Volume2 className="h-3 w-3" /> {t("vroom.featuredSpeaker")}
                    </Badge>
                  </div>
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
                    <span className="text-sm font-semibold text-white">{featuredSpeaker.name || featuredSpeaker.identity}</span>
                  </div>
                </div>
              )}
              {otherTracks.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {otherTracks.map((track) => {
                    const name = track.participant.name || track.participant.identity;
                    return (
                      <div key={track.participant.identity} className="relative flex-shrink-0 w-32 aspect-video rounded-lg overflow-hidden bg-zinc-900 border border-zinc-700/50">
                        <VideoTrack trackRef={track} className="w-full h-full object-cover" />
                        <div className="absolute bottom-0 inset-x-0 bg-black/60 px-1 py-0.5">
                          <span className="text-[10px] text-white truncate block">{name}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        }

        return (
          <div className={`grid gap-3 ${
            visibleTracks.length === 1 ? "grid-cols-1" :
            visibleTracks.length === 2 ? "grid-cols-2" :
            visibleTracks.length <= 4 ? "grid-cols-2" :
            "grid-cols-3"
          }`}>
            {visibleTracks.map((track) => {
              const name = track.participant.name || track.participant.identity;
              const isOwn = track.participant.identity === currentUserId;
              const speaking = track.participant.isSpeaking;
              return (
                <div
                  key={track.participant.identity}
                  className={`relative aspect-video rounded-xl overflow-hidden bg-zinc-900 border-2 transition-all ${speaking ? "border-primary shadow-lg shadow-primary/20" : "border-zinc-700/50"}`}
                >
                  <VideoTrack trackRef={track} className="w-full h-full object-cover" />
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 flex items-center gap-1.5">
                    {speaking && (
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary">
                        <Volume2 className="h-2.5 w-2.5 text-primary-foreground" />
                      </span>
                    )}
                    <span className="text-xs font-semibold text-white truncate">
                      {isOwn ? `${name} (${t("vroom.you")})` : name}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Participants grid */}
      <div className="relative">
        <div className="mb-3 flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">
            {participants.length} {t("vroom.participants")}
          </span>
          {/* Layout selector */}
          <div className="ms-auto flex items-center gap-1 rounded-lg border p-0.5">
            {(["gallery", "speaker", "cameras"] as LayoutType[]).map((l) => (
              <button
                key={l}
                onClick={() => setLayout(l)}
                title={t(`vroom.layout${l.charAt(0).toUpperCase() + l.slice(1)}`)}
                className={`rounded px-2 py-1 text-xs transition-colors ${layout === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {l === "gallery" ? <LayoutGrid className="h-3.5 w-3.5" /> : l === "speaker" ? <Sparkles className="h-3.5 w-3.5" /> : <Video className="h-3.5 w-3.5" />}
              </button>
            ))}
          </div>
        </div>

        {isStageMode ? (
          <>
            <div className="mb-2">
              <p className="text-xs font-semibold text-primary mb-2 flex items-center gap-1.5">
                <Crown className="h-3.5 w-3.5" /> {t("vroom.stageArea")}
              </p>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                {participants.filter((p) => stageMembers.has(p.identity)).map((p) => (
                  <ParticipantTile key={p.sid} participant={p} canModerate={canModerate} isMe={p.identity === currentUserId} isRaisingHand={raisedHands.has(p.identity)} onKick={onKick} onBan={onBan} t={t} />
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" /> {t("vroom.audienceArea")}
              </p>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                {participants.filter((p) => !stageMembers.has(p.identity)).map((p) => (
                  <ParticipantTile key={p.sid} participant={p} canModerate={canModerate} isMe={p.identity === currentUserId} isRaisingHand={raisedHands.has(p.identity)} onKick={onKick} onBan={onBan} t={t} />
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className={`grid gap-3 ${
            layout === "gallery"
              ? "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6"
              : layout === "cameras"
              ? "grid-cols-2 sm:grid-cols-3"
              : "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6"
          }`}>
            {participants.map((p) => (
              <ParticipantTile
                key={p.sid}
                participant={p}
                canModerate={canModerate}
                isMe={p.identity === currentUserId}
                isRaisingHand={raisedHands.has(p.identity)}
                onKick={onKick}
                onBan={onBan}
                t={t}
              />
            ))}
          </div>
        )}

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

      {/* Notifications history panel (bell button) */}
      {notifOpen && (
        <div className="rounded-xl border bg-card shadow-sm flex flex-col" style={{ maxHeight: 280 }}>
          <div className="flex items-center justify-between border-b px-3 py-2 shrink-0">
            <span className="text-sm font-semibold flex items-center gap-1.5">
              <Bell className="h-4 w-4 text-primary" />
              {t("vroom.notifications")}
            </span>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setNotifOpen(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {roomEvents.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-4">{t("vroom.notificationsEmpty")}</p>
            )}
            {roomEvents.map((ev) => (
              <div key={ev.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-muted/40 transition-colors">
                <span className="text-base leading-none shrink-0">{ev.icon}</span>
                <span className="flex-1 text-muted-foreground leading-snug">{ev.text}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground/50">
                  {new Date(ev.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
            <div ref={notifEndRef} />
          </div>
        </div>
      )}

      {/* Chat panel */}
      {chatOpen && (
        <div className="rounded-xl border bg-card shadow-sm flex flex-col" style={{ maxHeight: 320 }}>
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-sm font-semibold flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4 text-primary" />
              {t("vroom.chat")}
            </span>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setChatOpen(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[120px]">
            {chatMessages.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-4">{t("vroom.chatEmpty")}</p>
            )}
            {chatMessages.map((msg) => {
              const imgMatch = msg.text.match(/^\[img\](.*)\[\/img\]$/);
              const fileMatch = msg.text.match(/^\[file\](.*)\|(.*)\[\/file\]$/);
              return (
                <div key={msg.id} className={`flex flex-col ${msg.senderId === currentUserId ? "items-end" : "items-start"}`}>
                  <span className="text-[10px] text-muted-foreground mb-0.5">{msg.senderName}</span>
                  {imgMatch ? (
                    <a href={imgMatch[1]} target="_blank" rel="noopener noreferrer">
                      <img src={imgMatch[1]} alt={t("vroom.sharedImage")} className="max-w-[200px] max-h-[150px] rounded-xl object-cover border" />
                    </a>
                  ) : fileMatch ? (
                    <a href={fileMatch[2]} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm hover:bg-muted/40 transition-colors">
                      <ImageIcon className="h-4 w-4 text-primary" />
                      <span className="underline">{fileMatch[1]}</span>
                    </a>
                  ) : (
                    <div className={`rounded-2xl px-3 py-1.5 text-sm max-w-[80%] ${msg.senderId === currentUserId ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted rounded-bl-sm"}`}>
                      {msg.text}
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>
          <div className="border-t p-2 flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*,application/pdf,text/plain"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) shareFile(f); e.target.value = ""; }}
            />
            <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={() => fileInputRef.current?.click()} title={t("vroom.uploadFile")}>
              <Upload className="h-4 w-4" />
            </Button>
            <input
              className="flex-1 rounded-lg border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              placeholder={t("vroom.chatPlaceholder")}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
              maxLength={300}
            />
            <Button size="icon" className="h-9 w-9 shrink-0" onClick={sendChatMessage} disabled={!chatInput.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

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

      {/* Room Controls Panel — owner only */}
      {isOwner && showRoomControls && (
        <div className="rounded-xl border bg-card p-4 shadow-md space-y-3">
          <p className="text-sm font-semibold flex items-center gap-1.5">
            <Settings2 className="h-4 w-4 text-primary" />
            {t("vroom.roomControls")}
          </p>
          {/* Stage mode toggle */}
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Crown className="h-4 w-4" />
              {t("vroom.stageMode")}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={isStageMode}
              onClick={async () => {
                const newMode = isStageMode ? "conversation" : "stage";
                await supabase.from("voice_rooms").update({ room_mode: newMode }).eq("id", roomId);
                addEvent(isStageMode ? "🎙️" : "🏛️", `${t("vroom.you")}: ${t(isStageMode ? "vroom.stageModeOff" : "vroom.stageModeOn")}`);
              }}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${isStageMode ? "bg-primary" : "bg-muted-foreground/30"}`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${isStageMode ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>
          {([
            { key: "mic" as const,    label: t("vroom.allowMic"),         icon: Mic },
            { key: "camera" as const, label: t("vroom.allowCamera"),      icon: Video },
            { key: "chat" as const,   label: t("vroom.allowChat"),        icon: MessageSquare },
            { key: "screen" as const, label: t("vroom.allowScreenShare"), icon: Monitor },
          ]).map(({ key, label, icon: Icon }) => (
            <div key={key} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <Icon className="h-4 w-4" />
                {label}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={roomPerms[key]}
                onClick={() => onUpdatePerms(key, !roomPerms[key])}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${roomPerms[key] ? "bg-primary" : "bg-muted-foreground/30"}`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${roomPerms[key] ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 pt-2 flex-wrap">
        {isOwner && (
          <Button
            size="lg"
            variant="outline"
            className={`h-14 w-14 rounded-full p-0 transition-colors ${showRoomControls ? "bg-primary border-primary text-primary-foreground" : ""}`}
            onClick={() => setShowRoomControls((v) => !v)}
            title={t("vroom.roomControls")}
            aria-label={t("vroom.roomControls")}
          >
            <Settings2 className="h-6 w-6" />
          </Button>
        )}
        {canModerate && (
          <Button
            size="lg"
            variant="outline"
            className="h-14 w-14 rounded-full p-0 text-orange-500 border-orange-300 hover:bg-orange-50 hover:border-orange-500"
            onClick={muteAll}
            title={t("vroom.muteAll")}
            aria-label={t("vroom.muteAll")}
          >
            <MicOff className="h-6 w-6" />
          </Button>
        )}
        <Button
          size="lg"
          variant={muted ? "destructive" : "outline"}
          className="h-14 w-14 rounded-full p-0"
          onClick={toggleMic}
          disabled={!roomPerms.mic && !isOwner}
          aria-label={muted ? t("vroom.unmute") : t("vroom.mute")}
          title={!roomPerms.mic && !isOwner ? t("vroom.permDisabledByOwner") : undefined}
        >
          {muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </Button>
        {/* Camera toggle */}
        {(roomPerms.camera || isOwner) && (
          <div className="flex flex-col items-center gap-1">
            <Button
              size="lg"
              variant="outline"
              className={`h-14 w-14 rounded-full p-0 transition-colors ${isCameraEnabled ? "bg-green-500 hover:bg-green-600 border-green-500 text-white" : "border-muted-foreground/40"}`}
              onClick={toggleCamera}
              aria-label={isCameraEnabled ? t("vroom.cameraOn") : t("vroom.cameraOff")}
              title={isCameraEnabled ? t("vroom.cameraOn") : t("vroom.cameraOff")}
            >
              {isCameraEnabled ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
            </Button>
            <span className={`text-[10px] font-semibold ${isCameraEnabled ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
              {isCameraEnabled ? t("vroom.cameraOn") : t("vroom.cameraOff")}
            </span>
          </div>
        )}
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

        {/* Screen share */}
        {canScreenShare && (roomPerms.screen || isOwner) && (
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
        )}
        {/* Audio-only share */}
        {canScreenShare && (roomPerms.screen || isOwner) && (
          <div className="flex flex-col items-center gap-1">
            <Button
              size="lg"
              variant="outline"
              className={`h-14 w-14 rounded-full p-0 transition-colors ${audioShareEnabled ? "bg-teal-500 hover:bg-teal-600 border-teal-500 text-white" : ""}`}
              onClick={toggleAudioShare}
              aria-label={t("vroom.audioShare")}
              title={t("vroom.audioShare")}
            >
              <Music2 className="h-6 w-6" />
            </Button>
            <span className="text-[10px] text-muted-foreground">{t("vroom.audioShare")}</span>
          </div>
        )}
        {/* Voice Effects */}
        {!isListener && (
          <Button
            size="lg"
            variant="outline"
            className={`h-14 w-14 rounded-full p-0 transition-colors ${showEffects || voiceEffect !== "none" ? "bg-indigo-500 border-indigo-500 text-white" : ""}`}
            onClick={() => setShowEffects((v) => !v)}
            aria-label={t("vroom.voiceEffects")}
            title={t("vroom.voiceEffects")}
          >
            <Sparkles className="h-6 w-6" />
          </Button>
        )}

        {/* Camera blur */}
        {isCameraEnabled && (
          <Button
            size="lg"
            variant="outline"
            className={`h-14 w-14 rounded-full p-0 transition-colors ${cameraBlurred ? "bg-slate-500 border-slate-500 text-white" : ""}`}
            onClick={toggleCameraBlur}
            aria-label={cameraBlurred ? t("vroom.cameraBlurOn") : t("vroom.cameraBlurOff")}
            title={cameraBlurred ? t("vroom.cameraBlurOn") : t("vroom.cameraBlurOff")}
          >
            <ImageIcon className="h-6 w-6" />
          </Button>
        )}

        {/* Live Poll */}
        {isOwner && (
          <Button
            size="lg"
            variant="outline"
            className={`h-14 w-14 rounded-full p-0 transition-colors ${showPollCreator || activePoll ? "bg-green-500 border-green-500 text-white" : ""}`}
            onClick={() => setShowPollCreator((v) => !v)}
            aria-label={t("vroom.createPoll")}
            title={t("vroom.createPoll")}
          >
            <BarChart2 className="h-6 w-6" />
          </Button>
        )}

        {/* Speaker Queue (owner, stage mode) */}
        {isOwner && isStageMode && (
          <div className="relative">
            <Button
              size="lg"
              variant="outline"
              className={`h-14 w-14 rounded-full p-0 transition-colors ${showQueue ? "bg-amber-500 border-amber-500 text-white" : ""}`}
              onClick={() => setShowQueue((v) => !v)}
              aria-label={t("vroom.speakerQueue")}
              title={t("vroom.speakerQueue")}
            >
              <Users2 className="h-6 w-6" />
            </Button>
            {speakerQueue.length > 0 && !showQueue && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                {speakerQueue.length}
              </span>
            )}
          </div>
        )}

        {/* Notifications toggle */}
        <div className="relative">
          <Button
            size="lg"
            variant="outline"
            className={`h-14 w-14 rounded-full p-0 transition-colors ${notifOpen ? "bg-amber-500 border-amber-500 text-white" : ""}`}
            onClick={() => setNotifOpen((v) => !v)}
            aria-label={t("vroom.notifications")}
            title={t("vroom.notifications")}
          >
            <Bell className="h-6 w-6" />
          </Button>
          {unreadNotifs > 0 && !notifOpen && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
              {unreadNotifs > 9 ? "9+" : unreadNotifs}
            </span>
          )}
        </div>

        {/* Chat toggle */}
        {(roomPerms.chat || isOwner) && <div className="relative">
          <Button
            size="lg"
            variant="outline"
            className={`h-14 w-14 rounded-full p-0 transition-colors ${chatOpen ? "bg-primary border-primary text-primary-foreground" : ""}`}
            onClick={() => setChatOpen((v) => !v)}
            aria-label={t("vroom.chat")}
            title={t("vroom.chat")}
          >
            <MessageSquare className="h-6 w-6" />
          </Button>
          {unreadCount > 0 && !chatOpen && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </div>}

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

// ── Mute / Unmute audio feedback ──────────────────────────────────
// unmuting=true → two ascending tones (ON)
// unmuting=false → two descending tones (OFF)
function playMuteSound(unmuting: boolean) {
  try {
    const ctx = new AudioContext();
    const freqs: [number, number] = unmuting ? [400, 650] : [650, 350];
    freqs.forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.09);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.09 + 0.12);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.09);
      o.stop(ctx.currentTime + i * 0.09 + 0.14);
    });
    setTimeout(() => ctx.close().catch(() => {}), 500);
  } catch { /* ignore */ }
}

// ── Reaction sounds ────────────────────────────────────────────────
// Helpers
function _noiseBuf(ctx: AudioContext, dur: number) {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}
function _osc(ctx: AudioContext, type: OscillatorType, freq: number) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; return o;
}
function _gain(ctx: AudioContext, val = 0) {
  const g = ctx.createGain(); g.gain.value = val; return g;
}
function _bpf(ctx: AudioContext, freq: number, q = 1) {
  const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = freq; f.Q.value = q; return f;
}

function playReactionSound(emoji: string) {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    // ── Laugh 😂😆😅🤣😁🤪😜😝 ──────────────────────────────────────
    // Realistic "HA HA HA": voiced bursts through vowel formants
    if (["😂","😆","😅","🤣","😁","🤪","😜","😝"].includes(emoji)) {
      for (let i = 0; i < 4; i++) {
        const t0 = now + i * 0.16;
        // Vocal cord oscillator (sawtooth = rich harmonics like voice)
        const src = _osc(ctx, "sawtooth", 200 + i * 8);
        // First formant "AH" ~800 Hz
        const f1 = _bpf(ctx, 800, 8);
        // Second formant ~1200 Hz
        const f2 = _bpf(ctx, 1200, 6);
        const mix = _gain(ctx);
        const env = _gain(ctx);
        src.connect(f1); src.connect(f2);
        f1.connect(mix); f2.connect(mix);
        mix.connect(env); env.connect(ctx.destination);
        // Shape each "HA" burst
        env.gain.setValueAtTime(0, t0);
        env.gain.linearRampToValueAtTime(0.22, t0 + 0.025);
        env.gain.setValueAtTime(0.22, t0 + 0.07);
        env.gain.exponentialRampToValueAtTime(0.001, t0 + 0.13);
        src.start(t0); src.stop(t0 + 0.15);
      }

    // ── Clap 👏🙌 ──────────────────────────────────────────────────
    // Realistic hand clap: noise through stacked resonant bands
    } else if (["👏","🙌"].includes(emoji)) {
      for (let c = 0; c < 3; c++) {
        const t0 = now + c * 0.22;
        const src = ctx.createBufferSource();
        src.buffer = _noiseBuf(ctx, 0.18);
        // Hand-clap has peaks around 900 Hz, 1.8 kHz, 3.5 kHz, 6 kHz
        const bands = [900, 1800, 3500, 6000].map((f) => _bpf(ctx, f, 2.5));
        const mix = _gain(ctx);
        const env = _gain(ctx);
        src.connect(bands[0]); src.connect(bands[1]);
        src.connect(bands[2]); src.connect(bands[3]);
        bands.forEach((b) => b.connect(mix));
        mix.connect(env); env.connect(ctx.destination);
        env.gain.setValueAtTime(0.55, t0);
        env.gain.exponentialRampToValueAtTime(0.001, t0 + 0.14);
        src.start(t0);
      }

    // ── Power / Impact 💪🤜🤛 ──────────────────────────────────────
    // Sharp noise punch + bass thump — "POW" energy, not applause
    } else if (["💪","🤜","🤛"].includes(emoji)) {
      // Impact crack: wide-band noise burst
      const nsrc = ctx.createBufferSource();
      nsrc.buffer = _noiseBuf(ctx, 0.14);
      const ibp = _bpf(ctx, 900, 1.8);
      const ng = _gain(ctx);
      nsrc.connect(ibp); ibp.connect(ng); ng.connect(ctx.destination);
      ng.gain.setValueAtTime(0.65, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      nsrc.start(now);
      // Deep bass thump underneath
      const boom = _osc(ctx, "sine", 90);
      const bg = _gain(ctx);
      boom.connect(bg); bg.connect(ctx.destination);
      boom.frequency.setValueAtTime(90, now);
      boom.frequency.exponentialRampToValueAtTime(28, now + 0.28);
      bg.gain.setValueAtTime(0.42, now);
      bg.gain.exponentialRampToValueAtTime(0.001, now + 0.30);
      boom.start(now); boom.stop(now + 0.32);

    // ── Heart ❤️🥰😍💕💗💓💞🫂🫶 ───────────────────────────────────
    // Realistic heartbeat: lub-DUB two-thump pattern
    // 🫶 (heart hands) moved here from clap group — it's love, not applause
    // 🌸 (cherry blossom) removed — it's nature, not romantic
    } else if (["❤️","🥰","😍","💕","💗","💓","💞","🫂","🫶"].includes(emoji)) {
      const beats = [[0, 65, 0.28], [0.18, 55, 0.22], [0.72, 65, 0.28], [0.90, 55, 0.22]] as [number,number,number][];
      beats.forEach(([dt, freq, dur]) => {
        const o = _osc(ctx, "sine", freq);
        const g = _gain(ctx);
        const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 200;
        o.connect(lp); lp.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0, now + dt);
        g.gain.linearRampToValueAtTime(0.5, now + dt + 0.012);
        g.gain.exponentialRampToValueAtTime(0.001, now + dt + dur);
        o.start(now + dt); o.stop(now + dt + dur + 0.05);
      });

    // ── Wow / Gasp 😮🤯😱🫢🫣😳 ───────────────────────────────────
    // Quick "OH!" intake: voiced rising + breathy noise
    } else if (["😮","🤯","😱","🫢","🫣","😳"].includes(emoji)) {
      // Voiced "oh" – rising pitch
      const voc = _osc(ctx, "sawtooth", 180);
      const f1 = _bpf(ctx, 500, 7);   // "oh" first formant
      const f2 = _bpf(ctx, 900, 5);
      const venv = _gain(ctx);
      voc.connect(f1); voc.connect(f2);
      f1.connect(venv); f2.connect(venv);
      venv.connect(ctx.destination);
      voc.frequency.setValueAtTime(180, now);
      voc.frequency.linearRampToValueAtTime(260, now + 0.2);
      venv.gain.setValueAtTime(0, now);
      venv.gain.linearRampToValueAtTime(0.22, now + 0.04);
      venv.gain.setValueAtTime(0.22, now + 0.16);
      venv.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      voc.start(now); voc.stop(now + 0.3);
      // Breath layer
      const nsrc = ctx.createBufferSource();
      nsrc.buffer = _noiseBuf(ctx, 0.25);
      const nhp = ctx.createBiquadFilter(); nhp.type = "highpass"; nhp.frequency.value = 2000;
      const ng = _gain(ctx);
      nsrc.connect(nhp); nhp.connect(ng); ng.connect(ctx.destination);
      ng.gain.setValueAtTime(0.08, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      nsrc.start(now);

    // ── Fire 🔥 ────────────────────────────────────────────────────
    // Low crackling flame: bass rumble + high-frequency crackle
    } else if (emoji === "🔥") {
      // Bass rumble
      const rumble = _osc(ctx, "sine", 80);
      const rg = _gain(ctx);
      rumble.connect(rg); rg.connect(ctx.destination);
      rg.gain.setValueAtTime(0.12, now);
      rg.gain.linearRampToValueAtTime(0.18, now + 0.15);
      rg.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      rumble.start(now); rumble.stop(now + 0.6);
      // Crackle: noise with random amplitude bursts
      const csrc = ctx.createBufferSource();
      csrc.buffer = _noiseBuf(ctx, 0.55);
      const cbp = _bpf(ctx, 3500, 1.5);
      const cg = _gain(ctx);
      csrc.connect(cbp); cbp.connect(cg); cg.connect(ctx.destination);
      cg.gain.setValueAtTime(0.18, now);
      cg.gain.setValueAtTime(0.06, now + 0.1);
      cg.gain.setValueAtTime(0.22, now + 0.18);
      cg.gain.setValueAtTime(0.04, now + 0.28);
      cg.gain.setValueAtTime(0.19, now + 0.38);
      cg.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      csrc.start(now);

    // ── Lightning ⚡ ───────────────────────────────────────────────
    // Sharp electric snap + buzz
    } else if (emoji === "⚡") {
      // Initial crack
      const csrc = ctx.createBufferSource();
      csrc.buffer = _noiseBuf(ctx, 0.08);
      const cbp = _bpf(ctx, 5000, 0.5);
      const cg = _gain(ctx);
      csrc.connect(cbp); cbp.connect(cg); cg.connect(ctx.destination);
      cg.gain.setValueAtTime(0.6, now);
      cg.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      csrc.start(now);
      // Buzz tail
      const buz = _osc(ctx, "square", 120);
      const bg = _gain(ctx);
      buz.connect(bg); bg.connect(ctx.destination);
      bg.gain.setValueAtTime(0.12, now + 0.06);
      bg.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      buz.start(now + 0.06); buz.stop(now + 0.38);

    // ── Explosion 💥 ────────────────────────────────────────────────
    // Deep boom + crack
    } else if (emoji === "💥") {
      // Boom
      const boom = _osc(ctx, "sine", 60);
      const bg = _gain(ctx);
      boom.connect(bg); bg.connect(ctx.destination);
      boom.frequency.setValueAtTime(60, now);
      boom.frequency.exponentialRampToValueAtTime(20, now + 0.4);
      bg.gain.setValueAtTime(0.5, now);
      bg.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      boom.start(now); boom.stop(now + 0.5);
      // Crack noise burst
      const nsrc = ctx.createBufferSource();
      nsrc.buffer = _noiseBuf(ctx, 0.12);
      const ng = _gain(ctx);
      nsrc.connect(ng); ng.connect(ctx.destination);
      ng.gain.setValueAtTime(0.45, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      nsrc.start(now);

    // ── Rocket 🚀 ──────────────────────────────────────────────────
    // Rising whoosh
    } else if (emoji === "🚀") {
      const nsrc = ctx.createBufferSource();
      nsrc.buffer = _noiseBuf(ctx, 0.5);
      const bp = _bpf(ctx, 300, 3);
      const g = _gain(ctx);
      nsrc.connect(bp); bp.connect(g); g.connect(ctx.destination);
      bp.frequency.setValueAtTime(200, now);
      bp.frequency.exponentialRampToValueAtTime(4000, now + 0.48);
      g.gain.setValueAtTime(0.08, now);
      g.gain.linearRampToValueAtTime(0.28, now + 0.3);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      nsrc.start(now);

    // ── Wave 🌊 ────────────────────────────────────────────────────
    // Ocean wave: filtered noise with slow swell
    } else if (emoji === "🌊") {
      const nsrc = ctx.createBufferSource();
      nsrc.buffer = _noiseBuf(ctx, 0.9);
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 700;
      const g = _gain(ctx);
      nsrc.connect(lp); lp.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.28, now + 0.35);
      g.gain.linearRampToValueAtTime(0.14, now + 0.65);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.88);
      nsrc.start(now);

    // ── Celebration 🎉🎊🎈🎁🥳 ────────────────────────────────────
    // Cork pop! + sparkle arpeggio
    } else if (["🎉","🎊","🎈","🎁","🥳"].includes(emoji)) {
      // Pop
      const psrc = ctx.createBufferSource();
      psrc.buffer = _noiseBuf(ctx, 0.06);
      const pbp = _bpf(ctx, 600, 0.8);
      const pg = _gain(ctx);
      psrc.connect(pbp); pbp.connect(pg); pg.connect(ctx.destination);
      pg.gain.setValueAtTime(0.5, now);
      pg.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      psrc.start(now);
      // Sparkle: quick high arpeggio
      [1047, 1319, 1568, 2093].forEach((freq, i) => {
        const o = _osc(ctx, "sine", freq);
        const g = _gain(ctx);
        o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0, now + 0.06 + i * 0.06);
        g.gain.linearRampToValueAtTime(0.1, now + 0.06 + i * 0.06 + 0.015);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.06 + i * 0.06 + 0.18);
        o.start(now + 0.06 + i * 0.06);
        o.stop(now + 0.06 + i * 0.06 + 0.2);
      });

    // ── Music 🎵🎶🎸 ──────────────────────────────────────────────
    // Guitar-like pluck (Karplus-Strong approximation)
    } else if (["🎵","🎶","🎸"].includes(emoji)) {
      [196, 247, 294, 370].forEach((freq, i) => {
        const o = _osc(ctx, "sawtooth", freq);
        const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = freq * 4;
        const g = _gain(ctx);
        o.connect(lp); lp.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0, now + i * 0.1);
        g.gain.linearRampToValueAtTime(0.14, now + i * 0.1 + 0.005);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.5);
        o.start(now + i * 0.1);
        o.stop(now + i * 0.1 + 0.55);
      });

    // ── Thumbs up / Stars / Awards 👍💯🏆🥇⭐🌟✨💫💎🎯 ──────────
    // Satisfying bell: fundamental + harmonics with good sustain
    } else if (["👍","👍🏼","💯","🏆","🥇","⭐","🌟","✨","💫","💎","🎯"].includes(emoji)) {
      [880, 1760, 2640].forEach((freq, i) => {
        const o = _osc(ctx, "sine", freq);
        const g = _gain(ctx);
        o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.18 / (i + 1), now + 0.006);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.6 - i * 0.1);
        o.start(now); o.stop(now + 0.7);
      });

    // ── Angry 😡😤 ────────────────────────────────────────────────
    // Distorted grunt
    } else if (["😡","😤"].includes(emoji)) {
      const o = _osc(ctx, "sawtooth", 140);
      const dist = ctx.createWaveShaper();
      const curve = new Float32Array(256);
      for (let i = 0; i < 256; i++) {
        const x = (i * 2) / 256 - 1;
        curve[i] = (Math.PI + 200) * x / (Math.PI + 200 * Math.abs(x));
      }
      dist.curve = curve;
      const g = _gain(ctx);
      o.connect(dist); dist.connect(g); g.connect(ctx.destination);
      o.frequency.setValueAtTime(140, now);
      o.frequency.linearRampToValueAtTime(80, now + 0.35);
      g.gain.setValueAtTime(0.2, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      o.start(now); o.stop(now + 0.4);

    // ── Thumbs down / Boo 👎🙄😒 ────────────────────────────────
    // Sad descending trombone-like glide
    } else if (["👎","🙄","😒"].includes(emoji)) {
      const o = _osc(ctx, "sawtooth", 220);
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 800;
      const g = _gain(ctx);
      o.connect(lp); lp.connect(g); g.connect(ctx.destination);
      o.frequency.setValueAtTime(220, now);
      o.frequency.linearRampToValueAtTime(100, now + 0.55);
      g.gain.setValueAtTime(0.15, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.58);
      o.start(now); o.stop(now + 0.6);

    // ── Skull 💀 ───────────────────────────────────────────────────
    // Eerie two-tone descending minor interval
    } else if (emoji === "💀") {
      [220, 277].forEach((freq, i) => {
        const o = _osc(ctx, "sine", freq);
        const g = _gain(ctx);
        o.connect(g); g.connect(ctx.destination);
        o.frequency.setValueAtTime(freq, now);
        o.frequency.linearRampToValueAtTime(freq * 0.5, now + 0.7);
        g.gain.setValueAtTime(0.08, now + i * 0.03);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.72);
        o.start(now + i * 0.03); o.stop(now + 0.75);
      });

    // ── Cry / Sob 😢😭🥺 ──────────────────────────────────────────
    // Soft sniff + descending vocal sob
    } else if (["😢","😭","🥺"].includes(emoji)) {
      // Sniff: short noise burst
      const sniff = ctx.createBufferSource();
      sniff.buffer = _noiseBuf(ctx, 0.12);
      const nhp = ctx.createBiquadFilter(); nhp.type = "highpass"; nhp.frequency.value = 1800;
      const ng = _gain(ctx);
      sniff.connect(nhp); nhp.connect(ng); ng.connect(ctx.destination);
      ng.gain.setValueAtTime(0.06, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      sniff.start(now);
      // Sob: voiced falling pitch "oh~" with vibrato-like tremolo
      const voc = _osc(ctx, "sawtooth", 260);
      const f1 = _bpf(ctx, 700, 7);
      const f2 = _bpf(ctx, 1100, 5);
      const venv = _gain(ctx);
      voc.connect(f1); voc.connect(f2);
      f1.connect(venv); f2.connect(venv);
      venv.connect(ctx.destination);
      voc.frequency.setValueAtTime(260, now + 0.05);
      voc.frequency.linearRampToValueAtTime(160, now + 0.55);
      venv.gain.setValueAtTime(0, now + 0.05);
      venv.gain.linearRampToValueAtTime(0.18, now + 0.12);
      venv.gain.setValueAtTime(0.18, now + 0.38);
      venv.gain.exponentialRampToValueAtTime(0.001, now + 0.58);
      voc.start(now + 0.05); voc.stop(now + 0.62);

    // ── Gesture / Respectful 🙏🫡✌️🤞🤙🙋 ───────────────────────────
    // Gentle rising two-tone chime (positive, acknowledging)
    } else if (["🙏","🫡","✌️","🤞","🤙","🙋"].includes(emoji)) {
      [660, 990].forEach((freq, i) => {
        const o = _osc(ctx, "sine", freq);
        const g = _gain(ctx);
        o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0, now + i * 0.08);
        g.gain.linearRampToValueAtTime(0.1, now + i * 0.08 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.4);
        o.start(now + i * 0.08); o.stop(now + i * 0.08 + 0.45);
      });

    // ── Facepalm 🤦 ────────────────────────────────────────────────
    // Thud + comedic descending tone — "ugh/oh no"
    } else if (emoji === "🤦") {
      // Dull thud (hand on forehead)
      const tsrc = ctx.createBufferSource();
      tsrc.buffer = _noiseBuf(ctx, 0.1);
      const tlp = ctx.createBiquadFilter(); tlp.type = "lowpass"; tlp.frequency.value = 500;
      const tg = _gain(ctx);
      tsrc.connect(tlp); tlp.connect(tg); tg.connect(ctx.destination);
      tg.gain.setValueAtTime(0.45, now);
      tg.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      tsrc.start(now);
      // Descending comedic "wah-wah" glide
      const wah = _osc(ctx, "sawtooth", 320);
      const wlp = ctx.createBiquadFilter(); wlp.type = "lowpass"; wlp.frequency.value = 600;
      const wg = _gain(ctx);
      wah.connect(wlp); wlp.connect(wg); wg.connect(ctx.destination);
      wah.frequency.setValueAtTime(320, now + 0.05);
      wah.frequency.linearRampToValueAtTime(100, now + 0.38);
      wg.gain.setValueAtTime(0.14, now + 0.05);
      wg.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
      wah.start(now + 0.05); wah.stop(now + 0.45);

    // ── Shrug 🤷 ──────────────────────────────────────────────────
    // Rising-then-falling question-mark tone — "I dunno"
    } else if (emoji === "🤷") {
      const o = _osc(ctx, "sine", 420);
      const g = _gain(ctx);
      o.connect(g); g.connect(ctx.destination);
      o.frequency.setValueAtTime(420, now);
      o.frequency.linearRampToValueAtTime(560, now + 0.14);
      o.frequency.linearRampToValueAtTime(380, now + 0.32);
      g.gain.setValueAtTime(0.13, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      o.start(now); o.stop(now + 0.4);

    // ── Wave / Bye 👋 ──────────────────────────────────────────────
    // Friendly descending two-tone — warmth going down (like waving)
    } else if (emoji === "👋") {
      [880, 660].forEach((freq, i) => {
        const o = _osc(ctx, "sine", freq);
        const g = _gain(ctx);
        o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0, now + i * 0.14);
        g.gain.linearRampToValueAtTime(0.13, now + i * 0.14 + 0.012);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.14 + 0.42);
        o.start(now + i * 0.14); o.stop(now + i * 0.14 + 0.48);
      });

    // ── Handshake / Deal 🤝 ────────────────────────────────────────
    // Firm bass thump + confirmation ding — solid agreement sound
    } else if (emoji === "🤝") {
      // Firm handshake thump
      const nsrc = ctx.createBufferSource();
      nsrc.buffer = _noiseBuf(ctx, 0.1);
      const nlp = ctx.createBiquadFilter(); nlp.type = "lowpass"; nlp.frequency.value = 700;
      const ng = _gain(ctx);
      nsrc.connect(nlp); nlp.connect(ng); ng.connect(ctx.destination);
      ng.gain.setValueAtTime(0.38, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      nsrc.start(now);
      const bass = _osc(ctx, "sine", 110);
      const bg = _gain(ctx);
      bass.connect(bg); bg.connect(ctx.destination);
      bass.frequency.setValueAtTime(110, now);
      bass.frequency.linearRampToValueAtTime(48, now + 0.16);
      bg.gain.setValueAtTime(0.32, now);
      bg.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      bass.start(now); bass.stop(now + 0.2);
      // Confirmation ding (deal made!)
      const ding = _osc(ctx, "sine", 1046);
      const dg = _gain(ctx);
      ding.connect(dg); dg.connect(ctx.destination);
      dg.gain.setValueAtTime(0, now + 0.07);
      dg.gain.linearRampToValueAtTime(0.12, now + 0.085);
      dg.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
      ding.start(now + 0.07); ding.stop(now + 0.45);

    // ── Ghost 👻 ──────────────────────────────────────────────────
    // Haunting "woooooo" — pitch-bending sine + breathy filtered noise
    } else if (emoji === "👻") {
      const osc = _osc(ctx, "sine", 310);
      const env = _gain(ctx);
      osc.connect(env); env.connect(ctx.destination);
      osc.frequency.setValueAtTime(310, now);
      osc.frequency.linearRampToValueAtTime(225, now + 0.38);
      osc.frequency.linearRampToValueAtTime(270, now + 0.72);
      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(0.17, now + 0.18);
      env.gain.setValueAtTime(0.17, now + 0.5);
      env.gain.exponentialRampToValueAtTime(0.001, now + 0.76);
      osc.start(now); osc.stop(now + 0.8);
      // Breathy undertone
      const nsrc = ctx.createBufferSource();
      nsrc.buffer = _noiseBuf(ctx, 0.78);
      const nlp = ctx.createBiquadFilter(); nlp.type = "lowpass"; nlp.frequency.value = 450;
      const ng = _gain(ctx);
      nsrc.connect(nlp); nlp.connect(ng); ng.connect(ctx.destination);
      ng.gain.setValueAtTime(0, now);
      ng.gain.linearRampToValueAtTime(0.07, now + 0.2);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.76);
      nsrc.start(now);

    // ── Robot / Alien 🤖👽 ────────────────────────────────────────
    // 3 stepped electronic pulses — unmistakably digital/mechanical
    } else if (["🤖","👽"].includes(emoji)) {
      [660, 880, 550].forEach((freq, i) => {
        const o = _osc(ctx, "square", freq);
        const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1600;
        const g = _gain(ctx);
        o.connect(lp); lp.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0, now + i * 0.1);
        g.gain.linearRampToValueAtTime(0.13, now + i * 0.1 + 0.012);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.09);
        o.start(now + i * 0.1); o.stop(now + i * 0.1 + 0.11);
      });

    // ── Ice / Snow ❄️ ──────────────────────────────────────────────
    // High crystalline tinkle — glass wind-chime quality
    } else if (emoji === "❄️") {
      [2093, 2637, 3136, 2349].forEach((freq, i) => {
        const o = _osc(ctx, "sine", freq);
        const g = _gain(ctx);
        o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0, now + i * 0.07);
        g.gain.linearRampToValueAtTime(0.1 / (i * 0.2 + 1), now + i * 0.07 + 0.006);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.38);
        o.start(now + i * 0.07); o.stop(now + i * 0.07 + 0.42);
      });

    // ── Dance 💃🕺 ────────────────────────────────────────────────
    // 3 kick drum hits + musical note — rhythmic, energetic
    } else if (["💃","🕺"].includes(emoji)) {
      [0, 0.14, 0.28].forEach((dt) => {
        const nsrc = ctx.createBufferSource();
        nsrc.buffer = _noiseBuf(ctx, 0.1);
        const bp = _bpf(ctx, 180, 3.5);
        const g = _gain(ctx);
        nsrc.connect(bp); bp.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.32, now + dt);
        g.gain.exponentialRampToValueAtTime(0.001, now + dt + 0.1);
        nsrc.start(now + dt);
      });
      // Melodic hit at the end
      const note = _osc(ctx, "sine", 523);
      const ng = _gain(ctx);
      note.connect(ng); ng.connect(ctx.destination);
      ng.gain.setValueAtTime(0, now + 0.3);
      ng.gain.linearRampToValueAtTime(0.15, now + 0.315);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.68);
      note.start(now + 0.3); note.stop(now + 0.72);

    // ── Nature / Blossom 🌸🌺🌻🌈🍀🦋☀️ ─────────────────────────
    // Soft sparkle chime — delicate, natural, not hearts
    } else if (["🌸","🌺","🌻","🌈","🍀","🦋","☀️"].includes(emoji)) {
      [1047, 1319, 1568].forEach((freq, i) => {
        const o = _osc(ctx, "sine", freq);
        const g = _gain(ctx);
        o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0, now + i * 0.1);
        g.gain.linearRampToValueAtTime(0.09, now + i * 0.1 + 0.008);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.45);
        o.start(now + i * 0.1); o.stop(now + i * 0.1 + 0.5);
      });

    // ── Default: soft blip ─────────────────────────────────────────
    } else {
      const o = _osc(ctx, "sine", 640);
      const g = _gain(ctx);
      o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.1, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      o.start(now); o.stop(now + 0.2);
    }

    setTimeout(() => ctx.close().catch(() => {}), 2500);
  } catch { /* ignore */ }
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
  const [roomPerms, setRoomPerms] = useState<RoomPerms>({ camera: true, mic: true, chat: true, screen: true });
  // New advanced feature state
  const [roomMode, setRoomMode] = useState<"conversation" | "stage">("conversation");
  const [roomPassword, setRoomPassword] = useState<string | null>(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [isListener, setIsListener] = useState(false);
  const [isOnStage, setIsOnStage] = useState(false);
  const [stageMembers, setStageMembers] = useState<Set<string>>(new Set());
  const [pendingJoin, setPendingJoin] = useState(false);
  const joinTimeRef = useRef<number>(Date.now());

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
        .select("room_name, room_topic, is_private, owner_id, join_cost_vx, is_default, is_active, allow_camera, allow_mic, allow_chat, allow_screen_share, room_mode, room_password")
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
      setRoomPerms({
        camera: room.allow_camera ?? true,
        mic: room.allow_mic ?? true,
        chat: room.allow_chat ?? true,
        screen: room.allow_screen_share ?? true,
      });
      const mode = (room as { room_mode?: string }).room_mode as "conversation" | "stage" | undefined;
      const pwd = (room as { room_password?: string | null }).room_password ?? null;
      setRoomMode(mode || "conversation");
      setRoomPassword(pwd);

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

      // Show join modal for password/stage mode (skip for owner and existing members)
      const hasPassword = !!pwd;
      const isStageRoom = (mode || "conversation") === "stage";
      if ((hasPassword || isStageRoom) && room.owner_id !== user.id && !existingMember) {
        setLoading(false);
        setPendingJoin(true);
        setShowJoinModal(true);
        return;
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
        const updated = payload.new as {
          owner_id?: string; room_topic?: string; is_private?: boolean;
          allow_camera?: boolean; allow_mic?: boolean; allow_chat?: boolean; allow_screen_share?: boolean;
        };
        if (updated.owner_id !== undefined) setOwnerId(updated.owner_id);
        if (updated.room_topic !== undefined) {
          setRoomTopic(updated.room_topic);
          setTopicDraft((prev) => prev === roomTopicRef.current ? updated.room_topic! : prev);
        }
        if (updated.is_private !== undefined) setIsPrivate(updated.is_private);
        setRoomPerms((prev) => ({
          camera: updated.allow_camera ?? prev.camera,
          mic: updated.allow_mic ?? prev.mic,
          chat: updated.allow_chat ?? prev.chat,
          screen: updated.allow_screen_share ?? prev.screen,
        }));
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

  const handleJoinConfirmed = async (joinMode: "speaker" | "listener", password?: string) => {
    if (!user || !roomId) return;
    // Validate password
    if (roomPassword && password !== roomPassword) {
      toast({ title: t("vroom.wrongPassword"), variant: "destructive" });
      return;
    }
    const listenerMode = joinMode === "listener";
    setIsListener(listenerMode);
    setShowJoinModal(false);
    setPendingJoin(false);
    joinTimeRef.current = Date.now();
    // Upsert membership
    await supabase.from("voice_room_members").upsert(
      { room_id: roomId, user_id: user.id, raise_hand: false, is_listener: listenerMode },
      { onConflict: "room_id,user_id" }
    );
    // Fetch token
    const { data, error: fnErr } = await supabase.functions.invoke("livekit-token", {
      body: { roomId, userId: user.id, userName: user.user_metadata?.display_name || user.email },
    });
    if (fnErr || !data?.token) {
      setError(fnErr?.message || t("vroom.tokenError"));
    } else {
      setToken(data.token);
    }
    setLoading(false);
  };

  const handlePromoteToStage = async (userId: string) => {
    if (!roomId) return;
    await supabase.from("voice_room_members").update({ is_on_stage: true }).eq("room_id", roomId).eq("user_id", userId);
    setStageMembers((prev) => new Set([...prev, userId]));
    const participant = stageMembers;
    toast({ title: t("vroom.promotedToStage").replace("{name}", userId) });
  };

  const handleDemoteFromStage = async (userId: string) => {
    if (!roomId) return;
    await supabase.from("voice_room_members").update({ is_on_stage: false }).eq("room_id", roomId).eq("user_id", userId);
    setStageMembers((prev) => { const s = new Set(prev); s.delete(userId); return s; });
    toast({ title: t("vroom.demotedFromStage").replace("{name}", userId) });
  };

  // Load stage members + realtime
  useEffect(() => {
    if (!roomId || !token) return;
    supabase
      .from("voice_room_members")
      .select("user_id, is_on_stage")
      .eq("room_id", roomId)
      .eq("is_on_stage", true)
      .then(({ data }) => {
        if (data) setStageMembers(new Set(data.map((m) => m.user_id)));
      });
    // Owner is always on stage
    if (ownerId) setStageMembers((prev) => new Set([...prev, ownerId]));
    // Current user on stage if owner
    if (user && user.id === ownerId) setIsOnStage(true);
    const ch = supabase
      .channel(`room-stage-${roomId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "voice_room_members", filter: `room_id=eq.${roomId}` }, (payload) => {
        const updated = payload.new as { user_id?: string; is_on_stage?: boolean; room_mode?: string };
        if (!updated.user_id) return;
        setStageMembers((prev) => {
          const s = new Set(prev);
          if (updated.is_on_stage) s.add(updated.user_id!);
          else s.delete(updated.user_id!);
          return s;
        });
        if (updated.user_id === user?.id) setIsOnStage(!!updated.is_on_stage);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [roomId, token, ownerId, user]);

  // Subscribe to room_mode changes
  useEffect(() => {
    if (!roomId || !token) return;
    const ch = supabase
      .channel(`room-mode-${roomId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "voice_rooms", filter: `id=eq.${roomId}` }, (payload) => {
        const u = payload.new as { room_mode?: string };
        if (u.room_mode) setRoomMode(u.room_mode as "conversation" | "stage");
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [roomId, token]);

  const handleLeave = async () => {
    leftIntentionally.current = true;
    // VX rewards: 1 VX per 5 minutes, max 20
    const minutes = Math.floor((Date.now() - joinTimeRef.current) / 60000);
    const vxToAward = Math.min(Math.floor(minutes / 5), 20);
    if (vxToAward > 0) {
      toast({ title: t("vroom.vxEarned").replace("{vx}", String(vxToAward)), duration: 5000 });
      // Attempt RPC grant (non-blocking)
      supabase.rpc("grant_vx_to_user" as never, { user_id: user?.id, amount: vxToAward, reason: "voice_room_participation" } as never).catch(() => {});
    } else if (minutes > 0) {
      toast({ title: t("vroom.vxMinimum"), duration: 3000 });
    }
    await cleanup();
    navigate("/community");
  };

  const canModerate = user?.id === ownerId || isAdmin;
  const isOwner = user?.id === ownerId;

  const handleUpdatePerms = useCallback(async (key: keyof RoomPerms, val: boolean) => {
    if (!roomId || !user) return;
    const colMap: Record<keyof RoomPerms, string> = {
      camera: "allow_camera", mic: "allow_mic", chat: "allow_chat", screen: "allow_screen_share",
    };
    await supabase.from("voice_rooms").update({ [colMap[key]]: val }).eq("id", roomId);
    setRoomPerms((prev) => ({ ...prev, [key]: val }));
    // Notify all room members via broadcast
    const bc = supabase.channel(`room-bc-${roomId}`);
    bc.send({
      type: "broadcast", event: "perms_changed",
      payload: {
        [key]: val,
        byUserId: user.id,
        byName: user.user_metadata?.display_name || user.email || "",
      },
    });
  }, [roomId, user]);

  // Show join modal (password / stage mode choice)
  if (showJoinModal) {
    return (
      <Layout>
        <JoinModal
          roomName={roomName}
          hasPassword={!!roomPassword}
          isStageMode={roomMode === "stage"}
          t={t}
          onJoin={handleJoinConfirmed}
        />
      </Layout>
    );
  }

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
                  isOwner={isOwner}
                  currentUserId={user?.id ?? ""}
                  roomId={roomId ?? ""}
                  raisedHands={raisedHands}
                  roomPerms={roomPerms}
                  onUpdatePerms={handleUpdatePerms}
                  t={t}
                  isOnStage={isOnStage || isOwner}
                  isListener={isListener}
                  isStageMode={roomMode === "stage"}
                  stageMembers={stageMembers}
                  onPromoteToStage={handlePromoteToStage}
                  onDemoteFromStage={handleDemoteFromStage}
                  joinTimeRef={joinTimeRef}
                />
              </LiveKitRoom>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
