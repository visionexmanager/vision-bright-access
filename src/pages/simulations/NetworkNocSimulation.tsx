import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useEarnPoints } from "@/hooks/useEarnPoints";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { SimulationMentor } from "@/components/SimulationMentor";
import {
  ArrowLeft,
  Wifi,
  WifiOff,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Server,
  Shield,
  Gauge,
  RotateCcw,
  Trophy,
  ArrowRight,
  Terminal,
} from "lucide-react";

/* ─── Types ─── */
type DiagnosticAction = {
  label: string;
  icon: React.ReactNode;
  effect: (s: CaseState) => CaseState;
  feedback: string;
};

type CaseStep = {
  title: string;
  description: string;
  metrics: { label: string; value: string; status: "ok" | "warn" | "critical" }[];
  actions: DiagnosticAction[];
};

type CaseState = {
  step: number;
  jitter: number;
  packetLoss: number;
  latency: number;
  bandwidth: number;
  resolved: boolean;
  score: number;
  log: string[];
};

/* ─── Case: Home VoIP Troubleshooting ─── */
function buildHomeCase(t: (k: string) => string): CaseStep[] {
  return [
    {
      title: t("sim.noc.case1.step1.title"),
      description: t("sim.noc.case1.step1.desc"),
      metrics: [
        { label: "Jitter", value: "45ms", status: "critical" },
        { label: "Packet Loss", value: "8%", status: "critical" },
        { label: "Latency", value: "120ms", status: "warn" },
        { label: "Bandwidth", value: "15 Mbps", status: "ok" },
      ],
      actions: [
        {
          label: t("sim.noc.action.pingGateway"),
          icon: <Terminal className="h-4 w-4" />,
          effect: (s) => ({ ...s, score: s.score + 5, log: [`> ping 192.168.1.1 — ${t("sim.noc.response.highLatency")}`, ...s.log] }),
          feedback: t("sim.noc.feedback.pingHigh"),
        },
        {
          label: t("sim.noc.action.checkQos"),
          icon: <Gauge className="h-4 w-4" />,
          effect: (s) => ({ ...s, score: s.score + 10, log: [`> ${t("sim.noc.response.qosDisabled")}`, ...s.log] }),
          feedback: t("sim.noc.feedback.qosOff"),
        },
        {
          label: t("sim.noc.action.traceroute"),
          icon: <Activity className="h-4 w-4" />,
          effect: (s) => ({ ...s, score: s.score + 5, log: [`> traceroute — 4 hops, ${t("sim.noc.response.hop3Slow")}`, ...s.log] }),
          feedback: t("sim.noc.feedback.hop3"),
        },
      ],
    },
    {
      title: t("sim.noc.case1.step2.title"),
      description: t("sim.noc.case1.step2.desc"),
      metrics: [
        { label: "Jitter", value: "45ms", status: "critical" },
        { label: "QoS", value: "Disabled", status: "critical" },
        { label: "Connected Devices", value: "12", status: "warn" },
        { label: "VoIP Priority", value: "None", status: "critical" },
      ],
      actions: [
        {
          label: t("sim.noc.action.enableQos"),
          icon: <Shield className="h-4 w-4" />,
          effect: (s) => ({ ...s, jitter: 12, score: s.score + 15, log: [`> ${t("sim.noc.response.qosEnabled")}`, ...s.log] }),
          feedback: t("sim.noc.feedback.qosOn"),
        },
        {
          label: t("sim.noc.action.prioritizeVoip"),
          icon: <Wifi className="h-4 w-4" />,
          effect: (s) => ({ ...s, packetLoss: 0.5, score: s.score + 15, log: [`> ${t("sim.noc.response.voipPriority")}`, ...s.log] }),
          feedback: t("sim.noc.feedback.voipSet"),
        },
        {
          label: t("sim.noc.action.limitDevices"),
          icon: <Server className="h-4 w-4" />,
          effect: (s) => ({ ...s, latency: 35, score: s.score + 10, log: [`> ${t("sim.noc.response.devicesLimited")}`, ...s.log] }),
          feedback: t("sim.noc.feedback.devLimit"),
        },
      ],
    },
    {
      title: t("sim.noc.case1.step3.title"),
      description: t("sim.noc.case1.step3.desc"),
      metrics: [
        { label: "Jitter", value: "12ms", status: "ok" },
        { label: "Packet Loss", value: "0.5%", status: "ok" },
        { label: "Latency", value: "35ms", status: "ok" },
        { label: "VoIP Quality", value: "MOS 4.2", status: "ok" },
      ],
      actions: [
        {
          label: t("sim.noc.action.runTest"),
          icon: <Activity className="h-4 w-4" />,
          effect: (s) => ({ ...s, resolved: true, score: s.score + 20, log: [`✅ ${t("sim.noc.response.testPass")}`, ...s.log] }),
          feedback: t("sim.noc.feedback.resolved"),
        },
      ],
    },
  ];
}

export function NetworkNocSimulation({ simulationId }: { simulationId?: string }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { earnPoints } = useEarnPoints();

  const cases = buildHomeCase(t);

  const [state, setState] = useState<CaseState>({
    step: 0,
    jitter: 45,
    packetLoss: 8,
    latency: 120,
    bandwidth: 15,
    resolved: false,
    score: 0,
    log: [`[NOC] ${t("sim.noc.caseOpened")}`],
  });

  const [actionsDone, setActionsDone] = useState<Set<number>>(new Set());
  const [feedback, setFeedback] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  const currentStep = cases[state.step];
  const progressPct = ((state.step + 1) / cases.length) * 100;

  const handleAction = (action: DiagnosticAction, idx: number) => {
    if (actionsDone.has(idx)) return;
    setActionsDone((prev) => new Set(prev).add(idx));
    setState((s) => action.effect(s));
    setFeedback(action.feedback);
  };

  const nextStep = () => {
    setFeedback(null);
    setActionsDone(new Set());
    if (state.step < cases.length - 1) {
      setState((s) => ({ ...s, step: s.step + 1 }));
    }
  };

  const handleComplete = useCallback(async () => {
    if (completed) return;
    setCompleted(true);
    const points = Math.round(state.score * 0.8);
    if (user) {
      await earnPoints(points, "Network NOC: VoIP troubleshooting");
      if (simulationId) {
        await supabase.from("simulation_progress").upsert(
          {
            user_id: user.id,
            simulation_id: simulationId,
            current_step: cases.length,
            decisions: state.log as any,
            completed: true,
            score: state.score,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,simulation_id" }
        );
      }
    }
    toast({ title: t("bsim.completed"), description: `+${points} pts` });
  }, [completed, state.score, state.log, user, simulationId, earnPoints, t, cases.length]);

  // Auto-complete when resolved
  if (state.resolved && !completed) {
    handleComplete();
  }

  const resetSim = () => {
    setState({
      step: 0,
      jitter: 45,
      packetLoss: 8,
      latency: 120,
      bandwidth: 15,
      resolved: false,
      score: 0,
      log: [`[NOC] ${t("sim.noc.caseOpened")}`],
    });
    setActionsDone(new Set());
    setFeedback(null);
    setCompleted(false);
  };

  const statusColor = {
    ok: "text-green-400 bg-green-500/10",
    warn: "text-yellow-400 bg-yellow-500/10",
    critical: "text-red-400 bg-red-500/10",
  };

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" className="mb-2">
        <Link to="/business-simulator">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("bsim.backToList")}
        </Link>
      </Button>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-mono flex items-center gap-2">
            <Wifi className="h-5 w-5 text-primary" />
            {t("sim.noc.title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("sim.noc.subtitle")}</p>
        </div>
        <Badge variant="secondary">
          {t("sim.noc.score")}: {state.score}
        </Badge>
      </div>

      <Progress value={progressPct} className="h-2" />

      {state.resolved ? (
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <Trophy className="h-16 w-16 text-primary mx-auto" />
            <h2 className="text-2xl font-bold">{t("sim.noc.caseResolved")}</h2>
            <p className="text-muted-foreground">{t("sim.noc.resolvedDesc")}</p>
            <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto">
              <div className="rounded-xl bg-primary/10 p-4">
                <p className="text-2xl font-bold text-primary">{state.score}</p>
                <p className="text-xs text-muted-foreground">{t("sim.noc.score")}</p>
              </div>
              <div className="rounded-xl bg-green-500/10 p-4">
                <p className="text-2xl font-bold text-green-500">{state.log.length}</p>
                <p className="text-xs text-muted-foreground">{t("sim.noc.actions")}</p>
              </div>
            </div>
            <Button onClick={resetSim} variant="outline" className="gap-2">
              <RotateCcw className="h-4 w-4" />
              {t("bsim.playAgain")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Metrics Panel */}
          <Card className="border-2">
            <CardContent className="p-6 space-y-4">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                {currentStep.title}
              </h2>
              <p className="text-sm text-muted-foreground">{currentStep.description}</p>

              <div className="grid grid-cols-2 gap-3">
                {currentStep.metrics.map((m, i) => (
                  <div
                    key={i}
                    className={`rounded-lg p-3 text-center ${statusColor[m.status]}`}
                  >
                    <p className="text-xs font-medium opacity-70">{m.label}</p>
                    <p className="text-lg font-bold font-mono">{m.value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Actions Panel */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-6 space-y-3">
                <h2 className="font-bold text-lg">{t("sim.noc.diagnostics")}</h2>

                {feedback && (
                  <div className="rounded-lg bg-muted p-4 border-l-4 border-primary mb-3">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                      <p className="text-sm">{feedback}</p>
                    </div>
                    {actionsDone.size >= currentStep.actions.length && state.step < cases.length - 1 && (
                      <Button onClick={nextStep} className="mt-3" size="sm">
                        {t("bsim.next")}
                        <ArrowRight className="ml-1 h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}

                <div className="grid gap-2">
                  {currentStep.actions.map((action, i) => (
                    <Button
                      key={i}
                      variant={actionsDone.has(i) ? "secondary" : "outline"}
                      className="justify-start text-left h-auto py-3 px-4 gap-2"
                      onClick={() => handleAction(action, i)}
                      disabled={actionsDone.has(i)}
                    >
                      {action.icon}
                      {action.label}
                      {actionsDone.has(i) && (
                        <CheckCircle2 className="h-4 w-4 text-primary ml-auto" />
                      )}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Terminal Log */}
      <Card className="bg-black/50 border-primary/20">
        <CardContent className="p-4">
          <h3 className="font-mono font-semibold text-sm mb-2 text-primary flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            {t("sim.noc.terminal")}
          </h3>
          <div className="max-h-32 overflow-y-auto space-y-1 font-mono text-xs text-green-400/80">
            {state.log.map((entry, i) => (
              <p key={i}>{entry}</p>
            ))}
          </div>
        </CardContent>
      </Card>

      <SimulationMentor
        simulationTitle={t("sim.noc.title")}
        currentStepTitle={currentStep?.title || ""}
      />
    </div>
  );
}
