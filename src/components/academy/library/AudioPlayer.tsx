import { Headphones } from "lucide-react";
import { ViewerFrame } from "./ViewerFrame";

interface AudioPlayerProps {
  title: string;
  fileUrl: string | null;
}

/** Native <audio controls> — accessible keyboard/screen-reader controls by
 * default, no custom scrubber needed. */
export function AudioPlayer({ title, fileUrl }: AudioPlayerProps) {
  return (
    <ViewerFrame title={title}>
      {() =>
        fileUrl ? (
          <div className="p-8 flex flex-col items-center gap-4">
            <div className="p-6 bg-primary/10 text-primary rounded-full" aria-hidden="true">
              <Headphones className="w-10 h-10" />
            </div>
            <audio controls className="w-full max-w-md" aria-label={title}>
              <source src={fileUrl} />
              متصفحك لا يدعم تشغيل الصوت.
            </audio>
          </div>
        ) : (
          <div className="h-40 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Headphones className="w-10 h-10" aria-hidden="true" />
            <p className="text-sm">لم يتم رفع ملف صوتي لهذا المورد بعد.</p>
          </div>
        )
      }
    </ViewerFrame>
  );
}
