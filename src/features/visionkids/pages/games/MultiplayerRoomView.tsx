import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Crown, LogOut, CheckCircle2, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";
import { fadeIn } from "@/features/visionkids/utils/animations";
import {
  useMultiplayerRoom, useJoinRoom, useLeaveRoom, useSetReady, useSetRoomStatus, useUpdateRoomScore, useEmojiReactions,
} from "@/features/visionkids/hooks/games/useMultiplayerRoom";
import { useAwardAchievement } from "@/features/visionkids/hooks/games/useGameEngagement";
import { FLAGS, type FlagEntry } from "@/features/visionkids/games/flag-quiz/flags.data";

const REACTION_EMOJIS = ["🎉", "😂", "👏", "❤️", "😮"];
const BATTLE_ROUNDS = 5;

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

interface BattleRound {
  entry: FlagEntry;
  options: string[];
}

function buildBattleRounds(): BattleRound[] {
  const pool = shuffle(FLAGS);
  return pool.slice(0, BATTLE_ROUNDS).map((entry) => {
    const distractors = shuffle(pool.filter((f) => f.name !== entry.name)).slice(0, 2);
    return { entry, options: shuffle([entry.name, ...distractors.map((d) => d.name)]) };
  });
}

export default function MultiplayerRoomView() {
  const { roomId } = useParams<{ roomId: string }>();
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const reduced = useKidsReducedMotion();

  const { room, players, refresh } = useMultiplayerRoom(roomId);
  const joinRoom = useJoinRoom();
  const leaveRoom = useLeaveRoom();
  const setReady = useSetReady();
  const setStatus = useSetRoomStatus();
  const updateScore = useUpdateRoomScore();
  const awardAchievement = useAwardAchievement();
  const { reactions, sendReaction } = useEmojiReactions(roomId);

  const [rounds] = useState(buildBattleRounds);
  const [roundIndex, setRoundIndex] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [myScore, setMyScore] = useState(0);

  useDocumentHead({ title: room?.room_name ?? t("kids.games.multiplayerLobby"), description: "", canonicalPath: `/kids/games/multiplayer/${roomId}` });

  const me = players.find((p) => p.user_id === user?.id);
  const isHost = room?.host_id === user?.id;
  const allReady = players.length > 1 && players.every((p) => p.is_ready);

  if (!room) return <div className="mx-auto max-w-2xl px-4 py-16" aria-busy="true"><div className="h-64 animate-pulse rounded-2xl bg-muted" /></div>;

  if (!me && user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-lg font-semibold">{room.room_name}</p>
        <Button className="mt-4 bg-kids-purple text-white hover:bg-kids-purple/90" onClick={async () => { await joinRoom.mutateAsync(room.id); refresh(); }}>
          {t("kids.games.join")}
        </Button>
      </div>
    );
  }

  const round = rounds[roundIndex];

  const answer = async (name: string) => {
    if (answered) return;
    setAnswered(true);
    const correct = name === round.entry.name;
    const newScore = myScore + (correct ? 10 : 0);
    if (correct) {
      setMyScore(newScore);
      await updateScore.mutateAsync({ roomId: room.id, score: newScore });
    }
    window.setTimeout(() => {
      if (roundIndex >= BATTLE_ROUNDS - 1) {
        setStatus.mutate({ roomId: room.id, status: "finished" });
        const iWon = players.every((p) => p.user_id === user?.id || p.score <= newScore);
        if (iWon && newScore > 0) awardAchievement.mutate("quiz_battle_win");
      } else {
        setRoundIndex((i) => i + 1);
        setAnswered(false);
      }
    }, 900);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-extrabold">{room.room_name}</h1>
        <Button variant="ghost" size="icon" onClick={async () => { await leaveRoom.mutateAsync(room.id); navigate("/kids/games/multiplayer"); }} aria-label={t("kids.games.leaveRoom")}>
          <LogOut className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      <button
        type="button"
        onClick={() => navigator.clipboard?.writeText(room.code)}
        className="mt-1 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        {t("kids.games.roomCode")}: <span className="font-mono font-bold">{room.code}</span> <Copy className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      <div className="relative mt-6">
        <div className="flex flex-wrap gap-2">
          {players.map((p) => (
            <div key={p.user_id} className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 ${p.user_id === user?.id ? "border-kids-primary bg-kids-primary/5" : "border-border"}`}>
              {p.user_id === room.host_id && <Crown className="h-4 w-4 text-kids-accent" aria-hidden="true" />}
              <span className="text-sm font-semibold">{p.user_id === user?.id ? t("kids.games.you") : t("kids.games.player")}</span>
              {room.status === "waiting" ? (
                p.is_ready && <CheckCircle2 className="h-4 w-4 text-kids-green" aria-hidden="true" />
              ) : (
                <span className="font-bold text-kids-primary">{p.score}</span>
              )}
            </div>
          ))}
        </div>

        <AnimatePresence>
          {reactions.map((r) => (
            <motion.span key={r.id} initial={{ opacity: 0, y: 0 }} animate={{ opacity: 1, y: -30 }} exit={{ opacity: 0 }} className="pointer-events-none absolute end-4 top-0 text-2xl">
              {r.emoji}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>

      {room.status === "waiting" && (
        <div className="mt-8 flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-border p-8 text-center">
          <Swords className="h-10 w-10 text-kids-purple" aria-hidden="true" />
          <p className="text-muted-foreground">{t("kids.games.waitingForPlayers")}</p>
          <Button onClick={() => setReady.mutate({ roomId: room.id, isReady: !me?.is_ready })} variant="outline">
            {me?.is_ready ? t("kids.games.notReady") : t("kids.games.readyUp")}
          </Button>
          {isHost && (
            <Button disabled={!allReady} onClick={() => setStatus.mutate({ roomId: room.id, status: "in_progress" })} className="bg-kids-purple text-white hover:bg-kids-purple/90">
              {t("kids.games.startBattle")}
            </Button>
          )}
        </div>
      )}

      {room.status === "in_progress" && round && (
        <div className="mt-8 rounded-2xl border-2 border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">{t("kids.games.round")} {roundIndex + 1}/{BATTLE_ROUNDS}</p>
          <motion.p key={roundIndex} initial="hidden" animate="visible" variants={fadeIn(reduced)} className="mt-2 text-6xl">{round.entry.flag}</motion.p>
          <div className="mt-6 grid gap-2">
            {round.options.map((option) => (
              <button
                key={option}
                type="button"
                disabled={answered}
                onClick={() => answer(option)}
                className="rounded-xl border-2 border-border px-4 py-2.5 font-semibold hover:bg-muted disabled:opacity-60"
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      )}

      {room.status === "finished" && (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border-2 border-kids-accent/40 bg-kids-accent/10 p-8 text-center">
          <p className="font-heading text-xl font-extrabold">{t("kids.games.battleOver")}</p>
          <p className="text-lg font-semibold text-kids-primary">{t("kids.games.score")}: {myScore}</p>
          <Button asChild className="bg-kids-primary text-white hover:bg-kids-primary/90"><Link to="/kids/games/multiplayer">{t("kids.games.backToLobby")}</Link></Button>
        </div>
      )}

      <div className="mt-6 flex justify-center gap-2">
        {REACTION_EMOJIS.map((emoji) => (
          <button key={emoji} type="button" onClick={() => user && sendReaction(emoji, user.id)} className="rounded-full border border-border p-1.5 text-lg hover:bg-muted" aria-label={emoji}>
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
