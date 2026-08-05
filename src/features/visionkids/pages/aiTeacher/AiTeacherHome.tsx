import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Loader2, Send } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { toast } from "@/hooks/use-toast";
import { askAiTeacher, type AiTeacherAnswer, type AiTeacherTurn } from "@/features/visionkids/services/aiTeacher/aiTeacher";
import type { AgeGroup } from "@/features/visionkids/types/stories.types";

const AGE_GROUPS: AgeGroup[] = ["3-5", "6-8", "9-12"];

const SUBJECTS = [
  { value: "", labelKey: "kids.aiTeacher.subject.any" },
  { value: "science", labelKey: "kids.aiTeacher.subject.science" },
  { value: "math", labelKey: "kids.aiTeacher.subject.math" },
  { value: "language", labelKey: "kids.aiTeacher.subject.language" },
  { value: "history", labelKey: "kids.aiTeacher.subject.history" },
  { value: "geography", labelKey: "kids.aiTeacher.subject.geography" },
];

const STARTER_KEYS = [
  "kids.aiTeacher.starter1",
  "kids.aiTeacher.starter2",
  "kids.aiTeacher.starter3",
];

interface Exchange {
  id: string;
  question: string;
  answer: AiTeacherAnswer;
}

/**
 * `/kids/ai-teacher` — ask-anything tutor.
 *
 * Answers arrive as one settled block rather than a stream: the primary user
 * of this platform is blind, and a live region that mutates token by token is
 * read out as a stuttering mess by a screen reader. Each answer is announced
 * once, complete, via role="status".
 */
export default function AiTeacherHome() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const [question, setQuestion] = useState("");
  const [ageGroup, setAgeGroup] = useState<AgeGroup>("6-8");
  const [subject, setSubject] = useState("");
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const latestRef = useRef<HTMLDivElement>(null);

  useDocumentHead({
    title: `${t("kids.section.aiTeacher.title")} — VisionKids`,
    description: t("kids.section.aiTeacher.desc"),
    canonicalPath: "/kids/ai-teacher",
  });

  // Move focus to the newest answer so a keyboard or screen-reader user lands
  // on it instead of having to hunt back down the page.
  useEffect(() => {
    if (exchanges.length > 0) latestRef.current?.focus();
  }, [exchanges.length]);

  const ask = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isAsking) return;
      if (!user) {
        toast({ title: t("kids.aiTeacher.signInTitle"), description: t("kids.aiTeacher.signInHint") });
        return;
      }

      setIsAsking(true);
      try {
        // Only the prose goes back as context; the examples and follow-ups are
        // presentation, and replaying them would crowd out the real thread.
        const history: AiTeacherTurn[] = exchanges.flatMap((e) => [
          { role: "user" as const, content: e.question },
          { role: "assistant" as const, content: e.answer.answer },
        ]);

        const answer = await askAiTeacher({ question: trimmed, ageGroup, language: lang, subject: subject || undefined, history });
        setExchanges((prev) => [...prev, { id: `${Date.now()}`, question: trimmed, answer }]);
        setQuestion("");
      } catch (err) {
        toast({
          title: t("kids.aiTeacher.errorTitle"),
          description: err instanceof Error ? err.message : String(err),
          variant: "destructive",
        });
      } finally {
        setIsAsking(false);
        inputRef.current?.focus();
      }
    },
    [ageGroup, exchanges, isAsking, lang, subject, t, user]
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <header className="flex items-center gap-3">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-kids-primary/10" aria-hidden="true">
          <Bot className="h-7 w-7 text-kids-primary" strokeWidth={2.25} />
        </span>
        <div>
          <h1 className="font-heading text-2xl font-extrabold sm:text-3xl">
            <span aria-hidden="true" className="me-1.5">🤖</span>
            {t("kids.section.aiTeacher.title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("kids.section.aiTeacher.desc")}</p>
        </div>
      </header>

      <form
        className="mt-6 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(question);
        }}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="ai-teacher-age" className="mb-1 block text-sm font-medium">
              {t("kids.aiTeacher.ageLabel")}
            </label>
            <select
              id="ai-teacher-age"
              value={ageGroup}
              onChange={(e) => setAgeGroup(e.target.value as AgeGroup)}
              className="w-full rounded-xl border-2 border-border bg-card px-3 py-2 text-sm"
            >
              {AGE_GROUPS.map((g) => (
                <option key={g} value={g}>{t(`kids.aiTeacher.age.${g}`)}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="ai-teacher-subject" className="mb-1 block text-sm font-medium">
              {t("kids.aiTeacher.subjectLabel")}
            </label>
            <select
              id="ai-teacher-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-xl border-2 border-border bg-card px-3 py-2 text-sm"
            >
              {SUBJECTS.map((s) => (
                <option key={s.value} value={s.value}>{t(s.labelKey)}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="ai-teacher-question" className="mb-1 block text-sm font-medium">
            {t("kids.aiTeacher.questionLabel")}
          </label>
          <div className="flex gap-2">
            <input
              id="ai-teacher-question"
              ref={inputRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={500}
              placeholder={t("kids.aiTeacher.placeholder")}
              className="flex-1 rounded-xl border-2 border-border bg-card px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={isAsking || !question.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-kids-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {isAsking ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="h-4 w-4" aria-hidden="true" />
              )}
              {t("kids.aiTeacher.ask")}
            </button>
          </div>
        </div>
      </form>

      {isAsking && (
        <p className="mt-3 text-sm text-muted-foreground" role="status">
          {t("kids.aiTeacher.thinking")}
        </p>
      )}

      {exchanges.length === 0 && !isAsking && (
        <section className="mt-6" aria-labelledby="ai-teacher-starters">
          <h2 id="ai-teacher-starters" className="text-sm font-semibold text-muted-foreground">
            {t("kids.aiTeacher.startersTitle")}
          </h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {STARTER_KEYS.map((key) => (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => void ask(t(key))}
                  className="rounded-full border-2 border-border px-3 py-1.5 text-sm hover:border-kids-primary/50"
                >
                  {t(key)}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ol className="mt-6 space-y-4">
        {exchanges.map((exchange, i) => (
          <li key={exchange.id}>
            <article
              ref={i === exchanges.length - 1 ? latestRef : undefined}
              tabIndex={-1}
              role="status"
              className="rounded-2xl border-2 border-border bg-card p-4"
            >
              <p className="text-sm font-semibold text-kids-primary">
                <span aria-hidden="true" className="me-1.5">🙋</span>
                {exchange.question}
              </p>

              <p className="mt-2 whitespace-pre-line text-base">{exchange.answer.answer}</p>

              {exchange.answer.example && (
                <p className="mt-3 rounded-xl bg-muted/60 p-3 text-sm">
                  <span className="font-semibold">{t("kids.aiTeacher.exampleLabel")}: </span>
                  {exchange.answer.example}
                </p>
              )}

              {exchange.answer.followUps.length > 0 && (
                <div className="mt-3">
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                    {t("kids.aiTeacher.followUpsTitle")}
                  </h3>
                  <ul className="mt-1.5 flex flex-wrap gap-2">
                    {exchange.answer.followUps.map((f) => (
                      <li key={f}>
                        <button
                          type="button"
                          onClick={() => void ask(f)}
                          disabled={isAsking}
                          className="rounded-full border-2 border-border px-3 py-1.5 text-sm hover:border-kids-primary/50 disabled:opacity-50"
                        >
                          {f}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          </li>
        ))}
      </ol>

      {!user && (
        <p className="mt-4 text-sm text-muted-foreground" role="status">
          {t("kids.aiTeacher.signInHint")}
        </p>
      )}
    </div>
  );
}
