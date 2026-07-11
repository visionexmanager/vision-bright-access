import { useState } from "react";
import { ArrowLeft, Mail, Sparkles, CalendarPlus, Send } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useEmployerDashboard } from "@/contexts/EmployerDashboardContext";
import { CompanyAvatar } from "@/components/career/jobs/CompanyAvatar";
import { MOCK_EMPLOYER_MESSAGES } from "../mock/mockMessages";
import type { EmployerMessageThread } from "../types";

const AI_REPLY_KEYS = ["employerDash.messages.aiReply1", "employerDash.messages.aiReply2", "employerDash.messages.aiReply3"];

export function MessagingSystem() {
  const { t } = useLanguage();
  const { setActiveSection } = useEmployerDashboard();
  const [messages, setMessages] = useState<EmployerMessageThread[]>(MOCK_EMPLOYER_MESSAGES);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const selected = messages.find((m) => m.id === selectedId) ?? null;

  const openThread = (id: string) => {
    setSelectedId(id);
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, read: true } : m)));
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="type-heading mb-1">{t("employerDash.nav.messages")}</h1>
        <p className="text-sm text-muted-foreground">{t("employerDash.messages.subtitle")}</p>
      </div>

      <div className="flex min-h-[28rem] overflow-hidden rounded-2xl border border-border/60 bg-card">
        <ul role="list" className={`w-full shrink-0 divide-y divide-border overflow-y-auto sm:w-80 ${selected ? "hidden sm:block" : ""}`}>
          {messages.map((msg) => (
            <li key={msg.id}>
              <button
                type="button"
                onClick={() => openThread(msg.id)}
                aria-current={selected?.id === msg.id ? "true" : undefined}
                className={`flex w-full items-start gap-3 p-4 text-start transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset ${selected?.id === msg.id ? "bg-muted" : ""} ${!msg.read ? "bg-primary/[0.03]" : ""}`}
              >
                <CompanyAvatar name={msg.candidateName} color={msg.candidateColor} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`truncate text-sm ${!msg.read ? "font-bold" : "font-medium"}`}>{msg.candidateName}</p>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{msg.date}</span>
                  </div>
                  <p className={`truncate text-xs ${!msg.read ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{msg.subject}</p>
                  <p className="truncate text-xs text-muted-foreground">{msg.jobTitle}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>

        <div className={`flex flex-1 flex-col ${selected ? "" : "hidden sm:flex"}`}>
          {selected ? (
            <div className="flex flex-1 flex-col p-6">
              <button type="button" onClick={() => setSelectedId(null)} className="mb-4 flex items-center gap-1.5 self-start text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring rounded sm:hidden">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                {t("careerDash.messages.back")}
              </button>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <CompanyAvatar name={selected.candidateName} color={selected.candidateColor} />
                  <div>
                    <p className="font-bold">{selected.candidateName}</p>
                    <p className="text-xs text-muted-foreground">{selected.jobTitle} · {selected.date}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setActiveSection("interviews")}>
                  <CalendarPlus className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  {t("employerDash.messages.scheduleInterview")}
                </Button>
              </div>
              <h2 className="mb-4 text-lg font-bold">{selected.subject}</h2>
              <p className="mb-4 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{selected.body}</p>

              <div className="mt-auto flex flex-col gap-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Sparkles className="h-3.5 w-3.5" aria-hidden="true" />{t("employerDash.messages.aiSuggested")}</p>
                <div className="flex flex-wrap gap-2">
                  {AI_REPLY_KEYS.map((key) => (
                    <button key={key} type="button" onClick={() => setReply(t(key))} className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      {t(key)}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} className="resize-none" placeholder={t("employerDash.messages.replyPlaceholder")} />
                  <Button size="icon" className="shrink-0" aria-label={t("employerDash.messages.sendReply")} onClick={() => setReply("")}>
                    <Send className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
              <Mail className="h-8 w-8" aria-hidden="true" />
              <p className="text-sm">{t("careerDash.messages.selectPrompt")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
