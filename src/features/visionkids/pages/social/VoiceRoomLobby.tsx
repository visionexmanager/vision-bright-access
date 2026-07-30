import { useState } from "react";
import { Link } from "react-router-dom";
import { Mic, Plus, Radio, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useVoiceRoomList, useCreateVoiceRoom } from "@/features/visionkids/hooks/social/useVoiceRooms";

export default function VoiceRoomLobby() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: rooms = [], isLoading } = useVoiceRoomList();
  const createRoom = useCreateVoiceRoom();

  const [createOpen, setCreateOpen] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [topic, setTopic] = useState("");

  useDocumentHead({ title: `${t("kids.social.nav.voiceRooms")} — VisionKids`, description: t("kids.social.meta.description"), canonicalPath: "/kids/social/voice-rooms" });

  const handleCreate = () => {
    if (!roomName.trim()) return;
    createRoom.mutate({ roomName: roomName.trim(), topic: topic.trim() || undefined }, { onSuccess: () => { setCreateOpen(false); setRoomName(""); setTopic(""); } });
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 font-heading text-3xl font-extrabold">
          <Mic className="h-7 w-7 text-kids-purple" aria-hidden="true" /> {t("kids.social.nav.voiceRooms")}
        </h1>
        {user && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" aria-hidden="true" /> {t("kids.social.voiceRoom.create")}</Button>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("kids.social.voiceRoom.create")}</DialogTitle></DialogHeader>
              <div className="flex flex-col gap-3">
                <Input value={roomName} onChange={(e) => setRoomName(e.target.value)} placeholder={t("kids.social.voiceRoom.namePlaceholder")} maxLength={60} />
                <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={t("kids.social.voiceRoom.topicPlaceholder")} maxLength={120} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>{t("kids.social.cancel")}</Button>
                <Button onClick={handleCreate} disabled={createRoom.isPending || !roomName.trim()}>{t("kids.social.voiceRoom.create")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
      <p className="mt-1 text-muted-foreground">{t("kids.social.voiceRoom.subtitle")}</p>

      {isLoading ? (
        <div className="mt-6 flex flex-col gap-2" aria-busy="true">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : rooms.length === 0 ? (
        <p className="mt-8 text-center text-muted-foreground">{t("kids.social.voiceRoom.empty")}</p>
      ) : (
        <div className="mt-6 flex flex-col gap-2">
          {rooms.map((r) => (
            <Link key={r.id} to={`/kids/social/voice-rooms/${r.id}`} className="flex items-center justify-between rounded-2xl border-2 border-border bg-card p-4 hover:border-kids-purple/50">
              <div>
                <p className="flex items-center gap-1.5 font-heading font-bold"><Radio className="h-4 w-4 text-kids-purple" aria-hidden="true" /> {r.room_name}</p>
                {r.topic && <p className="text-sm text-muted-foreground">{r.topic}</p>}
              </div>
              <span className="flex items-center gap-1 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" aria-hidden="true" /> {r.max_users}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
