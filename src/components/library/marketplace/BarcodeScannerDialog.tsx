import { useEffect, useRef, useState } from "react";
import { ScanLine } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
};

type BarcodeWindow = Window & {
  BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike;
};

interface BarcodeScannerDialogProps {
  onDetected: (isbn: string) => void;
}

/**
 * Scans an ISBN barcode via the native BarcodeDetector Web API (Chrome/Edge/
 * Android only as of this writing — no polyfill added; unsupported browsers
 * see a plain "not supported" message rather than a broken camera view).
 */
export function BarcodeScannerDialog({ onDetected }: BarcodeScannerDialogProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const supported = typeof window !== "undefined" && "BarcodeDetector" in window;

  useEffect(() => {
    if (!open || !supported) return;

    let cancelled = false;
    const detector = new (window as BarcodeWindow).BarcodeDetector!({ formats: ["ean_13", "upc_a"] });

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }

        const scanLoop = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0) {
              onDetected(codes[0].rawValue);
              setOpen(false);
              return;
            }
          } catch {
            // Transient detection errors (e.g. frame not ready) — just retry next frame.
          }
          rafRef.current = requestAnimationFrame(() => void scanLoop());
        };
        void scanLoop();
      })
      .catch(() => setError(t("library.search.cameraDenied")));

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open, supported, onDetected, t]);

  if (!supported) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="icon" aria-label={t("library.search.scanBarcode")}>
          <ScanLine className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("library.search.scanBarcode")}</DialogTitle>
        </DialogHeader>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <video ref={videoRef} muted playsInline className="aspect-video w-full rounded-lg bg-muted object-cover" />
        )}
      </DialogContent>
    </Dialog>
  );
}
