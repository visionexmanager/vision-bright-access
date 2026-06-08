import { useState, useRef, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useVXWallet } from "@/hooks/useVXWallet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AnimatedSection, scaleFade } from "@/components/AnimatedSection";
import { OCR_PRICES, formatVX } from "@/systems/pricingSystem";
import {
  ScanText, Upload, Volume2, VolumeX, Copy, Download,
  FileText, Loader2, RotateCcw, Check, AlertCircle,
  Coins, Zap, Package, Layers, History, Trash2,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────
type OCRMode = "single" | "single_audio" | "pdf" | "bundle";
type ConfidenceLevel = "High" | "Medium" | "Low";

interface OCRResult {
  extracted_text: string;
  detected_language: string;
  confidence: ConfidenceLevel;
  word_count: number;
  has_handwriting: boolean;
}

interface HistoryEntry {
  id: string;
  fileName: string;
  text: string;
  language: string;
  confidence: ConfidenceLevel;
  wordCount: number;
  createdAt: string;
  mode: OCRMode;
}

// ── Helpers ──────────────────────────────────────────────────────────────
function speak(text: string, lang: string) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = lang === "ar" ? "ar-SA"
    : lang === "ur"  ? "ur-PK"
    : lang === "hi"  ? "hi-IN"
    : "en-US";
  utt.rate = 0.85;
  utt.volume = 1;
  window.speechSynthesis.speak(utt);
}

function stopSpeak() {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

function downloadTxt(text: string, fileName: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName.replace(/\.[^.]+$/, "") + "_ocr.txt";
  a.click();
  URL.revokeObjectURL(url);
}

const STORAGE_KEY = "vx_ocr_history";

function loadHistory(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, 20)));
  } catch {}
}

const CONFIDENCE_STYLE: Record<ConfidenceLevel, string> = {
  High:   "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30",
  Medium: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30",
  Low:    "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
};

// ── Component ─────────────────────────────────────────────────────────────
export default function OCRScan() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const { spendVX, balance } = useVXWallet();

  const [mode, setMode] = useState<OCRMode>("single");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<OCRResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [hint, setHint] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const [showHistory, setShowHistory] = useState(false);
  const [bundleUsed, setBundleUsed] = useState(0);
  const [bundleActive, setBundleActive] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const PACKAGES: { id: OCRMode; icon: React.ElementType; labelKey: string; descKey: string; price: number; badge?: string }[] = [
    { id: "single",       icon: ScanText,  labelKey: "ocr.pkgSingle",      descKey: "ocr.pkgSingleDesc",      price: OCR_PRICES.singleScan },
    { id: "single_audio", icon: Volume2,   labelKey: "ocr.pkgAudio",       descKey: "ocr.pkgAudioDesc",       price: OCR_PRICES.singleScanAudio },
    { id: "pdf",          icon: FileText,  labelKey: "ocr.pkgPdf",         descKey: "ocr.pkgPdfDesc",         price: OCR_PRICES.pdfDocument },
    { id: "bundle",       icon: Layers,    labelKey: "ocr.pkgBundle",      descKey: "ocr.pkgBundleDesc",      price: OCR_PRICES.bundleTen, badge: "ocr.bestValue" },
  ];

  const currentPrice = bundleActive ? 0 : PACKAGES.find(p => p.id === mode)?.price ?? OCR_PRICES.singleScan;

  // ── File handling ────────────────────────────────────────────────────
  const processFile = useCallback((file: File) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
    if (!allowed.includes(file.type)) {
      toast.error(t("ocr.errFileType"));
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error(t("ocr.errFileSize"));
      return;
    }
    if (file.type === "application/pdf" && mode !== "pdf") {
      setMode("pdf");
    }
    setFileName(file.name);
    setResult(null);

    if (file.type !== "application/pdf") {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  }, [mode, t]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  // ── Scan ─────────────────────────────────────────────────────────────
  const handleScan = async () => {
    if (!fileName) { toast.error(t("ocr.errNoFile")); return; }
    if (!user)      { toast.error(t("vx.loginRequired")); return; }

    // Determine price
    const price = bundleActive ? 0 : currentPrice;

    // Purchase bundle if selected and not yet active
    if (mode === "bundle" && !bundleActive) {
      const ok = await spendVX(OCR_PRICES.bundleTen, "ocr_bundle", t("ocr.pkgBundle"), "bundle");
      if (!ok) return;
      setBundleActive(true);
      setBundleUsed(0);
    } else if (!bundleActive && price > 0) {
      const ok = await spendVX(price, "ocr_scan", t("ocr.pkgSingle"), fileName);
      if (!ok) return;
    }

    setScanning(true);

    try {
      // Read file as base64
      const fileInput = fileRef.current?.files?.[0];
      let base64: string;

      if (fileInput) {
        base64 = await new Promise<string>((res, rej) => {
          const reader = new FileReader();
          reader.onload = () => res(reader.result as string);
          reader.onerror = rej;
          reader.readAsDataURL(fileInput);
        });
      } else if (previewUrl) {
        // If file was dropped, re-read from blob
        const resp = await fetch(previewUrl);
        const blob = await resp.blob();
        base64 = await new Promise<string>((res, rej) => {
          const reader = new FileReader();
          reader.onload = () => res(reader.result as string);
          reader.onerror = rej;
          reader.readAsDataURL(blob);
        });
      } else {
        toast.error(t("ocr.errNoFile"));
        setScanning(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("ocr-scan", {
        body: { image: base64, lang, hint },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "OCR failed");
      }

      const ocrResult: OCRResult = data.result;
      setResult(ocrResult);

      // Auto-speak if audio mode
      if (mode === "single_audio" || (bundleActive && mode === "single_audio")) {
        speak(ocrResult.extracted_text, lang);
        setIsSpeaking(true);
      }

      // Update bundle count
      if (bundleActive) {
        const newUsed = bundleUsed + 1;
        setBundleUsed(newUsed);
        if (newUsed >= 10) setBundleActive(false);
      }

      // Save to history
      const entry: HistoryEntry = {
        id: crypto.randomUUID(),
        fileName,
        text: ocrResult.extracted_text,
        language: ocrResult.detected_language,
        confidence: ocrResult.confidence,
        wordCount: ocrResult.word_count,
        createdAt: new Date().toISOString(),
        mode,
      };
      const updated = [entry, ...history];
      setHistory(updated);
      saveHistory(updated);

      toast.success(t("ocr.scanComplete"));
    } catch (e) {
      console.error(e);
      toast.error(t("ocr.errScanFailed"));
    } finally {
      setScanning(false);
    }
  };

  // ── Copy ─────────────────────────────────────────────────────────────
  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.extracted_text).then(() => {
      setCopied(true);
      toast.success(t("ocr.copied"));
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ── Reset ─────────────────────────────────────────────────────────────
  const handleReset = () => {
    setPreviewUrl(null);
    setFileName("");
    setResult(null);
    setHint("");
    setIsSpeaking(false);
    stopSpeak();
  };

  // ── Delete history ───────────────────────────────────────────────────
  const deleteHistoryEntry = (id: string) => {
    const updated = history.filter(h => h.id !== id);
    setHistory(updated);
    saveHistory(updated);
  };

  const isRtl = lang === "ar" || lang === "ur";

  return (
    <Layout>
      <section className="section-container py-10" aria-labelledby="ocr-heading">
        <AnimatedSection variants={scaleFade}>
          {/* Header */}
          <div className="mb-8 flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-3" aria-hidden="true">
                <ScanText className="h-8 w-8 text-primary" aria-hidden="true" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 id="ocr-heading" className="text-3xl font-bold">{t("ocr.title")}</h1>
                  <Badge className="text-xs">AI-Powered</Badge>
                </div>
                <p className="text-muted-foreground">{t("ocr.subtitle")}</p>
              </div>
            </div>

            {/* Balance + bundle status */}
            <div className="flex items-center gap-3 flex-wrap mt-1">
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <Coins className="h-4 w-4" aria-hidden="true" />
                {t("vx.balance") || "Balance:"} {formatVX(balance ?? 0)}
              </span>
              {bundleActive && (
                <Badge variant="secondary" className="text-xs">
                  <Zap className="h-3 w-3 me-1" aria-hidden="true" />
                  {t("ocr.bundleActive")} — {bundleUsed}/10
                </Badge>
              )}
            </div>
          </div>
        </AnimatedSection>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* ── Left: upload + options ───────────────────────────────── */}
          <div className="lg:col-span-1 space-y-6">

            {/* Package selector */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" aria-hidden="true" />
                  {t("ocr.choosePackage")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {PACKAGES.map(pkg => {
                  const Icon = pkg.icon;
                  const isSelected = mode === pkg.id;
                  return (
                    <button
                      key={pkg.id}
                      onClick={() => setMode(pkg.id)}
                      aria-pressed={isSelected}
                      className={`w-full rounded-lg border p-3 text-start transition-all ${
                        isSelected
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:border-primary/50 hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Icon className={`h-4 w-4 ${isSelected ? "text-primary" : "text-muted-foreground"}`} aria-hidden="true" />
                          <span className="text-sm font-semibold">{t(pkg.labelKey)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {pkg.badge && (
                            <Badge variant="default" className="text-xs px-1.5">{t(pkg.badge)}</Badge>
                          )}
                          <span className="text-xs font-bold text-primary">{formatVX(pkg.price)}</span>
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground ps-6">{t(pkg.descKey)}</p>
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            {/* Upload zone */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Upload className="h-4 w-4 text-primary" aria-hidden="true" />
                  {t("ocr.uploadTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  ref={dropRef}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  aria-label={t("ocr.uploadAriaLabel")}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileRef.current?.click()}
                  className="cursor-pointer rounded-xl border-2 border-dashed border-border p-6 text-center transition-colors hover:border-primary/50 hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt={t("ocr.previewAlt")}
                      className="mx-auto max-h-48 rounded-lg object-contain"
                    />
                  ) : fileName ? (
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="h-10 w-10 text-primary" aria-hidden="true" />
                      <p className="text-sm font-medium truncate max-w-full">{fileName}</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                      <p className="text-sm font-medium">{t("ocr.uploadHint")}</p>
                      <p className="text-xs text-muted-foreground">{t("ocr.uploadFormats")}</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                  className="hidden"
                  onChange={handleFileInput}
                  aria-label={t("ocr.fileInputAriaLabel")}
                />
                {fileName && (
                  <p className="mt-2 text-center text-xs text-muted-foreground truncate">{fileName}</p>
                )}
              </CardContent>
            </Card>

            {/* Optional hint */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-sm">{t("ocr.hintLabel")}</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={hint}
                  onChange={(e) => setHint(e.target.value)}
                  placeholder={t("ocr.hintPlaceholder")}
                  className={`resize-none text-sm ${isRtl ? "text-right" : "text-left"}`}
                  rows={2}
                  aria-label={t("ocr.hintLabel")}
                  maxLength={200}
                />
              </CardContent>
            </Card>

            {/* Action buttons */}
            <div className="flex flex-col gap-2">
              <Button
                onClick={handleScan}
                disabled={scanning || !fileName}
                className="w-full gap-2 text-base font-semibold"
                size="lg"
                aria-label={scanning ? t("ocr.scanning") : `${t("ocr.scanBtn")} — ${formatVX(bundleActive ? 0 : currentPrice)}`}
              >
                {scanning ? (
                  <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{t("ocr.scanning")}</>
                ) : (
                  <><ScanText className="h-4 w-4" aria-hidden="true" />
                    {t("ocr.scanBtn")}
                    <span className="ms-auto text-xs opacity-80">
                      {bundleActive ? t("ocr.free") : formatVX(currentPrice)}
                    </span>
                  </>
                )}
              </Button>
              {(fileName || result) && (
                <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1">
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  {t("ocr.reset")}
                </Button>
              )}
            </div>
          </div>

          {/* ── Right: results ──────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Empty state */}
            {!result && !scanning && (
              <Card className="flex min-h-[300px] items-center justify-center">
                <CardContent className="flex flex-col items-center gap-4 text-center p-10">
                  <div className="rounded-full bg-primary/10 p-5" aria-hidden="true">
                    <ScanText className="h-10 w-10 text-primary" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold">{t("ocr.readyTitle")}</p>
                    <p className="text-sm text-muted-foreground mt-1">{t("ocr.readyDesc")}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center text-xs text-muted-foreground">
                    {["JPG", "PNG", "WEBP", "PDF"].map(f => (
                      <Badge key={f} variant="outline">{f}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Scanning animation */}
            {scanning && (
              <Card className="flex min-h-[300px] items-center justify-center">
                <CardContent className="flex flex-col items-center gap-4 text-center p-10">
                  <div className="relative">
                    <div className="h-16 w-16 animate-spin rounded-full border-4 border-primary border-t-transparent" aria-hidden="true" />
                    <ScanText className="absolute inset-0 m-auto h-7 w-7 text-primary" aria-hidden="true" />
                  </div>
                  <p className="text-base font-semibold animate-pulse">{t("ocr.scanning")}</p>
                  <p className="text-sm text-muted-foreground">{t("ocr.scanningDesc")}</p>
                </CardContent>
              </Card>
            )}

            {/* Results */}
            {result && !scanning && (
              <div className="space-y-4" aria-live="polite" aria-label={t("ocr.resultsLabel")}>
                {/* Meta row */}
                <Card>
                  <CardContent className="flex flex-wrap items-center gap-3 p-4">
                    <Badge variant="outline" className={CONFIDENCE_STYLE[result.confidence]}>
                      <AlertCircle className="h-3 w-3 me-1" aria-hidden="true" />
                      {t("ocr.confidence")}: {result.confidence}
                    </Badge>
                    <Badge variant="secondary">
                      🌐 {result.detected_language}
                    </Badge>
                    <Badge variant="secondary">
                      📝 {result.word_count} {t("ocr.words")}
                    </Badge>
                    {result.has_handwriting && (
                      <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-600">
                        ✍️ {t("ocr.handwriting")}
                      </Badge>
                    )}
                  </CardContent>
                </Card>

                {/* Extracted text */}
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" aria-hidden="true" />
                        {t("ocr.extractedText")}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        {/* TTS */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (isSpeaking) { stopSpeak(); setIsSpeaking(false); }
                            else { speak(result.extracted_text, lang); setIsSpeaking(true); }
                          }}
                          aria-label={isSpeaking ? t("ocr.stopAudio") : t("ocr.listenText")}
                          className="gap-1"
                        >
                          {isSpeaking
                            ? <><VolumeX className="h-4 w-4" aria-hidden="true" />{t("ocr.stopAudio")}</>
                            : <><Volume2 className="h-4 w-4" aria-hidden="true" />{t("ocr.listenText")}</>
                          }
                        </Button>
                        {/* Copy */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCopy}
                          aria-label={t("ocr.copy")}
                          className="gap-1"
                        >
                          {copied
                            ? <><Check className="h-4 w-4 text-green-500" aria-hidden="true" />{t("ocr.copied")}</>
                            : <><Copy className="h-4 w-4" aria-hidden="true" />{t("ocr.copy")}</>
                          }
                        </Button>
                        {/* Download */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadTxt(result.extracted_text, fileName || "scan")}
                          aria-label={t("ocr.download")}
                          className="gap-1"
                        >
                          <Download className="h-4 w-4" aria-hidden="true" />
                          {t("ocr.download")}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={result.extracted_text}
                      readOnly
                      className={`min-h-[300px] resize-y font-mono text-sm leading-relaxed ${
                        result.detected_language.toLowerCase().includes("arabic") ||
                        result.detected_language.toLowerCase().includes("urdu")
                          ? "text-right"
                          : "text-left"
                      }`}
                      aria-label={t("ocr.extractedText")}
                      aria-readonly="true"
                    />
                  </CardContent>
                </Card>
              </div>
            )}

            {/* History */}
            {history.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <History className="h-4 w-4 text-primary" aria-hidden="true" />
                      {t("ocr.history")}
                      <Badge variant="secondary" className="text-xs">{history.length}</Badge>
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowHistory(h => !h)}
                      aria-expanded={showHistory}
                    >
                      {showHistory ? t("ocr.hideHistory") : t("ocr.showHistory")}
                    </Button>
                  </div>
                </CardHeader>
                {showHistory && (
                  <CardContent>
                    <ul className="divide-y" aria-label={t("ocr.history")}>
                      {history.map(entry => (
                        <li key={entry.id} className="py-3 flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{entry.fileName}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{entry.text}</p>
                            <div className="mt-1 flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-muted-foreground">
                                {new Date(entry.createdAt).toLocaleDateString()}
                              </span>
                              <Badge variant="outline" className="text-xs">{entry.language}</Badge>
                              <Badge variant="secondary" className="text-xs">{entry.wordCount} {t("ocr.words")}</Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setResult({
                                extracted_text: entry.text,
                                detected_language: entry.language,
                                confidence: entry.confidence,
                                word_count: entry.wordCount,
                                has_handwriting: false,
                              })}
                              aria-label={`${t("ocr.loadResult")}: ${entry.fileName}`}
                            >
                              <FileText className="h-4 w-4" aria-hidden="true" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => downloadTxt(entry.text, entry.fileName)}
                              aria-label={`${t("ocr.download")}: ${entry.fileName}`}
                            >
                              <Download className="h-4 w-4" aria-hidden="true" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteHistoryEntry(entry.id)}
                              aria-label={`${t("ocr.delete")}: ${entry.fileName}`}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                )}
              </Card>
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
}
