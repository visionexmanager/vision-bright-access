import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircleQuestion, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSSEStream } from "@/lib/api/useSSEStream";
import { askIvxTutor, ivx, type IvxTutorHistory, type IvxTutorTurn } from "./api";

/**
 * The tutor, beside the question.
 *
 * ── The one thing to understand before changing this ────────────────────────
 *
 * This component does not know the answer, does not know whether the student
 * has answered, and does not decide which of those two conversations to have.
 * It sends a question id and a sentence. `ai-chat` fetches the brief with the
 * service role and `ivx_tutor_brief` picks the mode from the student's own
 * session and attempt rows.
 *
 * So there is deliberately no `mode` prop here. A prop would be a claim this
 * component makes about the student's state, and the whole point is that the
 * database makes it instead — a browser that could say "I have answered
 * already" could talk the answer out of the tutor.
 *
 * ── Accessibility ───────────────────────────────────────────────────────────
 *
 * The thread is a `log`: a screen reader announces new turns as they arrive
 * without the listener having to go looking. Polite, not assertive, because
 * the assertive region on this page belongs to the answer result — a tutor
 * reply must never cut across "correct" or "not quite".
 *
 * The reply streams in, so the log updates token by token. Only the finished
 * text is announced: `aria-live` is on a wrapper that holds completed turns,
 * while the streaming draft sits outside it and lands in the log when done.
 */
export function IVXTutor({ questionId }: { questionId: string }) {
  const { translateText, dir, lang } = useLanguage();
  const language = lang === "ar" ? "ar" : lang;

  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<IvxTutorTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [streamed, setStreamed] = useState("");
  const [failed, setFailed] = useState<string | null>(null);
  const { consumeStream, isStreaming, rateLimitCooldown } = useSSEStream();

  const inputRef = useRef<HTMLInputElement>(null);

  // A new question is a new conversation. Without this, opening the tutor on
  // question two would show question one's thread.
  useEffect(() => {
    setTurns([]);
    setStreamed("");
    setFailed(null);
    setOpen(false);
  }, [questionId]);

  const openTutor = useCallback(async () => {
    setOpen(true);
    const history = await ivx.tutorHistory(questionId);
    if (history.ok) setTurns((history as IvxTutorHistory).turns);
    // Focus the box rather than the panel: the student opened this to type.
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [questionId]);

  const ask = async (message: string) => {
    const text = message.trim();
    if (!text || isStreaming) return;

    setFailed(null);
    setDraft("");
    setTurns((prior) => [...prior, { role: "student", body: text, at: new Date().toISOString() }]);

    try {
      // `callEdge` throws on a non-ok response, which is how a refused brief
      // (a question this account was never dealt) arrives here rather than as
      // an empty stream.
      const response = await askIvxTutor({ questionId, language, turns, message: text });
      let reply = "";
      await consumeStream(response, {
        onToken: (_token, accumulated) => {
          reply = accumulated;
          setStreamed(accumulated);
        },
        onError: (error, isRateLimit) => {
          reply = "";
          setStreamed("");
          setFailed(
            isRateLimit
              ? translateText("You have reached today's limit for the tutor. It comes back tomorrow.")
              : error.message,
          );
        },
      });

      if (reply.trim()) {
        setStreamed("");
        setTurns((prior) => [...prior, { role: "tutor", body: reply, at: new Date().toISOString() }]);
        // The reply exists in this browser and nowhere else until now — the
        // stream is what the student saw, so this is what gets recorded.
        void ivx.saveTutorReply(questionId, reply);
      }
    } catch (error) {
      setStreamed("");
      setFailed(
        error instanceof Error && error.message
          ? error.message
          : translateText("The tutor is unavailable right now. Please try again shortly."),
      );
    }
  };

  if (!open) {
    return (
      <Button type="button" variant="ghost" size="sm" className="mt-4" onClick={() => void openTutor()}>
        <MessageCircleQuestion className="me-2 h-4 w-4" aria-hidden="true" />
        {translateText("Ask the tutor")}
      </Button>
    );
  }

  return (
    <section className="mt-6 rounded-xl border border-border p-4" aria-labelledby="ivx-tutor-heading" dir={dir}>
      <h2 id="ivx-tutor-heading" className="text-base font-bold">
        {translateText("Tutor")}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {translateText(
          "Ask why, or say what you were thinking. Before you answer the tutor will point you at the next step rather than give the answer away.",
        )}
      </p>

      <div role="log" aria-live="polite" aria-relevant="additions text" className="mt-4 space-y-3">
        {turns.map((turn, index) => (
          <p
            key={`${turn.at}-${index}`}
            className={
              turn.role === "student"
                ? "rounded-lg bg-muted p-3 text-sm"
                : "rounded-lg border border-border p-3 text-sm"
            }
          >
            <span className="sr-only">
              {turn.role === "student" ? translateText("You said") : translateText("Tutor said")}:{" "}
            </span>
            {turn.body}
          </p>
        ))}
      </div>

      {/* Outside the log on purpose: a half-written sentence re-announced on
          every token is unusable with a screen reader. It joins the log above
          once the stream finishes. */}
      {streamed && (
        <p className="mt-3 rounded-lg border border-border p-3 text-sm" aria-hidden="true">
          {streamed}
        </p>
      )}

      {isStreaming && !streamed && (
        <p className="mt-3 text-sm text-muted-foreground" role="status">
          {translateText("The tutor is thinking…")}
        </p>
      )}

      {failed && (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {failed}
        </p>
      )}

      <form
        className="mt-4 flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void ask(draft);
        }}
      >
        <label htmlFor="ivx-tutor-input" className="sr-only">
          {translateText("Ask the tutor")}
        </label>
        <Input
          id="ivx-tutor-input"
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={isStreaming || rateLimitCooldown > 0}
          autoComplete="off"
          className="flex-1"
          placeholder={translateText("Why is this the answer?")}
        />
        <Button type="submit" disabled={isStreaming || !draft.trim() || rateLimitCooldown > 0}>
          <Send className="me-2 h-4 w-4" aria-hidden="true" />
          {translateText("Ask")}
        </Button>
      </form>
    </section>
  );
}
