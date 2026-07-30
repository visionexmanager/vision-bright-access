import { useRef, useState } from "react";
import { Play, Trash2, Undo2, Save } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useSaveProject } from "@/features/visionkids/hooks/stem/useStemProjects";
import { ROBOT_COMMANDS, ROBOT_COMMAND_META, type RobotCommand } from "@/features/visionkids/data/stemConfig";
import { StemHeader } from "@/features/visionkids/components/stem/StemHeader";
import { StemRewardBanner } from "@/features/visionkids/components/stem/StemRewardBanner";

const GRID = 5;
const START = { x: 0, y: 4, dir: "E" as const };
const GOAL = { x: 4, y: 0 };

type Dir = "N" | "E" | "S" | "W";
const DELTAS: Record<Dir, { dx: number; dy: number }> = {
  N: { dx: 0, dy: -1 }, E: { dx: 1, dy: 0 }, S: { dx: 0, dy: 1 }, W: { dx: -1, dy: 0 },
};
const LEFT: Record<Dir, Dir> = { N: "W", W: "S", S: "E", E: "N" };
const RIGHT: Record<Dir, Dir> = { N: "E", E: "S", S: "W", W: "N" };
const DIR_ROTATION: Record<Dir, number> = { N: -90, E: 0, S: 90, W: 180 };

export default function RoboticsWorkshop() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const saveProject = useSaveProject();

  const [program, setProgram] = useState<RobotCommand[]>([]);
  const [robot, setRobot] = useState<{ x: number; y: number; dir: Dir }>({ ...START });
  const [running, setRunning] = useState(false);
  const [collected, setCollected] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [reward, setReward] = useState(false);
  const [title, setTitle] = useState("");
  const [saved, setSaved] = useState(false);
  const timers = useRef<number[]>([]);

  useDocumentHead({
    title: `${t("kids.stem.lab.robotics.title")} — VisionKids`,
    description: t("kids.stem.lab.robotics.subtitle"),
    canonicalPath: "/kids/stem/robotics",
  });

  function reset() {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
    setRobot({ ...START });
    setCollected(false);
    setMessage(null);
    setRunning(false);
  }

  function run() {
    reset();
    setRunning(true);
    let state: { x: number; y: number; dir: Dir } = { ...START };
    let gotGem = false;

    program.forEach((cmd, i) => {
      const id = window.setTimeout(() => {
        if (cmd === "left") state = { ...state, dir: LEFT[state.dir] };
        else if (cmd === "right") state = { ...state, dir: RIGHT[state.dir] };
        else if (cmd === "forward") {
          const { dx, dy } = DELTAS[state.dir];
          const nx = Math.max(0, Math.min(GRID - 1, state.x + dx));
          const ny = Math.max(0, Math.min(GRID - 1, state.y + dy));
          state = { ...state, x: nx, y: ny };
        } else if (cmd === "sense") {
          const { dx, dy } = DELTAS[state.dir];
          const ahead = state.x + dx === GOAL.x && state.y + dy === GOAL.y;
          setMessage(ahead ? t("kids.stem.robotics.senseGem") : t("kids.stem.robotics.senseClear"));
        } else if (cmd === "pickup") {
          if (state.x === GOAL.x && state.y === GOAL.y) gotGem = true;
        }
        setRobot({ ...state });

        if (i === program.length - 1) {
          const success = gotGem && state.x === GOAL.x && state.y === GOAL.y;
          setCollected(success);
          setRunning(false);
          setMessage(success ? t("kids.stem.robotics.success") : t("kids.stem.robotics.tryAgain"));
        }
      }, (i + 1) * 550);
      timers.current.push(id);
    });

    if (program.length === 0) setRunning(false);
  }

  async function save() {
    if (!user || !collected || !title.trim()) return;
    try {
      await saveProject.mutateAsync({
        kind: "robot",
        title: title.trim(),
        lab: "robotics",
        emoji: "🤖",
        data: { program, grid: GRID, start: START, goal: GOAL },
        isPublic: true,
      });
      setSaved(true);
      setReward(true);
      setTimeout(() => setReward(false), 3500);
    } catch { /* ignore */ }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <StemHeader emoji="🤖" title={t("kids.stem.lab.robotics.title")} subtitle={t("kids.stem.lab.robotics.subtitle")} />
      <StemRewardBanner show={reward} message={t("kids.stem.robotics.savedMsg")} xp={30} coins={15} />

      <p className="mt-4 text-sm text-muted-foreground">{t("kids.stem.robotics.goal")}</p>

      {/* Grid */}
      <div className="mt-4 grid w-full max-w-xs gap-1" style={{ gridTemplateColumns: `repeat(${GRID}, minmax(0, 1fr))` }} role="img" aria-label={t("kids.stem.robotics.gridLabel")}>
        {Array.from({ length: GRID * GRID }).map((_, idx) => {
          const x = idx % GRID;
          const y = Math.floor(idx / GRID);
          const isRobot = robot.x === x && robot.y === y;
          const isGoal = GOAL.x === x && GOAL.y === y;
          return (
            <div key={idx} className="relative aspect-square rounded-md border-2 border-border bg-card">
              {isGoal && !collected && <span className="absolute inset-0 grid place-items-center text-xl" aria-hidden="true">💎</span>}
              {isRobot && (
                <span className="absolute inset-0 grid place-items-center text-2xl transition-transform"
                  style={{ transform: `rotate(${DIR_ROTATION[robot.dir]}deg)` }} aria-hidden="true">🤖</span>
              )}
            </div>
          );
        })}
      </div>

      {message && <p className="mt-3 text-sm font-semibold" role="status">{message}</p>}

      {/* Command palette */}
      <div className="mt-5">
        <p className="text-sm font-semibold">{t("kids.stem.robotics.addCommand")}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {ROBOT_COMMANDS.map((cmd) => (
            <button key={cmd} type="button" disabled={running}
              onClick={() => setProgram((p) => [...p, cmd])}
              className="rounded-full border-2 border-border px-3 py-1.5 text-sm font-semibold hover:border-kids-primary/50 disabled:opacity-50">
              <span aria-hidden="true">{ROBOT_COMMAND_META[cmd].emoji}</span> {t(ROBOT_COMMAND_META[cmd].labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Program */}
      <div className="mt-4 min-h-[3rem] rounded-2xl border-2 border-dashed border-border p-3">
        {program.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("kids.stem.robotics.emptyProgram")}</p>
        ) : (
          <ol className="flex flex-wrap gap-1.5">
            {program.map((cmd, i) => (
              <li key={i} className="rounded-md bg-kids-primary/10 px-2 py-1 text-sm font-semibold text-kids-primary">
                {i + 1}. <span aria-hidden="true">{ROBOT_COMMAND_META[cmd].emoji}</span> {t(ROBOT_COMMAND_META[cmd].labelKey)}
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={run} disabled={running || program.length === 0}
          className="inline-flex items-center gap-1.5 rounded-full bg-kids-primary px-5 py-2 font-bold text-white hover:opacity-90 disabled:opacity-50">
          <Play className="h-4 w-4" aria-hidden="true" /> {t("kids.stem.robotics.run")}
        </button>
        <button type="button" onClick={() => setProgram((p) => p.slice(0, -1))} disabled={running || program.length === 0}
          className="inline-flex items-center gap-1.5 rounded-full border-2 border-border px-4 py-2 font-semibold hover:border-kids-primary/50 disabled:opacity-50">
          <Undo2 className="h-4 w-4" aria-hidden="true" /> {t("kids.stem.robotics.undo")}
        </button>
        <button type="button" onClick={() => { setProgram([]); reset(); }} disabled={running}
          className="inline-flex items-center gap-1.5 rounded-full border-2 border-border px-4 py-2 font-semibold hover:border-kids-pink/50 disabled:opacity-50">
          <Trash2 className="h-4 w-4" aria-hidden="true" /> {t("kids.stem.robotics.clear")}
        </button>
      </div>

      {/* Save on success */}
      {collected && !saved && (
        <div className="mt-6 rounded-2xl border-2 border-kids-green/40 bg-kids-green/5 p-4">
          <p className="font-heading font-bold text-kids-green">🎉 {t("kids.stem.robotics.success")}</p>
          {user ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80}
                placeholder={t("kids.stem.robotics.namePlaceholder")}
                className="min-w-0 flex-1 rounded-xl border-2 border-border bg-background px-3 py-2" />
              <button type="button" onClick={save} disabled={!title.trim() || saveProject.isPending}
                className="inline-flex items-center gap-1.5 rounded-full bg-kids-primary px-5 py-2 font-bold text-white hover:opacity-90 disabled:opacity-50">
                <Save className="h-4 w-4" aria-hidden="true" /> {t("kids.stem.robotics.save")}
              </button>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">{t("kids.stem.signInHint")}</p>
          )}
        </div>
      )}
      {saved && <p className="mt-4 text-sm font-semibold text-kids-green">✅ {t("kids.stem.robotics.savedToGallery")}</p>}
    </div>
  );
}
