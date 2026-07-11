import { useState, useCallback } from "react";
import {
  Wrench, Code2, PenLine, FileUser, Presentation as PresentationIcon,
  Image as ImageIcon, QrCode, Loader2, AlertCircle, Copy, Download, Wand2, Palette,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { StudioLayout } from "./StudioLayout";
import { cn } from "@/lib/utils";
import {
  callTextToolsGenerate, callImageGenerate,
  type FreeformToolResult, type DocumentToolResult, type TextTool,
} from "@/lib/api/edgeFunctions";
import { useLanguage } from "@/contexts/LanguageContext";

type ToolId = TextTool | "logo" | "icon" | "qr";

const TOOLS: { id: ToolId; label: string; icon: React.ElementType; placeholder: string }[] = [
  { id: "code",         label: "Code Generator",       icon: Code2,          placeholder: "Describe the function, script, or component you need…" },
  { id: "writing",      label: "Writing Assistant",     icon: PenLine,        placeholder: "Describe what you want written (email, article, essay)…" },
  { id: "resume",       label: "Resume Builder",        icon: FileUser,       placeholder: "Describe your background, role, and target job…" },
  { id: "presentation", label: "Presentation Generator", icon: PresentationIcon, placeholder: "Describe the presentation topic and audience…" },
  { id: "logo",         label: "Logo Generator",        icon: Palette,        placeholder: "Describe your brand and desired logo style…" },
  { id: "icon",         label: "Icon Generator",        icon: ImageIcon,      placeholder: "Describe the icon you need (e.g. 'a shopping cart icon')…" },
  { id: "qr",           label: "QR Generator",          icon: QrCode,         placeholder: "Enter a URL or text to encode…" },
];

export default function TextToolsStudio() {
  const [activeTool, setActiveTool] = useState<ToolId>("code");
  const { lang } = useLanguage();
  const activeMeta = TOOLS.find((t) => t.id === activeTool)!;

  return (
    <StudioLayout>
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-6 py-4 border-b shrink-0">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Wrench className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">Text Tools Studio</h1>
            <p className="text-xs text-muted-foreground">Code · Writing · Resume · Presentation · Logo · Icon · QR</p>
          </div>
          <Badge variant="secondary" className="ml-2 text-[10px]">Beta</Badge>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <nav className="w-52 shrink-0 border-r py-3 px-2 space-y-0.5 overflow-y-auto" aria-label="Text tools">
            {TOOLS.map((tool) => {
              const Icon = tool.icon;
              return (
                <button
                  key={tool.id}
                  onClick={() => setActiveTool(tool.id)}
                  aria-current={activeTool === tool.id ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 w-full rounded-lg px-3 py-2.5 text-sm text-left transition-colors",
                    activeTool === tool.id ? "bg-primary/10 text-primary font-medium" : "text-foreground/80 hover:bg-muted"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {tool.label}
                </button>
              );
            })}
          </nav>

          <div className="flex-1 overflow-y-auto">
            {activeTool === "code" || activeTool === "writing" ? (
              <FreeformPanel tool={activeTool} label={activeMeta.label} placeholder={activeMeta.placeholder} lang={lang} />
            ) : activeTool === "resume" || activeTool === "presentation" ? (
              <DocumentToolPanel tool={activeTool} label={activeMeta.label} placeholder={activeMeta.placeholder} lang={lang} />
            ) : activeTool === "logo" || activeTool === "icon" ? (
              <ImagePromptPanel tool={activeTool} label={activeMeta.label} placeholder={activeMeta.placeholder} />
            ) : (
              <QRPanel />
            )}
          </div>
        </div>
      </div>
    </StudioLayout>
  );
}

// ── Code Generator / Writing Assistant ─────────────────────────────────────

function FreeformPanel({ tool, label, placeholder, lang }: { tool: "code" | "writing"; label: string; placeholder: string; lang: string }) {
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<"idle" | "running" | "done" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FreeformToolResult | null>(null);

  const run = useCallback(async () => {
    if (!prompt.trim()) return;
    setStatus("running");
    setError(null);
    try {
      const res = await callTextToolsGenerate({ tool, prompt: prompt.trim(), language: lang });
      setResult(res.result as FreeformToolResult);
      setStatus("done");
      toast.success(`${label} complete`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Generation failed";
      setError(msg);
      setStatus("failed");
      toast.error(msg);
    }
  }, [tool, prompt, lang, label]);

  const copy = () => { if (result) { navigator.clipboard.writeText(result.content); toast.success("Copied"); } };
  const download = () => {
    if (!result) return;
    const ext = tool === "code" ? "txt" : "txt";
    const blob = new Blob([result.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${tool}-output.${ext}`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <h2 className="text-sm font-semibold">{label}</h2>
      <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={placeholder} className="min-h-[140px]" aria-label={label} />
      <Button className="gap-2" disabled={!prompt.trim() || status === "running"} onClick={run}>
        {status === "running" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
        {status === "running" ? "Generating…" : "Generate"}
      </Button>

      {status === "failed" && error && (
        <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /><span>{error}</span>
        </div>
      )}

      {result && (
        <div className="rounded-xl border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-[10px]">{result.language}</Badge>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={copy}><Copy className="h-3.5 w-3.5" /> Copy</Button>
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={download}><Download className="h-3.5 w-3.5" /> Download</Button>
            </div>
          </div>
          <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed max-h-[420px] overflow-y-auto">{result.content}</pre>
          {result.notes && <p className="text-xs text-muted-foreground border-t pt-2">{result.notes}</p>}
        </div>
      )}
    </div>
  );
}

// ── Resume Builder / Presentation Generator ─────────────────────────────────

function DocumentToolPanel({ tool, label, placeholder, lang }: { tool: "resume" | "presentation"; label: string; placeholder: string; lang: string }) {
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<"idle" | "running" | "done" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DocumentToolResult | null>(null);

  const run = useCallback(async () => {
    if (!prompt.trim()) return;
    setStatus("running");
    setError(null);
    try {
      const res = await callTextToolsGenerate({ tool, prompt: prompt.trim(), language: lang });
      setResult(res.result as DocumentToolResult);
      setStatus("done");
      toast.success(`${label} complete`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Generation failed";
      setError(msg);
      setStatus("failed");
      toast.error(msg);
    }
  }, [tool, prompt, lang, label]);

  const downloadPdf = async () => {
    if (!result) return;
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    const margin = 20;
    let y = 22;

    doc.setFontSize(20);
    doc.setTextColor(16, 42, 67);
    doc.text(result.title, margin, y);
    y += 9;

    if (result.subtitle) {
      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.text(result.subtitle, margin, y);
      y += 10;
    } else {
      y += 4;
    }

    for (const section of result.sections) {
      if (y > 265) { doc.addPage(); y = 20; }
      doc.setFontSize(13);
      doc.setTextColor(16, 185, 129);
      doc.text(section.heading, margin, y);
      y += 8;

      doc.setFontSize(10.5);
      doc.setTextColor(40, 40, 40);
      for (const bullet of section.bullets) {
        if (y > 275) { doc.addPage(); y = 20; }
        const lines = doc.splitTextToSize(`•  ${bullet}`, 170) as string[];
        for (const line of lines) {
          if (y > 275) { doc.addPage(); y = 20; }
          doc.text(line, margin + 2, y);
          y += 6;
        }
      }
      y += 4;
    }

    doc.save(`${tool}-${result.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <h2 className="text-sm font-semibold">{label}</h2>
      <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={placeholder} className="min-h-[140px]" aria-label={label} />
      <Button className="gap-2" disabled={!prompt.trim() || status === "running"} onClick={run}>
        {status === "running" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
        {status === "running" ? "Generating…" : "Generate"}
      </Button>

      {status === "failed" && error && (
        <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /><span>{error}</span>
        </div>
      )}

      {result && (
        <div className="rounded-xl border p-4 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-bold">{result.title}</h3>
              {result.subtitle && <p className="text-sm text-muted-foreground">{result.subtitle}</p>}
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={downloadPdf}>
              <Download className="h-3.5 w-3.5" /> Download PDF
            </Button>
          </div>
          <div className="space-y-3 max-h-[420px] overflow-y-auto">
            {result.sections.map((section, i) => (
              <div key={i}>
                <h4 className="text-sm font-semibold text-primary">{section.heading}</h4>
                <ul className="list-disc list-inside text-sm space-y-0.5 mt-1">
                  {section.bullets.map((b, j) => <li key={j}>{b}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Logo / Icon Generator (reuses image-generate) ────────────────────────────

function ImagePromptPanel({ tool, label, placeholder }: { tool: "logo" | "icon"; label: string; placeholder: string }) {
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<"idle" | "running" | "done" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (!prompt.trim()) return;
    setStatus("running");
    setError(null);
    try {
      const styledPrompt = tool === "logo"
        ? `Minimalist, professional vector logo design: ${prompt.trim()}. Clean lines, simple color palette, on a plain white background, no text unless specified.`
        : `Simple flat icon, vector style: ${prompt.trim()}. Centered, minimal detail, solid colors, on a plain white or transparent-looking background.`;
      const res = await callImageGenerate({ prompt: styledPrompt, model: "dall-e-3", size: "1024x1024", style: "natural" });
      setImageUrl(res.image_url);
      setStatus("done");
      toast.success(`${label} complete`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Generation failed";
      setError(msg);
      setStatus("failed");
      toast.error(msg);
    }
  }, [tool, prompt, label]);

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <h2 className="text-sm font-semibold">{label}</h2>
      <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={placeholder} className="min-h-[100px]" aria-label={label} />
      <Button className="gap-2" disabled={!prompt.trim() || status === "running"} onClick={run}>
        {status === "running" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
        {status === "running" ? "Generating…" : "Generate"}
      </Button>

      {status === "failed" && error && (
        <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /><span>{error}</span>
        </div>
      )}

      {imageUrl && (
        <div className="rounded-xl border p-4 space-y-3">
          <img src={imageUrl} alt={`Generated ${tool}`} className="w-full max-w-sm mx-auto rounded-lg" />
          <Button variant="outline" size="sm" className="gap-1.5 w-fit mx-auto flex" asChild>
            <a href={imageUrl} download={`${tool}.png`} target="_blank" rel="noreferrer">
              <Download className="h-3.5 w-3.5" /> Download
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}

// ── QR Generator (client-side, keyless public API — no AI needed) ───────────

function QRPanel() {
  const [text, setText] = useState("");
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const generate = () => {
    if (!text.trim()) return;
    setQrUrl(`https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(text.trim())}`);
  };

  const download = async () => {
    if (!qrUrl) return;
    setDownloading(true);
    try {
      const res = await fetch(qrUrl);
      if (!res.ok) throw new Error(`QR image request failed (HTTP ${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "qr-code.png"; a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to download QR code");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="p-6 max-w-lg mx-auto space-y-4">
      <h2 className="text-sm font-semibold">QR Generator</h2>
      <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="https://example.com or any text" aria-label="Text or URL to encode" />
      <Button className="gap-2" disabled={!text.trim()} onClick={generate}>
        <QrCode className="h-4 w-4" /> Generate QR Code
      </Button>

      {qrUrl && (
        <div className="rounded-xl border p-4 flex flex-col items-center gap-3">
          <img src={qrUrl} alt={`QR code for: ${text}`} className="rounded-lg border" width={240} height={240} />
          <Button variant="outline" size="sm" className="gap-1.5" onClick={download} disabled={downloading}>
            {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Download PNG
          </Button>
        </div>
      )}
    </div>
  );
}
