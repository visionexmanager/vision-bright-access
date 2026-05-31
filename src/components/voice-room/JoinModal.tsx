import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mic, Headphones, Lock } from "lucide-react";

interface JoinModalProps {
  roomName: string;
  hasPassword: boolean;
  isStageMode: boolean;
  t: (key: string) => string;
  onJoin: (mode: "speaker" | "listener", password?: string) => void;
}

export function JoinModal({ roomName, hasPassword, isStageMode, t, onJoin }: JoinModalProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pendingMode, setPendingMode] = useState<"speaker" | "listener" | null>(null);

  const handleJoin = (mode: "speaker" | "listener") => {
    if (hasPassword && !password.trim()) {
      setError(t("vroom.passwordRequired"));
      return;
    }
    setError("");
    onJoin(mode, hasPassword ? password : undefined);
  };

  const handleSubmit = () => {
    if (pendingMode) {
      handleJoin(pendingMode);
    } else {
      handleJoin("speaker");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm rounded-2xl border bg-card p-6 shadow-2xl space-y-5">
        <div className="text-center space-y-1">
          <h2 className="text-xl font-bold">{roomName}</h2>
          <p className="text-sm text-muted-foreground">{t("vroom.joinPrompt")}</p>
        </div>

        {hasPassword && (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <Lock className="h-4 w-4 text-muted-foreground" />
              {t("vroom.roomPassword")}
            </label>
            <Input
              type="password"
              placeholder={t("vroom.enterPassword")}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
              autoFocus
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )}

        {isStageMode ? (
          <div className="flex flex-col gap-3">
            <Button
              className="w-full gap-2"
              onClick={() => { setPendingMode("speaker"); handleJoin("speaker"); }}
            >
              <Mic className="h-4 w-4" />
              {t("vroom.joinAsSpeaker")}
            </Button>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => { setPendingMode("listener"); handleJoin("listener"); }}
            >
              <Headphones className="h-4 w-4" />
              {t("vroom.joinAsListener")}
            </Button>
          </div>
        ) : (
          <Button className="w-full" onClick={() => handleJoin("speaker")}>
            {t("vroom.joinRoom")}
          </Button>
        )}
      </div>
    </div>
  );
}
