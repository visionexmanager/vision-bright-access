import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLibraryAiAssistant } from "@/hooks/library/useLibraryAiAssistant";

interface MindMapTabProps {
  bookId: string;
  chapterId: string | null;
}

export function MindMapTab({ bookId, chapterId }: MindMapTabProps) {
  const { t } = useLanguage();
  const { run, result, isRunning, error } = useLibraryAiAssistant();

  const handleGenerate = () => {
    void run({ mode: "mind-map", book_id: bookId, chapter_id: chapterId ?? undefined });
  };

  return (
    <div className="space-y-3">
      <Button onClick={handleGenerate} disabled={isRunning} className="w-full">
        {isRunning ? <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="me-2 h-4 w-4" aria-hidden="true" />}
        {t("library.ai.mindMap.generate")}
      </Button>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {result && result.mode === "mind-map" && (
        <div className="space-y-3 rounded-lg bg-muted p-3 text-sm">
          <Badge className="text-sm">{result.result.central_topic}</Badge>
          <div className="grid gap-2">
            {result.result.branches.map((b, i) => (
              <div key={i} className="rounded-lg border bg-background p-3">
                <p className="font-medium">{b.topic}</p>
                <ul className="mt-1 list-inside list-disc text-muted-foreground">
                  {b.subtopics.map((s, si) => <li key={si}>{s}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
