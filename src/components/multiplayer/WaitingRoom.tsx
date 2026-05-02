import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Play, LogOut, Loader2 } from "lucide-react";
import { useState } from "react";
import { GameSession, GAME_LABELS } from "@/systems/multiplayerSystem";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  session: GameSession;
  isHost: boolean;
  onStart: () => void;   // host only
  onLeave: () => void;
}

export function WaitingRoom({ session, isHost, onStart, onLeave }: Props) {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(session.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const canStart = isHost && session.players.length >= 2;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-center text-xl">
          {GAME_LABELS[session.game_type as keyof typeof GAME_LABELS]} — Waiting Room
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Room code */}
        <div className="text-center space-y-1">
          <p className="text-sm text-muted-foreground">Room Code — share with a friend</p>
          <div className="flex items-center justify-center gap-2">
            <span className="font-mono text-4xl font-bold tracking-[0.3em] text-primary">
              {session.id}
            </span>
            <Button size="icon" variant="ghost" onClick={copy} aria-label="Copy code">
              {copied ? <Check className="h-5 w-5 text-green-500" /> : <Copy className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Players */}
        <div className="space-y-2">
          {session.players.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-lg border px-4 py-3">
              <span className="text-2xl">{p.avatar ? "🧑" : "🎮"}</span>
              <span className="font-medium flex-1">{p.name}</span>
              {p.id === session.host_id && <Badge variant="secondary">Host</Badge>}
              {p.id === user?.id && <Badge>You</Badge>}
              <span className="text-green-500 text-sm">● Connected</span>
            </div>
          ))}

          {session.players.length < session.max_players && (
            <div className="flex items-center gap-3 rounded-lg border border-dashed px-4 py-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Waiting for opponent…</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onLeave}>
            <LogOut className="h-4 w-4 mr-2" /> Leave
          </Button>
          {isHost && (
            <Button className="flex-1" onClick={onStart} disabled={!canStart}>
              <Play className="h-4 w-4 mr-2" />
              {canStart ? "Start Game" : "Need 2 players"}
            </Button>
          )}
          {!isHost && (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Waiting for host to start…
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
