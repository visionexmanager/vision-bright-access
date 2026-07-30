import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { LiveKitRoom, RoomAudioRenderer, useParticipants, useLocalParticipant } from "@livekit/components-react";
import "@livekit/components-styles";
import { ChevronLeft, Hand, LogOut, Mic, MicOff, Radio, ShieldAlert, Users, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import {
  useVoiceRoom, useRoomMembers, useJoinVoiceRoom, useLeaveVoiceRoom,
  useRaiseHand, useSetMemberMuted, usePromoteToModerator, useBanFromRoom, useSetRoomRecording,
} from "@/features/visionkids/hooks/social/useVoiceRooms";
import { useProfiles } from "@/features/visionkids/hooks/social/useFriends";
import { fetchLiveKitToken } from "@/features/visionkids/services/social/voiceRooms";
import { ReportDialog } from "@/features/visionkids/components/social/ReportDialog";

function PushToTalkStage({ canSpeak }: { canSpeak: boolean }) {
  const { t } = useLanguage();
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const [holding, setHolding] = useState(false);

  useEffect(() => {
    localParticipant.setMicrophoneEnabled(canSpeak && holding).catch(() => {});
  }, [holding, canSpeak, localParticipant]);

  return (
    <div className="flex flex-col items-center gap-4">
      <RoomAudioRenderer />

      <div className="grid w-full grid-cols-3 gap-2 sm:grid-cols-4">
        {participants.map((p) => (
          <div key={p.sid} className={`flex flex-col items-center gap-1 rounded-2xl border-2 p-3 text-center ${p.isSpeaking ? "border-kids-green bg-kids-green/10" : "border-border bg-card"}`}>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-kids-primary/10 font-bold text-kids-primary">
              {(p.name || p.identity).slice(0, 1).toUpperCase()}
            </div>
            <p className="max-w-full truncate text-xs font-semibold">{p.name || p.identity}</p>
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={!canSpeak}
        onPointerDown={() => setHolding(true)}
        onPointerUp={() => setHolding(false)}
        onPointerLeave={() => setHolding(false)}
        className={`flex h-24 w-24 items-center justify-center rounded-full border-4 text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
          holding ? "border-kids-green bg-kids-green" : "border-kids-primary bg-kids-primary"
        }`}
        aria-pressed={holding}
        aria-label={t("kids.social.voiceRoom.holdToTalk")}
      >
        {holding ? <Mic className="h-8 w-8" aria-hidden="true" /> : <MicOff className="h-8 w-8" aria-hidden="true" />}
      </button>
      <p className="text-sm text-muted-foreground">{canSpeak ? t("kids.social.voiceRoom.holdToTalk") : t("kids.social.voiceRoom.youAreMuted")}</p>
    </div>
  );
}

export default function VoiceRoomLive() {
  const { roomId } = useParams<{ roomId: string }>();
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reportUserId, setReportUserId] = useState<string | null>(null);
  const [connection, setConnection] = useState<{ token: string; url: string } | null>(null);

  const { data: room } = useVoiceRoom(roomId);
  const { data: members = [] } = useRoomMembers(roomId);
  const joinRoom = useJoinVoiceRoom();
  const leaveRoom = useLeaveVoiceRoom();
  const raiseHand = useRaiseHand(roomId);
  const setMemberMuted = useSetMemberMuted(roomId);
  const promoteModerator = usePromoteToModerator(roomId);
  const banFromRoom = useBanFromRoom(roomId);
  const setRecording = useSetRoomRecording(roomId);

  const me = members.find((m) => m.user_id === user?.id);
  const isModerator = me?.role === "owner" || me?.role === "moderator";
  const canSpeak = !!me && !me.is_muted && !me.is_listener;

  const otherIds = members.map((m) => m.user_id).filter((id) => id !== user?.id);
  const { data: profiles = [] } = useProfiles(otherIds);
  const profileMap = new Map(profiles.map((p) => [p.user_id, p]));

  useDocumentHead({ title: room ? `${room.room_name} — VisionKids` : t("kids.social.meta.title"), description: "", canonicalPath: `/kids/social/voice-rooms/${roomId}` });

  useEffect(() => {
    if (!roomId || !user) return;
    joinRoom.mutate(roomId);
    fetchLiveKitToken(roomId, user.user_metadata?.display_name || user.email || user.id).then(setConnection).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, user?.id]);

  const handleLeave = () => {
    if (roomId) leaveRoom.mutate(roomId);
    navigate("/kids/social/voice-rooms");
  };

  if (!room) return <div className="mx-auto max-w-2xl px-4 py-16" aria-busy="true"><div className="h-64 animate-pulse rounded-2xl bg-muted" /></div>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Link to="/kids/social/voice-rooms" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {t("kids.social.nav.voiceRooms")}
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 font-heading text-2xl font-extrabold"><Radio className="h-6 w-6 text-kids-purple" aria-hidden="true" /> {room.room_name}</h1>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleLeave}><LogOut className="h-4 w-4" aria-hidden="true" /> {t("kids.social.voiceRoom.leave")}</Button>
      </div>
      {room.topic && <p className="mt-1 text-sm text-muted-foreground">{room.topic}</p>}

      <div className="mt-4 flex items-center gap-2">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => raiseHand.mutate(!me?.raised_at)}>
          <Hand className={me?.raised_at ? "h-4 w-4 text-kids-accent" : "h-4 w-4"} aria-hidden="true" /> {t("kids.social.voiceRoom.raiseHand")}
        </Button>
        {isModerator && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setRecording.mutate(!room.recording_active)}>
            <Video className="h-4 w-4" aria-hidden="true" /> {room.recording_active ? t("kids.social.voiceRoom.stopRecording") : t("kids.social.voiceRoom.startRecording")}
          </Button>
        )}
      </div>

      <div className="mt-6">
        {connection ? (
          <LiveKitRoom token={connection.token} serverUrl={connection.url} connect audio={false} video={false} data-lk-theme="default">
            <PushToTalkStage canSpeak={canSpeak} />
          </LiveKitRoom>
        ) : (
          <div className="h-40 animate-pulse rounded-2xl bg-muted" aria-busy="true" />
        )}
      </div>

      <h2 className="mt-6 flex items-center gap-2 font-heading text-sm font-bold"><Users className="h-4 w-4" aria-hidden="true" /> {t("kids.social.voiceRoom.participants")} ({members.length})</h2>
      <div className="mt-2 flex flex-col gap-1.5">
        {members.map((m) => {
          const name = m.user_id === user?.id ? t("kids.social.voiceRoom.you") : profileMap.get(m.user_id)?.display_name || t("kids.social.friends.unknownUser");
          return (
            <div key={m.user_id} className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm">
              <span className="flex items-center gap-1.5 font-semibold">
                {name} {m.role !== "participant" && <span className="rounded-full bg-kids-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-kids-primary">{t(`kids.social.voiceRoom.role.${m.role}`)}</span>}
                {m.raised_at && <Hand className="h-3.5 w-3.5 text-kids-accent" aria-hidden="true" />}
                {m.is_muted && <MicOff className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />}
              </span>
              {isModerator && m.user_id !== user?.id && (
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setMemberMuted.mutate({ userId: m.user_id, muted: !m.is_muted })}>
                    {m.is_muted ? t("kids.social.voiceRoom.unmute") : t("kids.social.voiceRoom.mute")}
                  </Button>
                  {m.role === "participant" && (
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => promoteModerator.mutate(m.user_id)}>{t("kids.social.voiceRoom.promote")}</Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive" onClick={() => banFromRoom.mutate(m.user_id)}>{t("kids.social.voiceRoom.ban")}</Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 px-0 text-destructive" onClick={() => setReportUserId(m.user_id)} aria-label={t("kids.social.report.reportUser")}>
                    <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {reportUserId && (
        <ReportDialog open={!!reportUserId} onOpenChange={(o) => !o && setReportUserId(null)} contentType="kids_user" contentId={reportUserId} />
      )}
    </div>
  );
}
