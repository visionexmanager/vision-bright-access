/**
 * CourseMediaUploader — real file upload to Supabase Storage (Phase 1 backend)
 * for course cover images and lesson video/audio/PDF/presentation files, with
 * a real byte-progress bar (XHR against the Storage REST endpoint — the
 * supabase-js client itself doesn't expose upload progress) and retry.
 */

import { useCallback, useRef, useState } from "react";
import { UploadCloud, X, RotateCcw, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/contexts/LanguageContext";

type UploadBucket = "academy-course-media" | "academy-course-files";
type UploadState = "idle" | "uploading" | "error" | "done";

export interface CourseMediaUploaderProps {
  bucket: UploadBucket;
  /** Folder prefix, e.g. `${instructorId}/${courseId}` — scopes files per course. */
  pathPrefix: string;
  accept: string;
  label: string;
  currentUrl?: string | null;
  onUploaded: (url: string) => void;
  onCleared?: () => void;
}

function uploadWithProgress(bucket: string, path: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      reject(new Error("يجب تسجيل الدخول لرفع الملفات"));
      return;
    }
    const baseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
    const url = `${baseUrl}/storage/v1/object/${bucket}/${encodeURI(path)}`;

    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", anonKey);
    xhr.setRequestHeader("x-upsert", "true");
    if (file.type) xhr.setRequestHeader("Content-Type", file.type);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`فشل الرفع (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("فشل الرفع — تحقق من الاتصال"));
    xhr.send(file);
  });
}

export function CourseMediaUploader({
  bucket,
  pathPrefix,
  accept,
  label,
  currentUrl,
  onUploaded,
  onCleared,
}: CourseMediaUploaderProps) {
  const { language } = useLanguage();
  const isRTL = language === "ar";
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>(currentUrl ? "done" : "idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const pendingFileRef = useRef<File | null>(null);

  const runUpload = useCallback(
    async (file: File) => {
      pendingFileRef.current = file;
      setFileName(file.name);
      setState("uploading");
      setProgress(0);
      setError(null);

      const ext = file.name.split(".").pop() || "bin";
      const path = `${pathPrefix}/${crypto.randomUUID()}.${ext}`;

      try {
        await uploadWithProgress(bucket, path, file, setProgress);
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        setState("done");
        onUploaded(data.publicUrl);
      } catch (err) {
        setState("error");
        setError((err as Error).message);
      }
    },
    [bucket, pathPrefix, onUploaded]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void runUpload(file);
  };

  const handleRetry = () => {
    if (pendingFileRef.current) void runUpload(pendingFileRef.current);
  };

  const handleClear = () => {
    setState("idle");
    setProgress(0);
    setError(null);
    setFileName(null);
    pendingFileRef.current = null;
    if (inputRef.current) inputRef.current.value = "";
    onCleared?.();
  };

  return (
    <div className="space-y-2" dir={isRTL ? "rtl" : "ltr"}>
      <input ref={inputRef} type="file" accept={accept} onChange={handleFileChange} className="sr-only" id={`uploader-${pathPrefix}-${label}`} />

      {state === "idle" && (
        <label
          htmlFor={`uploader-${pathPrefix}-${label}`}
          className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border p-6 text-center hover:border-primary focus-visible:ring-2 focus-visible:ring-primary"
        >
          <UploadCloud className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          <span className="text-sm font-medium">{label}</span>
        </label>
      )}

      {state === "uploading" && (
        <div className="space-y-2 rounded-lg border border-border p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="truncate">{fileName}</span>
            <span aria-live="polite">{progress}%</span>
          </div>
          <Progress value={progress} />
        </div>
      )}

      {state === "error" && (
        <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4" role="alert">
          <p className="text-sm text-destructive">{error}</p>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={handleRetry}>
              <RotateCcw className="me-1 h-4 w-4" aria-hidden="true" />
              إعادة المحاولة
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={handleClear}>
              إلغاء
            </Button>
          </div>
        </div>
      )}

      {state === "done" && (
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />
            <span className="truncate">{fileName ?? "تم الرفع"}</span>
          </div>
          <Button type="button" size="icon" variant="ghost" onClick={handleClear} aria-label="إزالة الملف">
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      )}
    </div>
  );
}
