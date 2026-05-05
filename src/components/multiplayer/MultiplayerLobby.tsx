import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, LogIn, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";
import { GAME_LABELS, GameType } from "@/systems/multiplayerSystem";

interface Props {
  gameType: GameType;
  loading: boolean;
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => void;
}

export function MultiplayerLobby({ gameType, loading, onCreateRoom, onJoinRoom }: Props) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [code, setCode] = useState("");

  if (!user) {
    return (
      <Card>
        <CardContent className="pt-6 text-center space-y-4">
          <p className="text-2xl">🔒</p>
          <p className="text-muted-foreground">{t("mp.loginRequired")}</p>
          <Button asChild><Link to="/login">{t("mp.logIn")}</Link></Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          {GAME_LABELS[gameType]} — {t("mp.online")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Create */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{t("mp.startNewRoom")}</p>
          <Button className="w-full" onClick={onCreateRoom} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            {t("mp.createRoom")}
          </Button>
        </div>

        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <div className="flex-1 border-t" />{t("mp.or")}<div className="flex-1 border-t" />
        </div>

        {/* Join */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{t("mp.joinFriendRoom")}</p>
          <div className="flex gap-2">
            <Input
              placeholder={t("mp.roomCodePlaceholder")}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="font-mono tracking-widest text-center text-lg uppercase"
              onKeyDown={(e) => e.key === "Enter" && code.length === 6 && onJoinRoom(code)}
            />
            <Button onClick={() => onJoinRoom(code)} disabled={code.length !== 6 || loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="bg-muted/40 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
          <p>• {t("mp.eachRoomHolds")} <Badge variant="secondary" className="text-xs">{t("mp.players2")}</Badge></p>
          <p>• {t("mp.shareCode")}</p>
          <p>• {t("mp.roomsExpire")}</p>
        </div>
      </CardContent>
    </Card>
  );
}
