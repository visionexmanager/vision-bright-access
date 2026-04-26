import { useState, useRef, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AnimatedSection, scaleFade } from "@/components/AnimatedSection";
import {
  Camera, Upload, Volume2, VolumeX, Loader2, Eye,
  AlertTriangle, Users, FileText, MapPin, Lightbulb, ScanLine,
  RotateCcw, RefreshCw,
} from "lucide-react";

type RadarResult = {
  overview: string;
  objects: string[];
  text_detected: string;
  people: string;
  environment: string;
  safety_notes: string;
  accessibility_tip: string;
};

function speak(text: string, lang: string) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = lang === "ar" ? "ar-SA" : "en-US";
  utt.rate = 0.9;
  utt.volume = 1;
  window.speechSynthesis.speak(utt);
}

function stopSpeak() {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

export default function RadarAI() {
  const { lang } = useLanguage();

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<RadarResult | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const isAr = lang === "ar";

  const t = {
    title:       isAr ? "رادار الذكاء الاصطناعي" : "Radar AI",
    subtitle:    isAr ? "رؤية ذكية لعالمٍ بلا حواجز — صِف الصور بدقة للمكفوفين وضعاف البصر" : "Smart vision for a barrier-free world — describe any scene instantly for the blind",
    uploadPhoto: isAr ? "رفع صورة" : "Upload Photo",
    openCamera:  isAr ? "فتح الكاميرا" : "Open Camera",
    capture:     isAr ? "التقاط الصورة" : "Capture",
    closeCamera: isAr ? "إغلاق الكاميرا" : "Close Camera",
    analyzing:   isAr ? "جاري التحليل…" : "Analysing…",
    analyzeBtn:  isAr ? "حلّل الصورة" : "Analyse Image",
    reset:       isAr ? "صورة جديدة" : "New Image",
    listenAll:   isAr ? "استمع للتقرير كاملاً" : "Listen to Full Report",
    stop:        isAr ? "إيقاف" : "Stop",
    overview:    isAr ? "نظرة عامة" : "Overview",
    objects:     isAr ? "الأشياء المكتشفة" : "Detected Objects",
    text:        isAr ? "النصوص المكتوبة" : "Text Detected",
    people:      isAr ? "الأشخاص" : "People",
    environment: isAr ? "البيئة المحيطة" : "Environment",
    safety:      isAr ? "ملاحظات السلامة" : "Safety Notes",
    tip:         isAr ? "نصيحة الوصول" : "Accessibility Tip",
    noText:      isAr ? "لا يوجد نص مكتشف" : "No text detected",
    cameraErr:   isAr ? "تعذّر الوصول للكاميرا" : "Camera access denied",
    dragHint:    isAr ? "أو اسحب وأفلت صورة هنا" : "or drag & drop an image here",
    readyHint:   isAr ? "ارفع صورة أو استخدم الكاميرا للبدء" : "Upload a photo or use the camera to begin",
  };

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error(isAr ? "يرجى اختيار ملف صورة" : "Please select an image file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error(isAr ? "حجم الصورة يتجاوز 10 ميغابايت" : "Image exceeds 10 MB");
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setResult(null);
    setAnalyzing(true);

    try {
      const base64 = await new Promise<string>((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result as string);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke("radar-ai", {
        body: { image: base64, lang },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message);
      }

      setResult(data.analysis as RadarResult);
      speak(data.analysis.overview, lang);
    } catch (err) {
      console.error(err);
      toast.error(isAr ? "فشل التحليل. حاول مجدداً." : "Analysis failed. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  }, [lang, isAr]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const openCamera = async () => {
    setCameraError(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraActive(true);
    } catch {
      setCameraError(true);
      toast.error(t.cameraErr);
    }
  };

  const closeCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      if (blob) {
        closeCamera();
        processFile(new File([blob], "capture.jpg", { type: "image/jpeg" }));
      }
    }, "image/jpeg", 0.9);
  };

  const speakAll = () => {
    if (!result) return;
    const full = [
      result.overview,
      isAr ? `الأشياء: ${result.objects.join("، ")}` : `Objects: ${result.objects.join(", ")}`,
      isAr ? `النصوص: ${result.text_detected}` : `Text: ${result.text_detected}`,
      isAr ? `الأشخاص: ${result.people}` : `People: ${result.people}`,
      isAr ? `البيئة: ${result.environment}` : `Environment: ${result.environment}`,
      isAr ? `السلامة: ${result.safety_notes}` : `Safety: ${result.safety_notes}`,
      isAr ? `نصيحة: ${result.accessibility_tip}` : `Tip: ${result.accessibility_tip}`,
    ].join(". ");
    setIsSpeaking(true);
    speak(full, lang);
    const utt = new SpeechSynthesisUtterance(full);
    utt.onend = () => setIsSpeaking(false);
  };

  const handleStopSpeak = () => {
    stopSpeak();
    setIsSpeaking(false);
  };

  const reset = () => {
    setPreviewUrl(null);
    setResult(null);
    setIsSpeaking(false);
    stopSpeak();
    closeCamera();
  };

  return (
    <Layout>
      <section className="mx-auto max-w-4xl px-4 py-10">
        {/* Header */}
        <AnimatedSection variants={scaleFade} className="mb-8 text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
            <ScanLine className="h-9 w-9 text-primary" />
          </div>
          <h1 className="text-4xl font-bold">{t.title}</h1>
          <p className="mt-2 text-lg text-muted-foreground max-w-2xl mx-auto">{t.subtitle}</p>
          <div className="flex justify-center gap-2 mt-3 flex-wrap">
            <Badge variant="secondary">🤖 GPT-4o Vision</Badge>
            <Badge variant="secondary">🔊 {isAr ? "تحليل صوتي" : "Audio Description"}</Badge>
            <Badge variant="secondary">📷 {isAr ? "كاميرا مباشرة" : "Live Camera"}</Badge>
            <Badge variant="secondary">♿ {isAr ? "إمكانية الوصول" : "Accessible"}</Badge>
          </div>
        </AnimatedSection>

        {/* Camera view */}
        {cameraActive && (
          <AnimatedSection className="mb-6">
            <Card className="overflow-hidden border-2 border-primary">
              <CardContent className="p-0 relative">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full max-h-80 object-cover bg-black"
                  aria-label={isAr ? "بث الكاميرا المباشر" : "Live camera feed"}
                />
                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3">
                  <Button onClick={capturePhoto} size="lg" className="gap-2 shadow-lg">
                    <Camera className="h-5 w-5" />
                    {t.capture}
                  </Button>
                  <Button onClick={closeCamera} variant="outline" size="lg" className="shadow-lg bg-background/90">
                    <RotateCcw className="h-4 w-4 mr-1" />
                    {t.closeCamera}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </AnimatedSection>
        )}

        <canvas ref={canvasRef} className="hidden" />

        {/* Upload / Actions */}
        {!cameraActive && !previewUrl && (
          <AnimatedSection className="mb-6">
            <div
              className="border-2 border-dashed border-border rounded-2xl p-10 text-center cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-all"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              role="button"
              tabIndex={0}
              aria-label={isAr ? "منطقة رفع الصورة" : "Image upload area"}
              onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}
            >
              <Eye className="h-14 w-14 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-lg font-semibold mb-1">{t.readyHint}</p>
              <p className="text-sm text-muted-foreground">{t.dragHint}</p>
            </div>

            <div className="flex gap-3 mt-4 justify-center flex-wrap">
              <Button size="lg" onClick={() => fileRef.current?.click()} className="gap-2">
                <Upload className="h-5 w-5" />
                {t.uploadPhoto}
              </Button>
              <Button size="lg" variant="outline" onClick={openCamera} className="gap-2">
                <Camera className="h-5 w-5" />
                {t.openCamera}
              </Button>
            </div>

            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </AnimatedSection>
        )}

        {/* Preview + Analyse */}
        {previewUrl && !analyzing && !result && (
          <AnimatedSection className="mb-6">
            <Card className="overflow-hidden">
              <CardContent className="p-0 relative">
                <img src={previewUrl} alt="" className="w-full max-h-80 object-contain bg-muted" />
              </CardContent>
            </Card>
            <div className="flex gap-3 mt-4 justify-center">
              <Button size="lg" onClick={() => processFile(dataURLtoFile(previewUrl, "image.jpg"))} className="gap-2">
                <ScanLine className="h-5 w-5" />
                {t.analyzeBtn}
              </Button>
              <Button size="lg" variant="outline" onClick={reset} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                {t.reset}
              </Button>
            </div>
          </AnimatedSection>
        )}

        {/* Analyzing spinner */}
        {analyzing && (
          <AnimatedSection className="mb-6">
            {previewUrl && (
              <img src={previewUrl} alt="" className="w-full max-h-60 object-contain rounded-xl bg-muted mb-4" />
            )}
            <Card className="border-primary">
              <CardContent className="p-8 text-center space-y-3">
                <Loader2 className="h-10 w-10 mx-auto text-primary animate-spin" />
                <p className="font-semibold text-lg">{t.analyzing}</p>
                <p className="text-sm text-muted-foreground">
                  {isAr ? "GPT-4o يحلل الصورة بدقة عالية…" : "GPT-4o is analysing the image at high detail…"}
                </p>
              </CardContent>
            </Card>
          </AnimatedSection>
        )}

        {/* Results */}
        {result && !analyzing && (
          <AnimatedSection className="space-y-4">
            {previewUrl && (
              <div className="relative rounded-2xl overflow-hidden">
                <img src={previewUrl} alt="" className="w-full max-h-56 object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
                  <p className="font-bold text-lg leading-snug">{result.overview}</p>
                  <div className="flex gap-2 shrink-0">
                    {isSpeaking ? (
                      <Button size="sm" variant="secondary" onClick={handleStopSpeak} className="gap-1">
                        <VolumeX className="h-4 w-4" />{t.stop}
                      </Button>
                    ) : (
                      <Button size="sm" onClick={speakAll} className="gap-1">
                        <Volume2 className="h-4 w-4" />{t.listenAll}
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={reset} className="gap-1 bg-background/80">
                      <RefreshCw className="h-3.5 w-3.5" />{t.reset}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Objects */}
            <Card>
              <CardContent className="p-5">
                <h3 className="font-bold flex items-center gap-2 mb-3">
                  <Eye className="h-5 w-5 text-primary" />{t.objects}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {result.objects.map((obj, i) => (
                    <Badge key={i} variant="secondary" className="text-sm py-1 px-3">{obj}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Text Detected */}
            <Card>
              <CardContent className="p-5">
                <h3 className="font-bold flex items-center gap-2 mb-2">
                  <FileText className="h-5 w-5 text-blue-500" />{t.text}
                </h3>
                <p className="text-sm leading-relaxed">
                  {result.text_detected || t.noText}
                </p>
              </CardContent>
            </Card>

            {/* People + Environment */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardContent className="p-5">
                  <h3 className="font-bold flex items-center gap-2 mb-2">
                    <Users className="h-5 w-5 text-green-500" />{t.people}
                  </h3>
                  <p className="text-sm leading-relaxed">{result.people}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <h3 className="font-bold flex items-center gap-2 mb-2">
                    <MapPin className="h-5 w-5 text-orange-500" />{t.environment}
                  </h3>
                  <p className="text-sm leading-relaxed">{result.environment}</p>
                </CardContent>
              </Card>
            </div>

            {/* Safety Notes */}
            {result.safety_notes && result.safety_notes.toLowerCase() !== "none" && result.safety_notes !== "لا يوجد" && (
              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardContent className="p-5">
                  <h3 className="font-bold flex items-center gap-2 mb-2 text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-5 w-5" />{t.safety}
                  </h3>
                  <p className="text-sm leading-relaxed">{result.safety_notes}</p>
                </CardContent>
              </Card>
            )}

            {/* Accessibility Tip */}
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-5">
                <h3 className="font-bold flex items-center gap-2 mb-2 text-primary">
                  <Lightbulb className="h-5 w-5" />{t.tip}
                </h3>
                <p className="text-sm leading-relaxed">{result.accessibility_tip}</p>
              </CardContent>
            </Card>

            {/* Listen per section */}
            <div className="flex flex-wrap gap-2 pt-2">
              {(
                [
                  ["overview",    result.overview],
                  ["safety",      result.safety_notes],
                  ["tip",         result.accessibility_tip],
                ] as [keyof typeof t, string][]
              ).map(([key, val]) => (
                <Button
                  key={key}
                  size="sm"
                  variant="outline"
                  className="gap-1 text-xs"
                  onClick={() => speak(val, lang)}
                >
                  <Volume2 className="h-3.5 w-3.5" />
                  {t[key as keyof typeof t]}
                </Button>
              ))}
            </div>
          </AnimatedSection>
        )}
      </section>
    </Layout>
  );
}

function dataURLtoFile(dataUrl: string, filename: string): File {
  const arr = dataUrl.split(",");
  const mime = arr[0].match(/:(.*?);/)?.[1] ?? "image/jpeg";
  const bstr = atob(arr[1]);
  const u8arr = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
  return new File([u8arr], filename, { type: mime });
}
