import { ChangeEvent, useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLibraryAiAssistant } from "@/hooks/library/useLibraryAiAssistant";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface OcrResult {
  extracted_text: string;
  detected_language: string;
  confidence: string;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Accessibility AI: describe an image from a book (photo/diagram/chart/
 * table/equation) for a blind or low-vision reader, and extract any text in
 * it via OCR. Reuses the existing image-description mode (this phase) and
 * the existing ocr-scan edge function (unmodified, Phase-1-era) side by
 * side — no per-book embedded-image data model exists yet, so this is a
 * general-purpose tool (upload any page photo/screenshot) rather than
 * something wired to specific stored images.
 */
export function AccessibilityDescribePanel() {
  const { t } = useLanguage();
  const { run, result, isRunning, error } = useLibraryAiAssistant();
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [isOcrRunning, setIsOcrRunning] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await readAsDataUrl(file);
    setPreviewUrl(dataUrl);
    void run({ mode: "image-description", image: dataUrl });

    setIsOcrRunning(true);
    try {
      const { data, error: ocrErr } = await supabase.functions.invoke("ocr-scan", { body: { image: dataUrl } });
      if (ocrErr) throw ocrErr;
      if (data?.error) throw new Error(data.error);
      setOcrResult(data.result as OcrResult);
    } catch (err) {
      toast({ title: t("library.ai.accessibility.ocrFailed"), description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setIsOcrRunning(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{t("library.ai.accessibility.hint")}</p>

      <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => void handleFileSelected(e)} className="hidden" />
      <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="w-full gap-1.5">
        <Upload className="h-4 w-4" aria-hidden="true" /> {t("library.ai.accessibility.chooseImage")}
      </Button>

      {previewUrl && <img src={previewUrl} alt="" className="max-h-40 w-full rounded-lg object-contain" />}

      {(isRunning || isOcrRunning) && <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {result && result.mode === "image-description" && (
        <div className="space-y-2 rounded-lg bg-muted p-3 text-sm">
          <Badge variant="outline" className="capitalize">{result.result.image_type}</Badge>
          <p>{result.result.description}</p>
          {result.result.simplified_explanation && (
            <p className="text-muted-foreground">{result.result.simplified_explanation}</p>
          )}
        </div>
      )}

      {ocrResult?.extracted_text && (
        <div className="rounded-lg border p-3 text-sm">
          <p className="mb-1 text-xs font-medium text-muted-foreground">{t("library.ai.accessibility.extractedText")}</p>
          <p className="whitespace-pre-line">{ocrResult.extracted_text}</p>
        </div>
      )}
    </div>
  );
}
