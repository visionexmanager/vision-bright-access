import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MPPlayer } from "@/systems/multiplayerSystem";

interface Props {
  opponent?: MPPlayer;
  isOpponentTurn?: boolean;
  label?: string;
  extraInfo?: React.ReactNode;
}

export function OpponentPanel({ opponent, isOpponentTurn, label = "Opponent", extraInfo }: Props) {
  if (!opponent) return null;
  return (
    <Card className={`transition-all ${isOpponentTurn ? "border-primary shadow-md" : "opacity-80"}`}>
      <CardContent className="py-3 px-4 flex items-center gap-3">
        <span className="text-2xl">🎮</span>
        <div className="flex-1">
          <p className="font-semibold text-sm">{opponent.name}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
        <div className="text-right space-y-1">
          <Badge variant="secondary">⭐ {opponent.score}</Badge>
          {isOpponentTurn && <Badge className="block text-xs">Their turn</Badge>}
          {extraInfo}
        </div>
      </CardContent>
    </Card>
  );
}

interface FinishBannerProps {
  winnerId: string | null;
  myId: string;
  players: MPPlayer[];
  onRematch?: () => void;
}

export function FinishBanner({ winnerId, myId, players, onRematch }: FinishBannerProps) {
  const winner = players.find((p) => p.id === winnerId);
  const iWon  = winnerId === myId;
  const isDraw = winnerId === null;

  return (
    <Card className="border-2 border-primary">
      <CardContent className="pt-6 text-center space-y-3">
        <p className="text-5xl">{isDraw ? "🤝" : iWon ? "🏆" : "😞"}</p>
        <p className="text-2xl font-bold">
          {isDraw ? "It's a draw!" : iWon ? "You won!" : `${winner?.name ?? "Opponent"} won!`}
        </p>
        <div className="flex justify-center gap-4 flex-wrap">
          {players.map((p) => (
            <Badge key={p.id} variant={p.id === winnerId ? "default" : "secondary"}>
              {p.name}: {p.score}
            </Badge>
          ))}
        </div>
        {onRematch && (
          <button
            onClick={onRematch}
            className="mt-2 text-sm text-primary underline underline-offset-2"
          >
            Back to lobby
          </button>
        )}
      </CardContent>
    </Card>
  );
}
