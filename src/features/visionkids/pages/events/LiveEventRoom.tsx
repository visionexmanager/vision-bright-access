import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { LiveKitRoom, RoomAudioRenderer, useLocalParticipant, useTracks, VideoTrack, isTrackReference } from "@livekit/components-react";
import "@livekit/components-styles";
import { Track } from "livekit-client";
import { ChevronLeft, Mic, MicOff, Radio, Users, Video, VideoOff } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useEventBySlug } from "@/features/visionkids/hooks/events/useEvents";
import { useMyAttendanceForEvent, useCheckIn, useCheckOut } from "@/features/visionkids/hooks/events/useAttendance";
import { useEventMessages, useSendEventMessage } from "@/features/visionkids/hooks/events/useLiveFeatures";
import { useEventPolls } from "@/features/visionkids/hooks/events/useLiveFeatures";
import { fetchLiveKitToken } from "@/features/visionkids/services/social/voiceRooms";
import { MessageThread } from "@/features/visionkids/components/social/MessageThread";
import { LivePollWidget } from "@/features/visionkids/components/events/LivePollWidget";
import { LiveQAWidget } from "@/features/visionkids/components/events/LiveQAWidget";
import { ReactionBar } from "@/features/visionkids/components/events/ReactionBar";
import { WaitingRoom } from "@/features/visionkids/components/events/WaitingRoom";

function HostStage({ isHost }: { isHost: boolean }) {
  const { t } = useLanguage();
  const { localParticipant } = useLocalParticipant();
  const [camOn, setCamOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const cameraTracks = useTracks([Track.Source.Camera]);
  const hostTrack = cameraTracks.find(isTrackReference);

  useEffect(() => {
    if (!isHost) return;
    localParticipant.setCameraEnabled(camOn).catch(() => {});
  }, [camOn, isHost, localParticipant]);

  useEffect(() => {
    if (!isHost) return;
    localParticipant.setMicrophoneEnabled(micOn).catch(() => {});
  }, [micOn, isHost, localParticipant]);

  return (
    <div>
      <RoomAudioRenderer />
      <div className="flex aspect-video items-center justify-center overflow-hidden rounded-2xl bg-black">
        {hostTrack ? (
          <VideoTrack trackRef={hostTrack} className="h-full w-full object-cover" />
        ) : (
          <p className="flex items-center gap-2 text-white/70"><Radio className="h-5 w-5" aria-hidden="true" /> {t("kids.events.live.waitingForHost")}</p>
        )}
      </div>
      {isHost && (
        <div className="mt-2 flex justify-center gap-2">
          <button type="button" onClick={() => setCamOn((v) => !v)} className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${camOn ? "border-kids-green bg-kids-green/10" : "border-border"}`} aria-pressed={camOn} aria-label={t("kids.events.live.toggleCamera")}>
            {camOn ? <Video className="h-4 w-4" aria-hidden="true" /> : <VideoOff className="h-4 w-4" aria-hidden="true" />}
          </button>
          <button type="button" onClick={() => setMicOn((v) => !v)} className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${micOn ? "border-kids-green bg-kids-green/10" : "border-border"}`} aria-pressed={micOn} aria-label={t("kids.events.live.toggleMic")}>
            {micOn ? <Mic className="h-4 w-4" aria-hidden="true" /> : <MicOff className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
      )}
    </div>
  );
}

export default function LiveEventRoom() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useLanguage();
  const { user } = useAuth();

  const { data: event } = useEventBySlug(slug);
  const { data: attendance } = useMyAttendanceForEvent(event?.id);
  const checkIn = useCheckIn();
  const checkOut = useCheckOut();
  const joinedAtRef = useRef<number | null>(null);

  const [connection, setConnection] = useState<{ token: string; url: string } | null>(null);
  const { data: messages = [] } = useEventMessages(event?.id);
  const sendMessage = useSendEventMessage(event?.id);
  const { data: polls = [] } = useEventPolls(event?.id);
  const activePoll = polls.find((p) => p.is_active);

  const isHost = !!user && !!event && user.id === event.host_id;
  const hasStarted = event ? new Date(event.starts_at).getTime() <= Date.now() : false;

  useDocumentHead({ title: event ? `${event.title} — VisionKids` : t("kids.events.meta.title"), description: "", canonicalPath: `/kids/events/room/${slug}` });

  useEffect(() => {
    if (!event || !user || !hasStarted || attendance) return;
    checkIn.mutate(event.id);
    joinedAtRef.current = Date.now();
    // Keyed on the ids: a refetch that returns an equal event, or a Supabase
    // session refresh, must not check the child in a second time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id, user?.id, hasStarted]);

  useEffect(() => {
    if (!event || !user || !hasStarted) return;
    fetchLiveKitToken(event.id, user.user_metadata?.display_name || user.email || user.id).then(setConnection).catch(() => {});
    // Keyed on the ids for the same reason: a new object identity must not mint
    // a second LiveKit token for the same room.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id, user?.id, hasStarted]);

  useEffect(() => {
    return () => {
      if (attendance && joinedAtRef.current) {
        const duration = Math.round((Date.now() - joinedAtRef.current) / 1000);
        checkOut.mutate({ attendanceId: attendance.id, durationSeconds: duration });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendance?.id]);

  if (!event) return <div className="mx-auto max-w-3xl px-4 py-16" aria-busy="true"><div className="h-64 animate-pulse rounded-2xl bg-muted" /></div>;

  if (!hasStarted) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
        <Link to={`/kids/events/detail/${slug}`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {event.title}
        </Link>
        <WaitingRoom startsAt={event.starts_at} title={event.title} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link to={`/kids/events/detail/${slug}`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {event.title}
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 font-heading text-2xl font-extrabold"><Radio className="h-6 w-6 animate-pulse text-kids-pink" aria-hidden="true" /> {event.title}</h1>
        <span className="flex items-center gap-1 text-sm text-muted-foreground"><Users className="h-4 w-4" aria-hidden="true" /> {t("kids.events.live.attending")}</span>
      </div>

      {connection ? (
        <LiveKitRoom token={connection.token} serverUrl={connection.url} connect audio={isHost} video={isHost} data-lk-theme="default">
          <div className="mt-4"><HostStage isHost={isHost} /></div>
        </LiveKitRoom>
      ) : (
        <div className="mt-4 h-64 animate-pulse rounded-2xl bg-muted" aria-busy="true" />
      )}

      <div className="mt-4"><ReactionBar eventId={event.id} /></div>

      <Tabs defaultValue="chat" className="mt-4">
        <TabsList>
          <TabsTrigger value="chat">{t("kids.events.live.tabChat")}</TabsTrigger>
          <TabsTrigger value="polls">{t("kids.events.live.tabPolls")}</TabsTrigger>
          <TabsTrigger value="qa">{t("kids.events.live.tabQA")}</TabsTrigger>
        </TabsList>

        <TabsContent value="chat">
          <div className="h-80 overflow-hidden rounded-2xl border-2 border-border">
            <MessageThread
              messages={messages.map((m) => ({ id: m.id, senderId: m.user_id, content: m.content, isFlagged: m.is_flagged, wasFiltered: m.was_filtered, createdAt: m.created_at }))}
              onSend={(text) => sendMessage.mutate(text)}
              sending={sendMessage.isPending}
            />
          </div>
        </TabsContent>

        <TabsContent value="polls">
          {activePoll ? <LivePollWidget poll={activePoll} /> : <p className="py-6 text-center text-muted-foreground">{t("kids.events.live.noActivePoll")}</p>}
        </TabsContent>

        <TabsContent value="qa">
          <LiveQAWidget eventId={event.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
