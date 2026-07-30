import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Eraser, Undo2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

const COLORS = ["#000000", "#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#ffffff"];
const SIZES = [3, 6, 12, 20];

export interface CanvasDrawingEngineHandle {
  toDataUrl: () => string;
  clear: () => void;
}

interface Stroke {
  points: { x: number; y: number }[];
  color: string;
  size: number;
}

interface CanvasDrawingEngineProps {
  width?: number;
  height?: number;
  className?: string;
  onChange?: (strokeCount: number) => void;
}

/** Reusable free-drawing canvas — powers Drawing Studio and Sticker Maker. */
export const CanvasDrawingEngine = forwardRef<CanvasDrawingEngineHandle, CanvasDrawingEngineProps>(
  ({ width = 480, height = 360, className, onChange }, ref) => {
    const { t } = useLanguage();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [color, setColor] = useState(COLORS[0]);
    const [size, setSize] = useState(SIZES[1]);
    const [erasing, setErasing] = useState(false);
    const strokesRef = useRef<Stroke[]>([]);
    const drawingRef = useRef(false);

    const redraw = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (const stroke of strokesRef.current) {
        if (stroke.points.length < 2) continue;
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.size;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (const p of stroke.points.slice(1)) ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
    };

    useEffect(() => { redraw(); }, []);

    useImperativeHandle(ref, () => ({
      toDataUrl: () => canvasRef.current?.toDataURL("image/png") ?? "",
      clear: () => { strokesRef.current = []; redraw(); onChange?.(0); },
    }));

    const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current!.getBoundingClientRect();
      const scaleX = canvasRef.current!.width / rect.width;
      const scaleY = canvasRef.current!.height / rect.height;
      return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
    };

    const startStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
      drawingRef.current = true;
      strokesRef.current.push({ points: [getPos(e)], color: erasing ? "#ffffff" : color, size: erasing ? size * 2 : size });
    };

    const moveStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current) return;
      strokesRef.current[strokesRef.current.length - 1].points.push(getPos(e));
      redraw();
    };

    const endStroke = () => {
      if (!drawingRef.current) return;
      drawingRef.current = false;
      onChange?.(strokesRef.current.length);
    };

    const undo = () => {
      strokesRef.current.pop();
      redraw();
      onChange?.(strokesRef.current.length);
    };

    return (
      <div className={className}>
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          onPointerDown={startStroke}
          onPointerMove={moveStroke}
          onPointerUp={endStroke}
          onPointerLeave={endStroke}
          className="touch-none rounded-xl border-2 border-border bg-white"
          role="img"
          aria-label={t("kids.studio.drawingCanvas")}
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div role="group" aria-label={t("kids.studio.colors")} className="flex gap-1">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => { setColor(c); setErasing(false); }}
                aria-label={c}
                aria-pressed={!erasing && color === c}
                className={`h-7 w-7 rounded-full border-2 ${!erasing && color === c ? "border-kids-primary" : "border-border"}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div role="group" aria-label={t("kids.studio.brushSize")} className="flex gap-1">
            {SIZES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSize(s)}
                aria-pressed={size === s}
                aria-label={`${s}px`}
                className={`flex h-7 w-7 items-center justify-center rounded-lg border-2 ${size === s ? "border-kids-primary bg-kids-primary/10" : "border-border"}`}
              >
                <span className="rounded-full bg-foreground" style={{ width: s / 2, height: s / 2 }} />
              </button>
            ))}
          </div>
          <Button variant={erasing ? "default" : "outline"} size="icon" onClick={() => setErasing((v) => !v)} aria-pressed={erasing} aria-label={t("kids.studio.eraser")}>
            <Eraser className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button variant="outline" size="icon" onClick={undo} aria-label={t("kids.studio.undo")}>
            <Undo2 className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => { strokesRef.current = []; redraw(); onChange?.(0); }}
            aria-label={t("kids.studio.clearCanvas")}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    );
  }
);

CanvasDrawingEngine.displayName = "CanvasDrawingEngine";
