import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BarChart2, X, Plus } from "lucide-react";

export interface Poll {
  id: string;
  question: string;
  options: string[];
  votes: Record<number, number>;
  voterIds: string[];
  createdBy: string;
  isActive: boolean;
}

interface LivePollWidgetProps {
  poll: Poll | null;
  isOwner: boolean;
  currentUserId: string;
  showCreator: boolean;
  t: (key: string) => string;
  onCreatePoll: (question: string, options: string[]) => void;
  onVote: (pollId: string, optionIndex: number) => void;
  onClosePoll: () => void;
  onHideCreator: () => void;
}

export function LivePollWidget({
  poll, isOwner, currentUserId, showCreator, t,
  onCreatePoll, onVote, onClosePoll, onHideCreator,
}: LivePollWidgetProps) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);

  const addOption = () => {
    if (options.length < 4) setOptions([...options, ""]);
  };

  const updateOption = (idx: number, val: string) => {
    const next = [...options];
    next[idx] = val;
    setOptions(next);
  };

  const removeOption = (idx: number) => {
    if (options.length <= 2) return;
    setOptions(options.filter((_, i) => i !== idx));
  };

  const handleCreate = () => {
    const validOptions = options.filter((o) => o.trim());
    if (!question.trim() || validOptions.length < 2) return;
    onCreatePoll(question.trim(), validOptions);
    setQuestion("");
    setOptions(["", ""]);
  };

  const hasVoted = poll ? poll.voterIds.includes(currentUserId) : false;
  const totalVotes = poll ? Object.values(poll.votes).reduce((a, b) => a + b, 0) : 0;

  if (showCreator && isOwner) {
    return (
      <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold flex items-center gap-1.5">
            <BarChart2 className="h-4 w-4 text-primary" />
            {t("vroom.createPoll")}
          </span>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onHideCreator}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        <Input
          placeholder={t("vroom.pollQuestion")}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={200}
        />
        {options.map((opt, i) => (
          <div key={i} className="flex gap-2">
            <Input
              placeholder={`${t("vroom.pollOption")} ${i + 1}`}
              value={opt}
              onChange={(e) => updateOption(i, e.target.value)}
              maxLength={100}
            />
            {options.length > 2 && (
              <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={() => removeOption(i)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
        {options.length < 4 && (
          <Button variant="outline" size="sm" className="gap-1.5 w-full" onClick={addOption}>
            <Plus className="h-3.5 w-3.5" />
            {t("vroom.addOption")}
          </Button>
        )}
        <Button
          className="w-full"
          onClick={handleCreate}
          disabled={!question.trim() || options.filter((o) => o.trim()).length < 2}
        >
          {t("vroom.launchPoll")}
        </Button>
      </div>
    );
  }

  if (!poll) return null;

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold flex items-center gap-1.5">
          <BarChart2 className="h-4 w-4 text-primary" />
          {t("vroom.livePoll")}
        </span>
        {isOwner && poll.isActive && (
          <Button size="sm" variant="outline" onClick={onClosePoll} className="h-7 text-xs">
            {t("vroom.endPoll")}
          </Button>
        )}
      </div>
      <p className="text-sm font-medium">{poll.question}</p>
      <div className="space-y-2">
        {poll.options.map((opt, i) => {
          const count = poll.votes[i] || 0;
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          const canVote = poll.isActive && !hasVoted;
          return (
            <button
              key={i}
              className={`relative w-full rounded-lg border text-left px-3 py-2 text-sm transition-colors overflow-hidden ${
                canVote
                  ? "hover:border-primary hover:bg-primary/5 cursor-pointer"
                  : "cursor-default"
              }`}
              onClick={() => canVote && onVote(poll.id, i)}
              disabled={!canVote}
            >
              <div
                className="absolute inset-y-0 left-0 bg-primary/10 transition-all"
                style={{ width: `${pct}%` }}
              />
              <span className="relative z-10 flex items-center justify-between">
                <span>{opt}</span>
                <span className="text-xs text-muted-foreground">{pct}% ({count})</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground text-right">
        {totalVotes} {t("vroom.votes")}
        {!poll.isActive && <span className="ml-2 text-muted-foreground/60">({t("vroom.pollEnded")})</span>}
      </p>
    </div>
  );
}
