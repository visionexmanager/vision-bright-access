import { useState } from "react";
import { Send, Video, Mic, Users as UsersIcon } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { MOCK_CANDIDATES } from "../mock/mockCandidates";
import { MOCK_EMPLOYER_INTERVIEWS } from "../mock/mockInterviews";
import type { EmployerInterview, InterviewFormat, InterviewMode } from "../types";

const MODES: { value: InterviewMode; labelKey: string }[] = [
  { value: "hr", labelKey: "employerDash.interviews.mode.hr" },
  { value: "technical", labelKey: "employerDash.interviews.mode.technical" },
  { value: "behavioral", labelKey: "employerDash.interviews.mode.behavioral" },
];

const FORMATS: { value: InterviewFormat; labelKey: string; icon: typeof Video }[] = [
  { value: "async_video", labelKey: "employerDash.interviews.format.asyncVideo", icon: Video },
  { value: "async_voice", labelKey: "employerDash.interviews.format.asyncVoice", icon: Mic },
  { value: "live", labelKey: "employerDash.interviews.format.live", icon: UsersIcon },
];

const eligibleCandidates = MOCK_CANDIDATES.filter((c) => c.stage !== "hired" && c.stage !== "rejected");

export function InterviewsPanel() {
  const { t } = useLanguage();
  const { playSound } = useSound();
  const [interviews, setInterviews] = useState<EmployerInterview[]>(MOCK_EMPLOYER_INTERVIEWS);
  const [candidateId, setCandidateId] = useState(eligibleCandidates[0]?.id ?? "");
  const [mode, setMode] = useState<InterviewMode>("hr");
  const [format, setFormat] = useState<InterviewFormat>("async_video");
  const [date, setDate] = useState("");

  const sendInterview = () => {
    const candidate = MOCK_CANDIDATES.find((c) => c.id === candidateId);
    if (!candidate || !date) return;
    playSound("send");
    setInterviews((prev) => [
      { id: `ei-${Date.now()}`, candidateId: candidate.id, candidateName: candidate.name, jobTitle: candidate.appliedJobTitle, mode, format, status: "scheduled", scheduledDate: date, scores: null },
      ...prev,
    ]);
    toast.success(t("employerDash.interviews.sent"));
    setDate("");
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="type-heading mb-1">{t("employerDash.nav.interviews")}</h1>
        <p className="text-sm text-muted-foreground">{t("employerDash.interviews.subtitle")}</p>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-5">
        <p className="mb-3 text-sm font-bold">{t("employerDash.interviews.sendTitle")}</p>
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">{t("employerDash.interviews.candidate")}</Label>
            <Select value={candidateId} onValueChange={setCandidateId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {eligibleCandidates.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">{t("employerDash.interviews.modeLabel")}</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as InterviewMode)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MODES.map((m) => <SelectItem key={m.value} value={m.value}>{t(m.labelKey)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">{t("employerDash.interviews.formatLabel")}</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as InterviewFormat)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FORMATS.map((f) => <SelectItem key={f.value} value={f.value}>{t(f.labelKey)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="iv-date" className="mb-1.5 block text-xs text-muted-foreground">{t("employerDash.interviews.dateLabel")}</Label>
            <Input id="iv-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <Button onClick={sendInterview} disabled={!candidateId || !date} className="mt-3">
          <Send className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
          {t("employerDash.interviews.send")}
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {interviews.map((iv) => {
          const FormatIcon = FORMATS.find((f) => f.value === iv.format)?.icon ?? Video;
          return (
            <div key={iv.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 bg-card p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FormatIcon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-bold">{iv.candidateName}</p>
                  <p className="text-xs text-muted-foreground">{iv.jobTitle} · {t(`employerDash.interviews.mode.${iv.mode}`)} · {iv.scheduledDate}</p>
                </div>
              </div>
              {iv.status === "completed" && iv.scores ? (
                <div className="flex gap-3 text-center text-xs">
                  <div><p className="font-bold text-primary">{iv.scores.candidateScore}</p><p className="text-muted-foreground">{t("employerDash.interviews.overall")}</p></div>
                  <div><p className="font-bold">{iv.scores.communication}</p><p className="text-muted-foreground">{t("employerDash.interviews.communication")}</p></div>
                  <div><p className="font-bold">{iv.scores.technicalAccuracy}</p><p className="text-muted-foreground">{t("employerDash.interviews.technical")}</p></div>
                </div>
              ) : (
                <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">{t("employerDash.interviews.status.scheduled")}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
