import { useState, type FormEvent } from "react";
import { Sparkles, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AcademySectionHeader } from "../ui/AcademySectionHeader";

const EXAMPLES = ["أريد أن أتعلم Flutter", "أريد أن أتعلم Python", "أريد أن أتعلم الأمن السيبراني"];

/**
 * Captures AI-course intent honestly — generation itself is out of scope for
 * Phase 3 (see requestAICourse() in services/academy/lms.ts). Submitting logs
 * the request state locally and tells the student it's queued, rather than
 * pretending to generate anything.
 */
export function AICourseRequestCard() {
  const [topic, setTopic] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    setSubmitted(true);
  };

  return (
    <section aria-labelledby="ai-course-request-heading" className="bg-gradient-to-br from-primary/10 via-card to-card rounded-3xl border border-border shadow-lg p-8">
      <AcademySectionHeader
        icon={Sparkles}
        title="أنشئ مسارك التعليمي بالذكاء الاصطناعي"
        description="اكتب أي موضوع تريد تعلّمه، ومنير سيجهّز لك خارطة طريق مخصصة"
        headingId="ai-course-request-heading"
      />

      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <label htmlFor="ai-course-topic" className="sr-only">الموضوع الذي تريد تعلّمه</label>
        <Input
          id="ai-course-topic"
          value={topic}
          onChange={(e) => { setTopic(e.target.value); setSubmitted(false); }}
          placeholder="مثال: أريد أن أتعلم Flutter"
          className="rounded-xl py-5 flex-1"
        />
        <Button type="submit" disabled={!topic.trim()} className="gap-2 rounded-xl py-5 px-6 shrink-0">
          <Send className="w-4 h-4" aria-hidden="true" />
          طلب المسار
        </Button>
      </form>

      <div className="flex flex-wrap gap-2 mt-3">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => { setTopic(ex); setSubmitted(false); }}
            className="text-xs px-3 py-1.5 rounded-lg bg-muted/60 text-muted-foreground hover:bg-muted transition-colors"
          >
            {ex}
          </button>
        ))}
      </div>

      <p role="status" aria-live="polite" className={`mt-4 text-sm ${submitted ? "text-primary font-medium" : "sr-only"}`}>
        {submitted && `تم استلام طلبك لتعلّم "${topic}" — توليد المسارات بالذكاء الاصطناعي قيد التطوير وسيتوفر قريباً.`}
      </p>
    </section>
  );
}
