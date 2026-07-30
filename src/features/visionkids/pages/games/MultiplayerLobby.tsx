import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Swords, Plus, KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { usePublicRooms, useCreateRoom, useJoinRoomByCode } from "@/features/visionkids/hooks/games/useMultiplayerRoom";
import { MultiplayerRoomCard } from "@/features/visionkids/components/games/MultiplayerRoomCard";

export default function MultiplayerLobby() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: rooms = [], isLoading } = usePublicRooms();
  const createRoom = useCreateRoom();
  const joinByCode = useJoinRoomByCode();

  const [createOpen, setCreateOpen] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);

  useDocumentHead({ title: t("kids.games.multiplayerLobby"), description: t("kids.games.meta.description"), canonicalPath: "/kids/games/multiplayer" });

  const handleCreate = async () => {
    const room = await createRoom.mutateAsync({ roomName: roomName.trim() || "Quiz Battle", isPublic });
    setCreateOpen(false);
    navigate(`/kids/games/multiplayer/${room.id}`);
  };

  const handleJoinByCode = async () => {
    setJoinError(null);
    const room = await joinByCode.mutateAsync(joinCode.trim());
    if (!room) { setJoinError(t("kids.games.roomNotFound")); return; }
    navigate(`/kids/games/multiplayer/${room.id}`);
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <Swords className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden="true" />
        <p className="mt-3 text-lg font-semibold">{t("kids.stories.signInRequired")}</p>
        <Link to="/login" className="mt-2 inline-block text-kids-primary hover:underline">{t("nav.login")}</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="flex items-center gap-2 font-heading text-3xl font-extrabold">
        <Swords className="h-7 w-7 text-kids-purple" aria-hidden="true" /> {t("kids.games.multiplayerLobby")}
      </h1>
      <p className="mt-1 text-muted-foreground">{t("kids.games.multiplayerSubtitle")}</p>

      <div className="mt-5 flex flex-wrap gap-2">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-1.5 bg-kids-purple text-white hover:bg-kids-purple/90"><Plus className="h-4 w-4" aria-hidden="true" /> {t("kids.games.createRoom")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("kids.games.createRoom")}</DialogTitle></DialogHeader>
            <div className="flex flex-col gap-4 pt-2">
              <div>
                <Label htmlFor="kids-room-name">{t("kids.games.roomName")}</Label>
                <Input id="kids-room-name" value={roomName} onChange={(e) => setRoomName(e.target.value)} placeholder={t("kids.games.roomNamePlaceholder")} maxLength={40} className="mt-1" />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="kids-room-public">{t("kids.games.publicRoom")}</Label>
                <Switch id="kids-room-public" checked={isPublic} onCheckedChange={setIsPublic} />
              </div>
              <Button onClick={handleCreate} disabled={createRoom.isPending} className="gap-1.5 bg-kids-purple text-white hover:bg-kids-purple/90">
                {createRoom.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} {t("kids.games.createRoom")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <div className="flex items-center gap-2">
          <Input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder={t("kids.games.enterCode")} maxLength={6} className="w-32" aria-label={t("kids.games.roomCode")} />
          <Button variant="outline" onClick={handleJoinByCode} disabled={!joinCode.trim() || joinByCode.isPending} className="gap-1.5">
            <KeyRound className="h-4 w-4" aria-hidden="true" /> {t("kids.games.join")}
          </Button>
        </div>
      </div>
      {joinError && <p className="mt-2 text-sm text-destructive" role="alert">{joinError}</p>}

      <h2 className="mt-8 font-heading text-lg font-bold">{t("kids.games.publicRooms")}</h2>
      {isLoading ? (
        <div className="mt-3 flex flex-col gap-2" aria-busy="true">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : rooms.length === 0 ? (
        <p className="mt-4 text-center text-muted-foreground">{t("kids.games.noRoomsYet")}</p>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {rooms.map((room) => (
            <MultiplayerRoomCard key={room.id} room={room} onJoin={(id) => navigate(`/kids/games/multiplayer/${id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}
