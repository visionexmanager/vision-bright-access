import { useRef, useState, useId, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useFileStudio } from "@/hooks/useFileStudio";
import { AnimatedSection } from "@/components/AnimatedSection";
import { toast } from "sonner";
import {
  Music, Video, Image, FileText, Archive, Code2, Sparkles,
  Upload, X, Download, Clock, CheckCircle, AlertCircle,
  Coins, Loader2, FolderOpen, RefreshCw, Info,
} from "lucide-react";
import type { ConversionJob, ModuleType, AnyFormat, ConversionOptions } from "@/lib/types/fileStudio";
import {
  AUDIO_FORMATS, VIDEO_FORMATS, IMAGE_FORMATS,
  DOCUMENT_FORMATS, ARCHIVE_FORMATS, DEVELOPER_FORMATS,
} from "@/lib/types/fileStudio";
import { calculateVxCost, formatVxCost } from "@/services/file-studio/pricing";
import { detectModuleType, getWorkingOutputFormats, fileSizeMb } from "@/services/file-studio/engine";
import { Link } from "react-router-dom";

// ── Module metadata ────────────────────────────────────────────────────────────

const MODULES: {
  id: ModuleType;
  label: string;
  icon: React.ElementType;
  color: string;
  formats: readonly string[];
  description: string;
}[] = [
  { id: "audio",     label: "Audio",     icon: Music,    color: "text-purple-500", formats: AUDIO_FORMATS,    description: "MP3, WAV, FLAC, AAC, OGG, M4A and more" },
  { id: "video",     label: "Video",     icon: Video,    color: "text-blue-500",   formats: VIDEO_FORMATS,    description: "MP4, AVI, MOV, MKV, WebM and more" },
  { id: "image",     label: "Image",     icon: Image,    color: "text-green-500",  formats: IMAGE_FORMATS,    description: "JPG, PNG, WebP, HEIC, AVIF and more" },
  { id: "document",  label: "Document",  icon: FileText, color: "text-amber-500",  formats: DOCUMENT_FORMATS, description: "PDF, DOCX, TXT, HTML, CSV and more" },
  { id: "archive",   label: "Archive",   icon: Archive,  color: "text-red-500",    formats: ARCHIVE_FORMATS,  description: "ZIP, TAR, GZ, 7Z, RAR" },
  { id: "developer", label: "Developer", icon: Code2,    color: "text-cyan-500",   formats: DEVELOPER_FORMATS,description: "JSON, XML, YAML, Base64, CSV ↔ JSON" },
  { id: "ai-tools",  label: "AI Tools",  icon: Sparkles, color: "text-pink-500",   formats: ["jpg","png","pdf","mp3"],description: "OCR, background removal, transcription" },
];

// ── Status helpers ─────────────────────────────────────────────────────────────

function statusIcon(status: ConversionJob["status"]) {
  if (status === "completed")  return <CheckCircle className="h-4 w-4 text-green-500" aria-hidden="true" />;
  if (status === "failed")     return <AlertCircle className="h-4 w-4 text-red-500"   aria-hidden="true" />;
  if (status === "processing") return <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />;
  if (status === "cancelled")  return <X className="h-4 w-4 text-muted-foreground"   aria-hidden="true" />;
  return <Clock className="h-4 w-4 text-amber-500" aria-hidden="true" />;
}

function statusLabel(status: ConversionJob["status"]): string {
  return { queued: "Queued", processing: "Processing…", completed: "Done", failed: "Failed", cancelled: "Cancelled" }[status];
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function FileStudio() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { jobs, plan, totalPoints, submitConversion, cancelJob } = useFileStudio();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef  = useRef<HTMLDivElement>(null);
  const liveRegionRef = useRef<HTMLDivElement>(null);

  const [selectedFile,   setSelectedFile]   = useState<File | null>(null);
  const [detectedModule, setDetectedModule] = useState<ModuleType | null>(null);
  const [targetFormat,   setTargetFormat]   = useState<AnyFormat | "">("");
  const [isDragging,     setIsDragging]     = useState(false);
  const [converting,     setConverting]     = useState(false);

  const uid = useId();
  const fileInputId    = `${uid}-file`;
  const formatSelectId = `${uid}-format`;
  const liveId         = `${uid}-live`;

  // Announce to screen readers
  const announce = (msg: string) => {
    if (liveRegionRef.current) liveRegionRef.current.textContent = msg;
  };

  // ── File selection ──────────────────────────────────────────────────────────

  const handleFile = useCallback((file: File) => {
    const mod = detectModuleType(file.name);
    if (!mod) {
      toast.error(`Unsupported file type: .${file.name.split(".").pop()}`);
      announce(`Error: unsupported file type ${file.name.split(".").pop()}`);
      return;
    }
    setSelectedFile(file);
    setDetectedModule(mod);
    setTargetFormat("");
    announce(`File selected: ${file.name}. Type: ${mod}. Choose output format.`);
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  // ── Drag-and-drop (keyboard-accessible upload is primary) ──────────────────

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);

  // Keyboard-activate drop zone (Enter/Space)
  const onDropZoneKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  };

  // ── Clear file ──────────────────────────────────────────────────────────────

  const clearFile = () => {
    setSelectedFile(null);
    setDetectedModule(null);
    setTargetFormat("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    announce("File cleared.");
  };

  // ── VX cost preview ─────────────────────────────────────────────────────────

  const previewCost = selectedFile && detectedModule && targetFormat
    ? calculateVxCost(detectedModule, targetFormat as AnyFormat, fileSizeMb(selectedFile))
    : null;

  // ── Submit conversion ────────────────────────────────────────────────────────

  const handleConvert = async () => {
    if (!selectedFile || !detectedModule || !targetFormat) return;

    if (!user) {
      toast.info("Sign in to convert files and track your history.");
      announce("Please sign in to use File Studio.");
      return;
    }

    setConverting(true);
    announce(`Starting conversion: ${selectedFile.name} to ${targetFormat.toUpperCase()}`);

    const options: ConversionOptions = { targetFormat } as ConversionOptions;
    const job = await submitConversion(selectedFile, targetFormat as AnyFormat, options);

    setConverting(false);
    if (job) {
      clearFile();
      announce(`Conversion job created. Status: queued.`);
    }
  };

  // ── Supported output formats for selected file ───────────────────────────────
  // Only formats that actually convert in-browser today — see engine.ts's
  // getWorkingOutputFormats() for why this differs from the nominal list.

  const outputFormats = selectedFile && detectedModule
    ? getWorkingOutputFormats(detectedModule, selectedFile.name)
    : [];

  // ── Active / history jobs ───────────────────────────────────────────────────

  const activeJobs = jobs.filter((j) => j.status === "queued" || j.status === "processing");
  const historyJobs = jobs.filter((j) => j.status === "completed" || j.status === "failed" || j.status === "cancelled");

  // ────────────────────────────────────────────────────────────────────────────

  return (
    <Layout>
      {/* ARIA live region for screen readers */}
      <div
        ref={liveRegionRef}
        id={liveId}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />

      <main id="main-content" className="section-container py-8 space-y-8">

        {/* ── Page header ── */}
        <AnimatedSection>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <FolderOpen className="h-6 w-6 text-primary" aria-hidden="true" />
                <h1 className="text-3xl font-bold tracking-tight">
                  {t("fileStudio.title") || "File Studio"}
                </h1>
                <Badge variant="secondary">Beta</Badge>
              </div>
              <p className="text-muted-foreground">
                {t("fileStudio.desc") || "Convert audio, video, images, documents and more — powered by VX."}
              </p>
            </div>

            {/* VX balance */}
            {user && (
              <Card className="flex items-center gap-3 px-4 py-3 shrink-0">
                <Coins className="h-5 w-5 text-amber-500" aria-hidden="true" />
                <div>
                  <p className="text-xs text-muted-foreground">VX Balance</p>
                  <p className="font-bold text-lg" aria-label={`${totalPoints.toLocaleString()} VX coins`}>
                    {totalPoints.toLocaleString()}
                    <span className="text-xs font-normal text-muted-foreground ml-1">VX</span>
                  </p>
                </div>
                <Badge variant={plan.priority === "priority" ? "default" : "outline"} className="text-xs">
                  {plan.priority === "priority" ? "VX Priority" : "Free"}
                </Badge>
              </Card>
            )}
          </div>
        </AnimatedSection>

        {/* ── Module overview chips ── */}
        <AnimatedSection>
          <section aria-labelledby="modules-heading">
            <h2 id="modules-heading" className="sr-only">Available conversion modules</h2>
            <div className="flex flex-wrap gap-2" role="list">
              {MODULES.map((m) => {
                const Icon = m.icon;
                return (
                  <div
                    key={m.id}
                    role="listitem"
                    title={m.description}
                    className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm"
                  >
                    <Icon className={`h-3.5 w-3.5 ${m.color}`} aria-hidden="true" />
                    <span>{m.label}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </AnimatedSection>

        {/* ── Main tabs ── */}
        <Tabs defaultValue="convert" className="space-y-6">
          <TabsList aria-label="File Studio sections">
            <TabsTrigger value="convert">Convert</TabsTrigger>
            <TabsTrigger value="queue">
              Queue
              {activeJobs.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-xs">{activeJobs.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="pricing">Pricing</TabsTrigger>
          </TabsList>

          {/* ── Convert tab ── */}
          <TabsContent value="convert">
            <div className="grid gap-6 lg:grid-cols-2">

              {/* Upload card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {t("fileStudio.uploadLabel") || "1. Upload Your File"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">

                  {/* Hidden file input — keyboard-first approach */}
                  <input
                    ref={fileInputRef}
                    id={fileInputId}
                    type="file"
                    className="sr-only"
                    aria-label="Upload a file to convert"
                    onChange={onFileChange}
                    accept={[
                      ...AUDIO_FORMATS, ...VIDEO_FORMATS, ...IMAGE_FORMATS,
                      ...DOCUMENT_FORMATS, ...ARCHIVE_FORMATS, ...DEVELOPER_FORMATS,
                    ].map((f) => `.${f}`).join(",")}
                  />

                  {!selectedFile ? (
                    /* Drop zone — also keyboard-activatable */
                    <div
                      ref={dropZoneRef}
                      role="button"
                      tabIndex={0}
                      aria-labelledby={fileInputId}
                      aria-label="Upload area. Press Enter or Space to choose a file, or drag and drop."
                      onDrop={onDrop}
                      onDragOver={onDragOver}
                      onDragLeave={onDragLeave}
                      onKeyDown={onDropZoneKey}
                      onClick={() => fileInputRef.current?.click()}
                      className={[
                        "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors cursor-pointer",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        isDragging
                          ? "border-primary bg-primary/5"
                          : "border-muted-foreground/30 hover:border-primary hover:bg-muted/40",
                      ].join(" ")}
                    >
                      <Upload className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
                      <div>
                        <p className="font-medium">Drop file here or</p>
                        <Button
                          variant="link"
                          className="h-auto p-0 text-primary"
                          onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                          aria-label="Browse for file to convert"
                        >
                          browse to upload
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Max {plan.maxFileSizeMb} MB · Audio, Video, Image, Document, Archive
                      </p>
                    </div>
                  ) : (
                    /* Selected file summary */
                    <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium truncate" title={selectedFile.name}>
                            {selectedFile.name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB ·{" "}
                            <span className="capitalize">{detectedModule}</span>
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={clearFile}
                          aria-label={`Remove ${selectedFile.name}`}
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>

                      {/* Format selector */}
                      {outputFormats.length > 0 ? (
                        <div>
                          <label htmlFor={formatSelectId} className="text-sm font-medium mb-1 block">
                            {t("fileStudio.selectFormat") || "Output format"}
                          </label>
                          <Select
                            value={targetFormat}
                            onValueChange={(v) => {
                              setTargetFormat(v as AnyFormat);
                              announce(`Output format selected: ${v.toUpperCase()}`);
                            }}
                          >
                            <SelectTrigger id={formatSelectId} aria-label="Select output format">
                              <SelectValue placeholder="Choose format…" />
                            </SelectTrigger>
                            <SelectContent>
                              {outputFormats.map((fmt) => (
                                <SelectItem key={fmt} value={fmt}>
                                  .{fmt.toUpperCase()}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <div role="alert" className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
                          <Info className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                          <span>
                            {detectedModule === "video" || detectedModule === "archive" || detectedModule === "ai-tools"
                              ? `${detectedModule === "video" ? "Video" : detectedModule === "archive" ? "Archive" : "AI Tools"} conversion requires server processing, which isn't available yet — converting this file would fail. Please check back soon.`
                              : "No output format is supported for this file type yet — converting it would fail. Please check back soon."}
                          </span>
                        </div>
                      )}

                      {/* VX cost preview */}
                      {previewCost !== null && (
                        <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-sm">
                          <Coins className="h-4 w-4 text-amber-500 shrink-0" aria-hidden="true" />
                          <span>
                            Cost: <strong>{formatVxCost(previewCost)}</strong>
                          </span>
                          {!user && (
                            <span className="text-muted-foreground">(sign in required)</span>
                          )}
                        </div>
                      )}

                      {/* Convert button */}
                      <Button
                        className="w-full"
                        disabled={!targetFormat || converting}
                        onClick={handleConvert}
                        aria-busy={converting}
                        aria-label={
                          targetFormat
                            ? `Convert ${selectedFile.name} to ${String(targetFormat).toUpperCase()}`
                            : "Select output format first"
                        }
                      >
                        {converting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                            Starting…
                          </>
                        ) : (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                            Convert Now
                          </>
                        )}
                      </Button>

                      {!user && (
                        <p className="text-center text-xs text-muted-foreground">
                          <Link to="/login" className="text-primary underline underline-offset-2">
                            Sign in
                          </Link>{" "}
                          to save history and earn VX rewards.
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Active jobs summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Active Conversions</CardTitle>
                </CardHeader>
                <CardContent>
                  {activeJobs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground gap-2">
                      <CheckCircle className="h-8 w-8" aria-hidden="true" />
                      <p className="text-sm">No active jobs — queue is clear</p>
                    </div>
                  ) : (
                    <ul role="list" className="space-y-3" aria-label="Active conversion jobs">
                      {activeJobs.map((job) => (
                        <JobCard key={job.id} job={job} onCancel={cancelJob} />
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── Queue tab ── */}
          <TabsContent value="queue">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Conversion Queue</CardTitle>
              </CardHeader>
              <CardContent>
                {jobs.length === 0 ? (
                  <EmptyState label="No jobs yet. Upload a file to get started." />
                ) : (
                  <ul role="list" className="space-y-3" aria-label="All conversion jobs">
                    {jobs.map((job) => (
                      <JobCard key={job.id} job={job} onCancel={cancelJob} />
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── History tab ── */}
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Conversion History</CardTitle>
              </CardHeader>
              <CardContent>
                {!user ? (
                  <div className="py-10 text-center text-muted-foreground">
                    <p className="text-sm">
                      <Link to="/login" className="text-primary underline underline-offset-2">
                        Sign in
                      </Link>{" "}
                      to view your conversion history.
                    </p>
                  </div>
                ) : historyJobs.length === 0 ? (
                  <EmptyState label="No completed jobs yet." />
                ) : (
                  <ul role="list" className="space-y-3" aria-label="Completed conversion jobs">
                    {historyJobs.map((job) => (
                      <JobCard key={job.id} job={job} onCancel={cancelJob} />
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Pricing tab ── */}
          <TabsContent value="pricing">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {MODULES.map((m) => {
                const Icon = m.icon;
                return (
                  <Card key={m.id} className="relative overflow-hidden">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-5 w-5 ${m.color}`} aria-hidden="true" />
                        <CardTitle className="text-sm">{m.label} Conversion</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="text-xs text-muted-foreground">{m.description}</p>
                      <div className="flex items-center gap-1 text-sm font-semibold">
                        <Coins className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
                        <span>
                          From{" "}
                          {formatVxCost(
                            m.id === "ai-tools" ? 500 :
                            m.id === "video"    ? 200 :
                            m.id === "document" ? 80  :
                            m.id === "audio"    ? 50  :
                            m.id === "archive"  ? 30  :
                            m.id === "image"    ? 20  : 10
                          )}
                        </span>
                        <span className="text-muted-foreground font-normal">per file</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        + 1 VX/MB · feature add-ons apply
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Plan comparison */}
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <PlanCard
                name="Free"
                badge="outline"
                points="Any balance"
                maxMb={50}
                daily={5}
                priority="Standard queue"
                color="text-muted-foreground"
              />
              <PlanCard
                name="VX Priority"
                badge="default"
                points="10,000+ VX"
                maxMb={500}
                daily={100}
                priority="Priority queue (3× faster)"
                color="text-primary"
              />
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
              <Info className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
              <p>Rate: 1,000 VX = $1 USD. Failed conversions are automatically refunded. VX can be earned by engaging with the platform or purchased in the <Link to="/coins-store" className="text-primary underline underline-offset-2">Coins Store</Link>.</p>
            </div>
          </TabsContent>
        </Tabs>

        {/* ── Accessibility note ── */}
        <AnimatedSection>
          <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground flex items-start gap-2">
            <Info className="h-4 w-4 shrink-0 mt-0.5 text-primary" aria-hidden="true" />
            <p>
              File Studio is fully keyboard navigable and screen-reader compatible (NVDA, JAWS, VoiceOver, TalkBack).
              All status changes are announced via live regions. Upload works without drag-and-drop.
            </p>
          </div>
        </AnimatedSection>
      </main>
    </Layout>
  );
}

// ── Job card component ─────────────────────────────────────────────────────────

function JobCard({ job, onCancel }: { job: ConversionJob; onCancel: (id: string) => void }) {
  return (
    <li
      className="rounded-xl border bg-card p-4 space-y-2"
      aria-label={`${job.inputFileName} to ${job.targetFormat.toUpperCase()}: ${statusLabel(job.status)}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {statusIcon(job.status)}
          <div className="min-w-0">
            <p className="text-sm font-medium truncate" title={job.inputFileName}>
              {job.inputFileName}
            </p>
            <p className="text-xs text-muted-foreground">
              → .{job.targetFormat.toUpperCase()} · {formatVxCost(job.vxCost)}
              {job.priority === "priority" && (
                <Badge variant="outline" className="ml-1 text-xs py-0">Priority</Badge>
              )}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {job.status === "completed" && job.resultUrl && (
            <Button
              variant="outline"
              size="sm"
              asChild
              aria-label={`Download converted file: ${job.inputFileName.split(".")[0]}.${job.targetFormat}`}
            >
              <a
                href={job.resultUrl}
                download={`${job.inputFileName.split(".").slice(0,-1).join(".")}.${job.targetFormat}`}
              >
                <Download className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                Download
              </a>
            </Button>
          )}
          {job.status === "queued" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onCancel(job.id)}
              aria-label={`Cancel job: ${job.inputFileName}`}
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {(job.status === "processing" || job.status === "queued") && (
        <div>
          <Progress
            value={job.progress}
            className="h-1.5"
            aria-label={`Conversion progress: ${job.progress}%`}
            aria-valuenow={job.progress}
            aria-valuemin={0}
            aria-valuemax={100}
          />
          <p className="text-xs text-muted-foreground mt-1" aria-live="polite" aria-atomic="true">
            {job.status === "processing" ? `${job.progress}% complete` : "Waiting in queue…"}
          </p>
        </div>
      )}

      {/* Error message */}
      {job.status === "failed" && job.errorMessage && (
        <p className="text-xs text-red-500 rounded bg-red-500/10 px-2 py-1" role="alert">
          {job.errorMessage}
        </p>
      )}

      {/* Processing time */}
      {job.status === "completed" && job.processingMs && (
        <p className="text-xs text-muted-foreground">
          Processed in {(job.processingMs / 1000).toFixed(2)}s ·{" "}
          {job.resultSize ? `${(job.resultSize / 1024).toFixed(1)} KB` : ""}
        </p>
      )}
    </li>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground gap-2">
      <FolderOpen className="h-10 w-10" aria-hidden="true" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

// ── Plan card ──────────────────────────────────────────────────────────────────

function PlanCard({
  name, badge, points, maxMb, daily, priority, color,
}: {
  name: string;
  badge: "default" | "outline";
  points: string;
  maxMb: number;
  daily: number;
  priority: string;
  color: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Badge variant={badge}>{name}</Badge>
          <span className="text-xs text-muted-foreground">{points}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        <p>Max file: <strong>{maxMb} MB</strong></p>
        <p>Daily limit: <strong>{daily} conversions</strong></p>
        <p className={color}>{priority}</p>
      </CardContent>
    </Card>
  );
}
