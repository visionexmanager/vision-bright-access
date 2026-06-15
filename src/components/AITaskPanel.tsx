import { useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Bot, Check, Copy, Loader2, Send, Sparkles, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { aiService } from "@/services/ai/aiService";
import { parseSSEResponse } from "@/lib/api/useSSEStream";
import { toast } from "sonner";

export interface AITaskAction {
  label: string;
  prompt: string;
}

interface AITaskPanelProps {
  assistantId: string;
  title: string;
  description: string;
  actions: AITaskAction[];
  context?: Record<string, unknown>;
  placeholder?: string;
  compact?: boolean;
  onUseResult?: (result: string) => void;
}

export function AITaskPanel({
  assistantId,
  title,
  description,
  actions,
  context,
  placeholder,
  compact = false,
  onUseResult,
}: AITaskPanelProps) {
  const { lang, dir } = useLanguage();
  const [input, setInput] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const contextText = useMemo(() => {
    if (!context) return "";
    const clean = Object.fromEntries(
      Object.entries(context).filter(([, value]) => value !== "" && value !== null && value !== undefined),
    );
    return Object.keys(clean).length
      ? `\n\nCurrent page data (use it as factual context; do not invent missing values):\n${JSON.stringify(clean, null, 2)}`
      : "";
  }, [context]);

  const run = async (prompt: string) => {
    if (!prompt.trim() || loading) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setResult("");

    try {
      const response = await aiService.streamChat(
        [{ role: "user", content: `${prompt}${contextText}` }],
        { assistantId, language: lang, currentPage: window.location.pathname },
        controller.signal,
      );
      await parseSSEResponse(response, (_token, accumulated) => setResult(accumulated), controller.signal);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      toast.error(lang === "ar" ? "تعذر تشغيل مساعد الذكاء الاصطناعي" : "AI assistant could not run");
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const copyResult = async () => {
    await navigator.clipboard.writeText(result);
    toast.success(lang === "ar" ? "تم نسخ النتيجة" : "Result copied");
  };

  return (
    <Card className="border-primary/25" dir={dir}>
      <CardHeader className={compact ? "p-4 pb-2" : undefined}>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className={compact ? "space-y-3 p-4 pt-2" : "space-y-4"}>
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <Button key={action.label} type="button" variant="outline" size="sm" onClick={() => void run(action.prompt)} disabled={loading}>
              <Bot className="me-1.5 h-4 w-4" />
              {action.label}
            </Button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={placeholder ?? (lang === "ar" ? "اطلب مساعدة مخصصة..." : "Ask for tailored help...")}
            rows={compact ? 2 : 3}
            className="min-h-20 resize-none"
          />
          {loading ? (
            <Button type="button" variant="outline" size="icon" onClick={() => abortRef.current?.abort()} aria-label={lang === "ar" ? "إيقاف" : "Stop"}>
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="button" size="icon" onClick={() => void run(input)} disabled={!input.trim()} aria-label={lang === "ar" ? "إرسال" : "Send"}>
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
        {loading && !result && (
          <div className="flex items-center gap-2 rounded-md bg-muted p-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {lang === "ar" ? "جاري التحليل..." : "Analyzing..."}
          </div>
        )}
        {result && (
          <div className="rounded-md border bg-muted/35 p-4">
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown>{result}</ReactMarkdown>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
              <Button type="button" variant="ghost" size="sm" onClick={copyResult}>
                <Copy className="me-1.5 h-4 w-4" />
                {lang === "ar" ? "نسخ" : "Copy"}
              </Button>
              {onUseResult && (
                <Button type="button" size="sm" onClick={() => onUseResult(result)}>
                  <Check className="me-1.5 h-4 w-4" />
                  {lang === "ar" ? "استخدام النتيجة" : "Use result"}
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
