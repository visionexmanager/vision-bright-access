import { useState, useCallback, useRef } from "react";
import { FileSearch, Upload, X, Copy, Download, Loader2, AlertCircle, ScanText, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { StudioLayout } from "./StudioLayout";
import { cn } from "@/lib/utils";
import { callOCRScan, callDocumentGenerate, type DocumentAnalysisResult } from "@/lib/api/edgeFunctions";
import { useLanguage } from "@/contexts/LanguageContext";

type DocMode = "ocr" | "analyze";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export default function DocumentStudio() {
  const { lang } = useLanguage();
  const docLang: "en" | "ar" = lang === "ar" ? "ar" : "en";
  const [mode, setMode] = useState<DocMode>("ocr");

  return (
    <StudioLayout>
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-6 py-4 border-b shrink-0">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileSearch className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">Document Studio</h1>
            <p className="text-xs text-muted-foreground">OCR · Document Analyzer · Powered by OpenAI Vision</p>
          </div>
          <Badge variant="secondary" className="ml-2 text-[10px]">Beta</Badge>

          <div className="ml-4 flex rounded-lg border p-0.5" role="tablist" aria-label="Document Studio mode">
            <button
              role="tab" aria-selected={mode === "ocr"} onClick={() => setMode("ocr")}
              className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors", mode === "ocr" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              OCR
            </button>
            <button
              role="tab" aria-selected={mode === "analyze"} onClick={() => setMode("analyze")}
              className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors", mode === "analyze" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              Document Analyzer
            </button>
          </div>
        </div>

        {mode === "ocr" ? <OCRPanel lang={docLang} /> : <AnalyzerPanel lang={docLang} />}
      </div>
    </StudioLayout>
  );
}

// ── OCR panel ────────────────────────────────────────────────────────────────

function OCRPanel({ lang }: { lang: "en" | "ar" }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "scanning" | "done" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [confidence, setConfidence] = useState<string | null>(null);

  const handleFile = useCallback(async (f: File) => {
    if (!f.type.startsWith("image/")) {
      toast.error(`Unsupported file type: ${f.type || "unknown"}. Please upload an image.`);
      return;
    }
    setFile(f);
    setStatus("idle");
    setError(null);
    setText("");
    setPreview(await fileToDataUrl(f));
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const runScan = async () => {
    if (!preview) return;
    setStatus("scanning");
    setError(null);
    try {
      const res = await callOCRScan(preview, lang);
      setText(res.result.extracted_text);
      setConfidence(res.result.confidence);
      setStatus("done");
      toast.success("Text extracted");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "OCR failed";
      setError(msg);
      setStatus("failed");
      toast.error(msg);
    }
  };

  const copyText = () => { navigator.clipboard.writeText(text); toast.success("Copied to clipboard"); };
  const downloadText = () => {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${(file?.name.split(".")[0] ?? "ocr")}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <input ref={fileInputRef} type="file" className="sr-only" accept="image/*" onChange={onFileChange} aria-label="Upload an image to scan" />
          {!file ? (
            <div
              role="button" tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInputRef.current?.click(); } }}
              className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-12 text-center cursor-pointer border-muted-foreground/30 hover:border-primary hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Upload className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
              <p className="font-medium">Click to upload an image</p>
              <p className="text-xs text-muted-foreground">JPG, PNG, WEBP — photos, scans, screenshots</p>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
                <span className="text-xs font-medium truncate">{file.name}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setFile(null); setPreview(null); setStatus("idle"); setText(""); }} aria-label="Remove image">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              {preview && <img src={preview} alt="Uploaded document preview" className="w-full max-h-80 object-contain bg-muted/20" />}
            </div>
          )}

          {file && status !== "scanning" && (
            <Button className="w-full gap-2" onClick={runScan}>
              <ScanText className="h-4 w-4" /> {status === "done" ? "Re-scan" : "Extract Text"}
            </Button>
          )}
          {status === "scanning" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
              <Loader2 className="h-4 w-4 animate-spin" /> Scanning with AI vision…
            </div>
          )}
          {status === "failed" && error && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /><span>{error}</span>
            </div>
          )}
        </div>

        <div className="rounded-xl border p-4 space-y-3 min-h-[300px] flex flex-col">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Extracted Text</h2>
            {confidence && <Badge variant="outline" className="text-[10px]">Confidence: {confidence}</Badge>}
          </div>
          {text ? (
            <>
              <p className="text-sm whitespace-pre-wrap leading-relaxed flex-1" tabIndex={0}>{text}</p>
              <div className="flex gap-2 pt-2 border-t">
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={copyText}><Copy className="h-3.5 w-3.5" /> Copy</Button>
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={downloadText}><Download className="h-3.5 w-3.5" /> Download</Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center text-sm text-muted-foreground">
              Upload an image and click Extract Text
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Document Analyzer panel ───────────────────────────────────────────────────

function AnalyzerPanel({ lang }: { lang: "en" | "ar" }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [inputText, setInputText] = useState("");
  const [filename, setFilename] = useState<string | null>(null);
  const [analyzeMode, setAnalyzeMode] = useState<"analyze" | "summarize">("summarize");
  const [status, setStatus] = useState<"idle" | "running" | "done" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DocumentAnalysisResult | null>(null);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".txt") && !f.name.toLowerCase().endsWith(".md")) {
      toast.error("Only .txt or .md files can be read directly — for PDFs/DOCX, paste the text instead.");
      return;
    }
    setFilename(f.name);
    setInputText(await f.text());
  };

  const run = async () => {
    if (!inputText.trim()) return;
    setStatus("running");
    setError(null);
    try {
      const res = await callDocumentGenerate({ mode: analyzeMode, input_text: inputText, filename: filename ?? undefined, language: lang });
      setResult(res.result);
      setStatus("done");
      toast.success("Analysis complete");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Document analysis failed";
      setError(msg);
      setStatus("failed");
      toast.error(msg);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Document Text</h2>
            <div className="flex items-center gap-2">
              <input ref={fileInputRef} type="file" className="sr-only" accept=".txt,.md" onChange={onFileChange} aria-label="Upload a text file" />
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => fileInputRef.current?.click()}>
                <FileText className="h-3.5 w-3.5" /> Upload .txt/.md
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            PDF/DOCX aren't parsed directly here — open the file and paste its text, or upload a .txt export.
          </p>
          <Textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Paste the document text here…"
            className="min-h-[220px] font-mono text-xs"
            aria-label="Document text to analyze"
          />
          <div className="flex rounded-lg border p-0.5 w-fit" role="tablist" aria-label="Analysis mode">
            {(["summarize", "analyze"] as const).map((m) => (
              <button
                key={m} role="tab" aria-selected={analyzeMode === m} onClick={() => setAnalyzeMode(m)}
                className={cn("px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors", analyzeMode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                {m === "summarize" ? "Summarize" : "Full Analysis"}
              </button>
            ))}
          </div>
          <Button className="w-full gap-2" disabled={!inputText.trim() || status === "running"} onClick={run}>
            {status === "running" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSearch className="h-4 w-4" />}
            {status === "running" ? "Analyzing…" : "Analyze Document"}
          </Button>
          {status === "failed" && error && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /><span>{error}</span>
            </div>
          )}
        </div>

        <div className="rounded-xl border p-4 space-y-4 min-h-[300px]">
          <h2 className="text-sm font-semibold">Analysis</h2>
          {result ? (
            <div className="space-y-4 text-sm">
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Summary</h3>
                <p className="leading-relaxed">{result.summary}</p>
              </div>
              {result.key_points.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Key Points</h3>
                  <ul className="list-disc list-inside space-y-1">{result.key_points.map((p, i) => <li key={i}>{p}</li>)}</ul>
                </div>
              )}
              {result.action_items.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Action Items</h3>
                  <ul className="list-disc list-inside space-y-1">{result.action_items.map((p, i) => <li key={i}>{p}</li>)}</ul>
                </div>
              )}
              {result.entities.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Entities</h3>
                  <div className="flex flex-wrap gap-1">{result.entities.map((e, i) => <Badge key={i} variant="outline" className="text-[10px]">{e}</Badge>)}</div>
                </div>
              )}
              <p className="text-xs text-muted-foreground">~{result.word_count.toLocaleString()} words analyzed</p>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-center text-sm text-muted-foreground py-16">
              Paste or upload text, then click Analyze
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
