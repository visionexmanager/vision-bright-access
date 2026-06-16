/**
 * ImageAnalyst — upload a photo and get a structured AI assessment.
 * Wired to a registry-driven vision analyst (skin-care, hair-care, …) via
 * aiService.analyzeWithAnalyst(). Renders the universal VisionAnalysis schema.
 */
import { useRef, useState } from "react";
import { Sparkles, Upload, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { aiService } from "@/services/ai/aiService";
import type { VisionAnalysis } from "@/lib/types";

interface Props {
  analystId: string;
  name: string;
  hint: string;
}

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

export function ImageAnalyst({ analystId, name, hint }: Props) {
  const { lang, t, dir, translateText } = useLanguage();
  const isRTL = dir === "rtl";
  const inputRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [imageData, setImageData] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<VisionAnalysis | null>(null);

  const tx = {
    choose: t("ai.image.choose"),
    analyze: t("ai.image.analyze"),
    analyzing: t("ai.image.analyzing"),
    summary: t("ai.image.summary"),
    findings: t("ai.image.findings"),
    recommendations: t("ai.image.recommendations"),
    tooLarge: t("ai.image.tooLarge"),
    failed: t("ai.image.failed"),
  };

  const onPick = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_BYTES) { toast.error(tx.tooLarge); return; }
    try {
      const dataUrl = await fileToDataUrl(file);
      setImageData(dataUrl);
      setPreview(dataUrl);
      setAnalysis(null);
    } catch {
      toast.error(tx.failed);
    }
  };

  const analyze = async () => {
    if (!imageData || loading) return;
    setLoading(true);
    setAnalysis(null);
    try {
      const { analysis } = await aiService.analyzeWithAnalyst(analystId, imageData, lang);
      setAnalysis(analysis);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tx.failed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="shadow-sm border-primary/30" dir={isRTL ? "rtl" : "ltr"}>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold">{translateText(name)}</p>
            <p className="text-sm text-muted-foreground">{hint}</p>
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onPick(e.target.files?.[0])}
        />

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
            <Upload className="me-2 h-4 w-4" />
            {tx.choose}
          </Button>
          {imageData && (
            <Button type="button" onClick={analyze} disabled={loading}>
              {loading ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Sparkles className="me-2 h-4 w-4" />}
              {loading ? tx.analyzing : tx.analyze}
            </Button>
          )}
        </div>

        {preview && (
          <img
            src={preview}
            alt=""
            role="presentation"
            className="max-h-64 w-auto rounded-xl border object-contain"
          />
        )}

        {analysis && (
          <div className="space-y-4 rounded-xl border bg-muted/30 p-4" aria-live="polite">
            <div>
              <p className="mb-1 text-sm font-semibold text-primary">{tx.summary}</p>
              <p className="text-sm">{analysis.summary}</p>
            </div>

            {analysis.findings?.length > 0 && (
              <div>
                <p className="mb-1.5 text-sm font-semibold text-primary">{tx.findings}</p>
                <ul className="space-y-1.5">
                  {analysis.findings.map((f, i) => (
                    <li key={i} className="text-sm">
                      <span className="font-medium">{f.label}: </span>
                      <span className="text-muted-foreground">{f.detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.recommendations?.length > 0 && (
              <div>
                <p className="mb-1.5 text-sm font-semibold text-primary">{tx.recommendations}</p>
                <ul className="space-y-1.5">
                  {analysis.recommendations.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.caution && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{analysis.caution}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
