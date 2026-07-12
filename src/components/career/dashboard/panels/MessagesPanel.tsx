import { useState } from "react";
import { ArrowLeft, Mail } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { CompanyAvatar } from "@/components/career/jobs/CompanyAvatar";
import { useCareerMessages } from "@/hooks/career/useCareerMessages";
import { CareerErrorState } from "../../ui/CareerErrorState";
import { colorFromString } from "@/lib/utils/stringColor";

// Real `messages` table (career candidate↔employer/mentor DMs) — no
// "subject"/"starred" columns exist, so this drops those from the earlier
// mock UI rather than fabricating them.
export function MessagesPanel() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { messages, getCounterpartName, isLoading, error, refetch, markRead } = useCareerMessages();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = messages.find((m) => m.id === selectedId) ?? null;

  const openMessage = (id: string) => {
    setSelectedId(id);
    const msg = messages.find((m) => m.id === id);
    if (msg && !msg.is_read && msg.recipient_id === user?.id) markRead(id);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="type-heading mb-1">{t("careerDash.nav.messages")}</h1>
        <p className="text-sm text-muted-foreground">{t("careerDash.messages.subtitle")}</p>
      </div>

      {isLoading ? (
        <div className="h-96 rounded-2xl border border-border/60 bg-card animate-pulse" aria-hidden="true" />
      ) : error ? (
        <CareerErrorState message={error} onRetry={refetch} className="rounded-2xl border border-border/60 bg-card" />
      ) : messages.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {t("careerDash.messages.empty")}
        </p>
      ) : (
        <div className="flex min-h-[28rem] overflow-hidden rounded-2xl border border-border/60 bg-card">
          <ul
            role="list"
            className={`w-full shrink-0 divide-y divide-border overflow-y-auto sm:w-80 ${selected ? "hidden sm:block" : ""}`}
          >
            {messages.map((msg) => {
              const name = getCounterpartName(msg) || t("careerDash.messages.unknownSender");
              return (
                <li key={msg.id}>
                  <button
                    type="button"
                    onClick={() => openMessage(msg.id)}
                    aria-current={selected?.id === msg.id ? "true" : undefined}
                    className={`flex w-full items-start gap-3 p-4 text-start transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset ${
                      selected?.id === msg.id ? "bg-muted" : ""
                    } ${!msg.is_read ? "bg-primary/[0.03]" : ""}`}
                  >
                    <CompanyAvatar name={name} color={colorFromString(name)} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`truncate text-sm ${!msg.is_read ? "font-bold" : "font-medium"}`}>{name}</p>
                        <span className="shrink-0 text-[11px] text-muted-foreground">{new Date(msg.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{msg.body}</p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

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
                <div className="mb-4 flex items-center gap-3">
                  <CompanyAvatar name={getCounterpartName(selected) || t("careerDash.messages.unknownSender")} color={colorFromString(getCounterpartName(selected) || selected.id)} />
                  <div>
                    <p className="font-bold">{getCounterpartName(selected) || t("careerDash.messages.unknownSender")}</p>
                    <p className="text-xs text-muted-foreground">{new Date(selected.created_at).toLocaleString()}</p>
                  </div>
                </div>
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
      )}
    </div>
  );
}
