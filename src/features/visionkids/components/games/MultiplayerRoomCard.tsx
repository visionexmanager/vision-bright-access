import { Users, Lock, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import type { MultiplayerRoom } from "@/features/visionkids/types/games.types";

interface MultiplayerRoomCardProps {
  room: MultiplayerRoom;
  onJoin: (roomId: string) => void;
  joining?: boolean;
}

export function MultiplayerRoomCard({ room, onJoin, joining }: MultiplayerRoomCardProps) {
  const { t } = useLanguage();
  const playerCount = room.players?.length ?? 0;
  const isFull = playerCount >= room.max_players;

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-border bg-card p-4">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 font-heading font-bold">
          {room.is_public ? <Globe className="h-4 w-4 text-kids-secondary" aria-hidden="true" /> : <Lock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
          {room.room_name}
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
          <Users className="h-3.5 w-3.5" aria-hidden="true" /> {playerCount}/{room.max_players} · {t("kids.games.roomCode")}: {room.code}
        </p>
      </div>
      <Button size="sm" disabled={isFull || joining} onClick={() => onJoin(room.id)} className="bg-kids-primary text-white hover:bg-kids-primary/90">
        {isFull ? t("kids.games.roomFull") : t("kids.games.join")}
      </Button>
    </div>
  );
}
