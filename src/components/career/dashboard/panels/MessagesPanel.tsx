import { useState } from "react";
import { Star, ArrowLeft, Mail } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { CompanyAvatar } from "@/components/career/jobs/CompanyAvatar";
import { MOCK_MESSAGES } from "../mock/mockMessages";
import type { DashboardMessage } from "../types";

export function MessagesPanel() {
  const { t } = useLanguage();
  const [messages, setMessages] = useState<DashboardMessage[]>(MOCK_MESSAGES);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = messages.find((m) => m.id === selectedId) ?? null;

  const openMessage = (id: string) => {
    setSelectedId(id);
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, read: true } : m)));
  };

  const toggleStar = (id: string) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, starred: !m.starred } : m)));
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="type-heading mb-1">{t("careerDash.nav.messages")}</h1>
        <p className="text-sm text-muted-foreground">{t("careerDash.messages.subtitle")}</p>
      </div>

      <div className="flex min-h-[28rem] overflow-hidden rounded-2xl border border-border/60 bg-card">
        {/* List */}
        <ul
          role="list"
          className={`w-full shrink-0 divide-y divide-border overflow-y-auto sm:w-80 ${selected ? "hidden sm:block" : ""}`}
        >
          {messages.map((msg) => (
            <li key={msg.id}>
              <button
                type="button"
                onClick={() => openMessage(msg.id)}
                aria-current={selected?.id === msg.id ? "true" : undefined}
                className={`flex w-full items-start gap-3 p-4 text-start transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset ${
                  selected?.id === msg.id ? "bg-muted" : ""
                } ${!msg.read ? "bg-primary/[0.03]" : ""}`}
              >
                <CompanyAvatar name={msg.senderName} color={msg.senderColor} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`truncate text-sm ${!msg.read ? "font-bold" : "font-medium"}`}>{msg.senderName}</p>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{msg.date}</span>
                  </div>
                  <p className={`truncate text-xs ${!msg.read ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{msg.subject}</p>
                  <p className="truncate text-xs text-muted-foreground">{msg.preview}</p>
                </div>
                {msg.starred && <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>

        {/* Reading pane */}
        <div className={`flex flex-1 flex-col ${selected ? "" : "hidden sm:flex"}`}>
          {selected ? (
            <div className="flex flex-1 flex-col p-6">
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="mb-4 flex items-center gap-1.5 self-start text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring rounded sm:hidden"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                {t("careerDash.messages.back")}
              </button>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <CompanyAvatar name={selected.senderName} color={selected.senderColor} />
                  <div>
                    <p className="font-bold">{selected.senderName}</p>
                    <p className="text-xs text-muted-foreground">{selected.date}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleStar(selected.id)}
                  aria-pressed={selected.starred}
                  aria-label={t("careerDash.messages.star")}
                  className="rounded-lg p-1.5 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Star className={`h-4 w-4 ${selected.starred ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} aria-hidden="true" />
                </button>
              </div>
              <h2 className="mb-4 text-lg font-bold">{selected.subject}</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{selected.body}</p>
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
