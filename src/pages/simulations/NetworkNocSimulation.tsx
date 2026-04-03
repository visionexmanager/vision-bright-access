import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useEarnPoints } from "@/hooks/useEarnPoints";
import { supabase } from "@/integrations/supabase/client";
import { useSimulationProgress } from "@/hooks/useSimulationProgress";
import { toast } from "@/hooks/use-toast";
import { SimulationMentor } from "@/components/SimulationMentor";
import {
  Wifi, AlertTriangle, CheckCircle2, Activity, Server, Shield, Gauge,
  RotateCcw, Trophy, Terminal, DollarSign, Users, Zap,
} from "lucide-react";
import { FinancialBar, PerformanceRadar } from "@/components/SimulationCharts";

type Stage = "setup" | "monitoring" | "incident" | "results";

type IncidentType = { name: string; severity: "low" | "medium" | "high" | "critical"; affectedUsers: number; description: string };

const INCIDENTS: IncidentType[] = [
  { name: "DNS Resolution Failure", severity: "high", affectedUsers: 500, description: "Users can't resolve domain names. Internal DNS server not responding." },
  { name: "Bandwidth Saturation", severity: "medium", affectedUsers: 200, description: "Network link at 98% capacity. Packet drops increasing." },
  { name: "Firewall Rule Conflict", severity: "critical", affectedUsers: 1000, description: "New firewall rules blocking legitimate traffic to production servers." },
  { name: "Switch Loop Detected", severity: "high", affectedUsers: 350, description: "Broadcast storm detected on VLAN 10. STP not converging." },
  { name: "VoIP Quality Degradation", severity: "medium", affectedUsers: 150, description: "Jitter exceeding 45ms on VoIP traffic. QoS not configured." },
];

export function NetworkNocSimulation({ simulationId }: { simulationId?: string }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { earnPoints } = useEarnPoints();
  const { savedProgress } = useSimulationProgress(simulationId);

  const [stage, setStage] = useState<Stage>("setup");
  const [score, setScore] = useState(0);

  // Setup
  const [teamSize, setTeamSize] = useState(3);
  const [monitoringLevel, setMonitoringLevel] = useState<"basic" | "advanced" | "enterprise">("advanced");
  const [redundancy, setRedundancy] = useState<"none" | "active-passive" | "active-active">("active-passive");
  const [budget, setBudget] = useState(5000);

  // Monitoring
  const [uptime, setUptime] = useState(99.9);
  const [activeIncidents, setActiveIncidents] = useState<(IncidentType & { resolved: boolean; response?: string })[]>([]);
  const [incidentIndex, setIncidentIndex] = useState(0);
  const [totalResolved, setTotalResolved] = useState(0);
  const [totalMissed, setTotalMissed] = useState(0);
  const [mttr, setMttr] = useState(0); // mean time to resolve
  const [log, setLog] = useState<string[]>([]);
  const [currentIncident, setCurrentIncident] = useState<IncidentType | null>(null);
  const [responseChoices, setResponseChoices] = useState<{ label: string; score: number; effect: string }[]>([]);

  useEffect(() => {
    if (!savedProgress) return;
    setScore(savedProgress.score ?? 0);
    if (savedProgress.completed) setStage("results");
  }, [savedProgress]);

  const monitoringCost = monitoringLevel === "basic" ? 500 : monitoringLevel === "advanced" ? 1500 : 3000;
  const redundancyCost = redundancy === "none" ? 0 : redundancy === "active-passive" ? 1000 : 2500;
  const teamCost = teamSize * 800;
  const totalCost = monitoringCost + redundancyCost + teamCost;

  const detectionSpeed = monitoringLevel === "basic" ? 0.6 : monitoringLevel === "advanced" ? 0.85 : 0.98;

  const startMonitoring = () => {
    playSound();
    setStage("monitoring");
    setLog([`[${new Date().toLocaleTimeString()}] NOC operational. Team of ${teamSize} engineers on duty.`]);
    triggerIncident(0);
  };

  const playSound = () => {}; // placeholder

  const triggerIncident = (idx: number) => {
    if (idx >= INCIDENTS.length) {
      finishSim();
      return;
    }

    const incident = INCIDENTS[idx];
    const detected = Math.random() < detectionSpeed;

    if (!detected) {
      setLog(prev => [`⚠️ [MISSED] ${incident.name} — Not detected by monitoring`, ...prev]);
      setTotalMissed(prev => prev + 1);
      setUptime(prev => Math.max(95, prev - 0.3));
      setIncidentIndex(idx + 1);
      setTimeout(() => triggerIncident(idx + 1), 500);
      return;
    }

    setCurrentIncident(incident);
    setStage("incident");
    setLog(prev => [`🚨 [ALERT] ${incident.name} — ${incident.severity.toUpperCase()} — ${incident.affectedUsers} users affected`, ...prev]);

    // Generate response choices based on incident
    const choices = generateChoices(incident);
    setResponseChoices(choices);
  };

  const generateChoices = (incident: IncidentType) => {
    if (incident.name.includes("DNS")) {
      return [
        { label: "Restart DNS service & flush cache", score: 15, effect: "DNS service restored. Cache cleared. Resolution time: 5 min." },
        { label: "Switch to backup DNS server", score: 20, effect: "Traffic rerouted to backup DNS. Immediate restoration. MTTR: 2 min." },
        { label: "Reboot the entire server", score: 5, effect: "Full reboot takes 15 minutes. Other services disrupted temporarily." },
      ];
    }
    if (incident.name.includes("Bandwidth")) {
      return [
        { label: "Implement traffic shaping & QoS", score: 20, effect: "Traffic prioritized. Critical apps restored. Bandwidth optimized." },
        { label: "Identify & throttle top consumers", score: 15, effect: "Top 3 bandwidth consumers throttled. Partial relief." },
        { label: "Upgrade link capacity", score: 10, effect: "Capacity upgrade initiated. Takes effect next billing cycle. Expensive." },
      ];
    }
    if (incident.name.includes("Firewall")) {
      return [
        { label: "Rollback to previous firewall rules", score: 20, effect: "Previous rules restored. All traffic flowing normally. Quick fix." },
        { label: "Emergency disable new rules", score: 15, effect: "New rules disabled but security gap created. Needs review." },
        { label: "Manually fix conflicting rules", score: 10, effect: "Manual fix attempted. Takes 30 minutes. Some traffic still affected." },
      ];
    }
    if (incident.name.includes("Switch")) {
      return [
        { label: "Enable STP & shut affected ports", score: 20, effect: "STP enabled. Loop broken. Broadcast storm stopped. MTTR: 3 min." },
        { label: "Physically disconnect redundant link", score: 15, effect: "Loop broken manually. STP still needs configuration." },
        { label: "Restart all switches in VLAN 10", score: 5, effect: "All switches restarted. 10 minutes downtime for VLAN 10." },
      ];
    }
    return [
      { label: "Configure QoS for VoIP priority", score: 20, effect: "VoIP traffic prioritized. Jitter reduced to 12ms. Calls clear." },
      { label: "Increase bandwidth allocation", score: 15, effect: "More bandwidth allocated. Partial improvement." },
      { label: "Suggest users use wired connections", score: 5, effect: "Some users switch. Minimal improvement for most." },
    ];
  };

  const handleResponse = (choice: { label: string; score: number; effect: string }) => {
    setScore(prev => prev + choice.score);
    setTotalResolved(prev => prev + 1);
    setUptime(prev => Math.min(99.99, prev + 0.1));
    setMttr(prev => Math.round((prev * (totalResolved) + (choice.score >= 15 ? 5 : 15)) / (totalResolved + 1)));
    setLog(prev => [`✅ [RESOLVED] ${currentIncident?.name} — ${choice.effect}`, ...prev]);

    const nextIdx = incidentIndex + 1;
    setIncidentIndex(nextIdx);
    setCurrentIncident(null);
    setStage("monitoring");

    toast({ title: "Incident Resolved!", description: `+${choice.score} pts — ${choice.effect}` });

    setTimeout(() => triggerIncident(nextIdx), 1000);
  };

  const finishSim = async () => {
    const uptimeBonus = uptime >= 99.5 ? 20 : uptime >= 99 ? 10 : 0;
    const resolvedBonus = totalResolved * 5;
    const budgetBonus = totalCost <= budget ? 10 : 0;
    const finalScore = score + uptimeBonus + budgetBonus;

    setScore(finalScore);
    setStage("results");

    const points = Math.round(finalScore * 0.8);
    if (user) {
      await earnPoints(points, "Network NOC: Operations Management");
      if (simulationId) {
        const { data: existing } = await supabase
          .from("simulation_progress")
          .select("id")
          .eq("user_id", user.id)
          .eq("simulation_id", simulationId)
          .maybeSingle();

        const payload = {
          current_step: INCIDENTS.length,
          decisions: { teamSize, monitoringLevel, redundancy, budget } as any,
          completed: true,
          score: finalScore,
        };

        if (existing) {
          await supabase.from("simulation_progress").update(payload).eq("id", existing.id);
        } else {
          await supabase.from("simulation_progress").insert([{ user_id: user.id, simulation_id: simulationId, ...payload }]);
        }
      }
    }
  };

  const reset = () => {
    setStage("setup");
    setScore(0);
    setTeamSize(3);
    setMonitoringLevel("advanced");
    setRedundancy("active-passive");
    setBudget(5000);
    setUptime(99.9);
    setActiveIncidents([]);
    setIncidentIndex(0);
    setTotalResolved(0);
    setTotalMissed(0);
    setMttr(0);
    setLog([]);
    setCurrentIncident(null);
  };

  const severityColor = { low: "text-blue-400 bg-blue-500/10", medium: "text-yellow-400 bg-yellow-500/10", high: "text-orange-400 bg-orange-500/10", critical: "text-red-400 bg-red-500/10" };

  if (stage === "results") {
    return (
      <div className="space-y-6">
        <Card className="border-green-500/40 bg-green-500/10">
          <CardContent className="pt-6 text-center space-y-4">
            <Trophy className="h-12 w-12 mx-auto text-primary" />
            <h2 className="text-2xl font-bold">NOC Shift Complete!</h2>
            <p className="text-4xl font-bold text-primary">{score} pts</p>
            <div className="grid grid-cols-2 gap-3 text-sm max-w-md mx-auto">
              <div className="bg-background rounded-lg p-3"><p className="text-muted-foreground">Uptime</p><p className="text-lg font-bold">{uptime.toFixed(2)}%</p></div>
              <div className="bg-background rounded-lg p-3"><p className="text-muted-foreground">Resolved</p><p className="text-lg font-bold text-green-500">{totalResolved}</p></div>
              <div className="bg-background rounded-lg p-3"><p className="text-muted-foreground">Missed</p><p className="text-lg font-bold text-destructive">{totalMissed}</p></div>
              <div className="bg-background rounded-lg p-3"><p className="text-muted-foreground">Budget</p><p className={`text-lg font-bold ${totalCost <= budget ? "text-green-500" : "text-destructive"}`}>${totalCost}/${budget}</p></div>
            </div>
          </CardContent>
        </Card>
        <PerformanceRadar title="🖥️ NOC Performance" data={[
          { metric: "Uptime", value: Math.round(uptime) },
          { metric: "Resolution", value: Math.round((totalResolved / Math.max(1, totalResolved + totalMissed)) * 100) },
          { metric: "Response Time", value: Math.max(0, 100 - mttr * 5) },
          { metric: "Budget Mgmt", value: Math.min(100, Math.max(0, Math.round((1 - totalCost / Math.max(1, budget)) * 100))) },
        ]} />
        <FinancialBar title="📊 Budget Breakdown" data={[
          { label: "Budget", value: budget, color: "hsl(217 91% 60%)" },
          { label: "Spent", value: totalCost, color: totalCost <= budget ? "hsl(142 71% 45%)" : "hsl(0 84% 60%)" },
          { label: "Remaining", value: Math.max(0, budget - totalCost), color: "hsl(var(--primary))" },
        ]} />
        <Button onClick={reset} variant="outline" className="w-full gap-2"><RotateCcw className="h-4 w-4" /> Play Again</Button>
      </div>
    );
  }

  if (stage === "incident" && currentIncident) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2"><AlertTriangle className="h-6 w-6 text-destructive animate-pulse" /> Active Incident</h2>
          <Badge variant="secondary">Score: {score}</Badge>
        </div>

        <Card className={`border-2 ${severityColor[currentIncident.severity]}`}>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">{currentIncident.name}</h3>
              <Badge variant="destructive">{currentIncident.severity.toUpperCase()}</Badge>
            </div>
            <p className="text-muted-foreground">{currentIncident.description}</p>
            <div className="flex gap-4 text-sm">
              <span className="flex items-center gap-1"><Users className="h-4 w-4" /> {currentIncident.affectedUsers} users affected</span>
            </div>
          </CardContent>
        </Card>

        <h3 className="font-bold">Choose Response:</h3>
        <div className="space-y-3">
          {responseChoices.map((choice, i) => (
            <Button
              key={i}
              variant="outline"
              className="w-full h-auto py-4 text-left justify-start"
              onClick={() => handleResponse(choice)}
            >
              <div>
                <p className="font-medium">{choice.label}</p>
              </div>
            </Button>
          ))}
        </div>

        {/* Terminal */}
        <Card className="bg-black/50 border-primary/20">
          <CardContent className="p-4">
            <div className="max-h-24 overflow-y-auto space-y-1 font-mono text-xs text-green-400/80">
              {log.slice(0, 5).map((entry, i) => <p key={i}>{entry}</p>)}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (stage === "monitoring") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2"><Activity className="h-6 w-6 text-green-500 animate-pulse" /> NOC Monitoring</h2>
          <Badge variant="secondary">Score: {score}</Badge>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card><CardContent className="pt-4 text-center">
            <Gauge className="h-5 w-5 mx-auto text-green-500" />
            <p className="text-lg font-bold">{uptime.toFixed(2)}%</p>
            <p className="text-xs text-muted-foreground">Uptime</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 text-center">
            <CheckCircle2 className="h-5 w-5 mx-auto text-green-500" />
            <p className="text-lg font-bold">{totalResolved}</p>
            <p className="text-xs text-muted-foreground">Resolved</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 text-center">
            <AlertTriangle className="h-5 w-5 mx-auto text-destructive" />
            <p className="text-lg font-bold">{totalMissed}</p>
            <p className="text-xs text-muted-foreground">Missed</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 text-center">
            <Zap className="h-5 w-5 mx-auto text-amber-500" />
            <p className="text-lg font-bold">{incidentIndex}/{INCIDENTS.length}</p>
            <p className="text-xs text-muted-foreground">Progress</p>
          </CardContent></Card>
        </div>

        <Progress value={(incidentIndex / INCIDENTS.length) * 100} className="h-2" />

        <Card className="bg-black/50 border-primary/20">
          <CardContent className="p-4">
            <h3 className="font-mono text-sm mb-2 text-primary flex items-center gap-2"><Terminal className="h-4 w-4" /> Terminal</h3>
            <div className="max-h-32 overflow-y-auto space-y-1 font-mono text-xs text-green-400/80">
              {log.map((entry, i) => <p key={i}>{entry}</p>)}
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-muted-foreground text-sm animate-pulse">Monitoring for next incident...</p>

        <SimulationMentor simulationTitle="Network NOC" currentStepTitle={`Incident ${incidentIndex + 1}`} />
      </div>
    );
  }

  // Setup
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold flex items-center gap-2"><Wifi className="h-6 w-6 text-primary" /> Network Operations Center</h2>
      <p className="text-sm text-muted-foreground">Configure your NOC team and infrastructure. Handle {INCIDENTS.length} network incidents with the right resources and decisions.</p>

      <Card><CardContent className="pt-6 space-y-3">
        <div className="flex justify-between"><span className="font-medium">👥 Team Size</span><Badge variant="outline">{teamSize} engineers</Badge></div>
        <Slider value={[teamSize]} onValueChange={([v]) => setTeamSize(v)} min={1} max={6} step={1} />
        <p className="text-xs text-muted-foreground">More engineers = faster response but $800/person</p>
      </CardContent></Card>

      <Card><CardContent className="pt-6 space-y-3">
        <span className="font-medium">📡 Monitoring Level</span>
        <Select value={monitoringLevel} onValueChange={(v: any) => setMonitoringLevel(v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="basic">Basic ($500) — 60% detection rate</SelectItem>
            <SelectItem value="advanced">Advanced ($1,500) — 85% detection rate</SelectItem>
            <SelectItem value="enterprise">Enterprise ($3,000) — 98% detection rate</SelectItem>
          </SelectContent>
        </Select>
      </CardContent></Card>

      <Card><CardContent className="pt-6 space-y-3">
        <span className="font-medium">🔄 Redundancy</span>
        <Select value={redundancy} onValueChange={(v: any) => setRedundancy(v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None ($0) — No failover</SelectItem>
            <SelectItem value="active-passive">Active-Passive ($1,000) — Basic failover</SelectItem>
            <SelectItem value="active-active">Active-Active ($2,500) — Full redundancy</SelectItem>
          </SelectContent>
        </Select>
      </CardContent></Card>

      <Card><CardContent className="pt-6 space-y-3">
        <div className="flex justify-between"><span className="font-medium">💰 Monthly Budget</span><Badge variant="outline">${budget}</Badge></div>
        <Slider value={[budget]} onValueChange={([v]) => setBudget(v)} min={2000} max={10000} step={500} />
      </CardContent></Card>

      <Card className={`border-primary/30 ${totalCost <= budget ? "bg-green-500/5" : "bg-destructive/5"}`}>
        <CardContent className="pt-4">
          <p className="text-sm font-medium mb-2">📊 Cost Breakdown:</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span>Team: <strong>${teamCost}</strong></span>
            <span>Monitoring: <strong>${monitoringCost}</strong></span>
            <span>Redundancy: <strong>${redundancyCost}</strong></span>
            <span>Total: <strong className={totalCost <= budget ? "text-green-500" : "text-destructive"}>${totalCost}/{budget}</strong></span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Detection Rate: <strong>{Math.round(detectionSpeed * 100)}%</strong></p>
        </CardContent>
      </Card>

      <Button onClick={startMonitoring} className="w-full text-base" size="lg">
        🖥️ Start NOC Shift — Handle {INCIDENTS.length} Incidents
      </Button>
    </div>
  );
}
