import { useRef, useState, type ReactNode } from "react";
import { Maximize, Minimize, ZoomIn, ZoomOut, Contrast } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ViewerFrameProps {
  title: string;
  children: (opts: { fontScale: number; highContrast: boolean }) => ReactNode;
  toolbarExtra?: ReactNode;
}

/**
 * Shared chrome for all resource viewers (PDF/Audio/Presentation/Document):
 * fullscreen toggle + basic accessibility controls (zoom, high contrast).
 * The actual rendering strategy is provided by each specific viewer via
 * the children render-prop, since a PDF iframe / <audio> / doc iframe all
 * need different bodies but the same surrounding controls.
 */
export function ViewerFrame({ title, children, toolbarExtra }: ViewerFrameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [fontScale, setFontScale] = useState(1);
  const [highContrast, setHighContrast] = useState(false);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      containerRef.current?.requestFullscreen?.().catch(() => {});
    }
  };

  return (
    <div
      ref={containerRef}
      className={`rounded-2xl border border-border overflow-hidden ${highContrast ? "bg-black" : "bg-card"}`}
    >
      <div className="flex items-center justify-between gap-2 p-3 border-b border-border flex-wrap">
        <h3 className={`font-bold text-sm truncate ${highContrast ? "text-white" : "text-foreground"}`}>{title}</h3>
        <div className="flex items-center gap-1">
          {toolbarExtra}
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setFontScale((s) => Math.max(0.75, s - 0.1))} aria-label="تصغير النص">
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setFontScale((s) => Math.min(1.6, s + 0.1))} aria-label="تكبير النص">
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button
            variant={highContrast ? "default" : "ghost"}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setHighContrast((v) => !v)}
            aria-pressed={highContrast}
            aria-label="تباين عالٍ"
          >
            <Contrast className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={toggleFullscreen} aria-label="ملء الشاشة">
            {document.fullscreenElement ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </Button>
        </div>
      </div>
      <div style={{ fontSize: `${fontScale}rem` }}>
        {children({ fontScale, highContrast })}
      </div>
    </div>
  );
}
