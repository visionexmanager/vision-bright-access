import { File, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ViewerFrame } from "./ViewerFrame";

interface DocumentViewerProps {
  title: string;
  fileUrl: string | null;
}

/** Generic document fallback (docx/txt/etc. without a native in-browser
 * renderer) — attempts an iframe preview, always offers a direct download. */
export function DocumentViewer({ title, fileUrl }: DocumentViewerProps) {
  return (
    <ViewerFrame
      title={title}
      toolbarExtra={fileUrl && (
        <Button variant="ghost" size="sm" asChild className="h-8 gap-1.5 text-xs">
          <a href={fileUrl} download>
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            تنزيل
          </a>
        </Button>
      )}
    >
      {() =>
        fileUrl ? (
          <iframe src={fileUrl} title={title} className="w-full h-[70vh] border-0" />
        ) : (
          <div className="h-[50vh] flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <File className="w-10 h-10" aria-hidden="true" />
            <p className="text-sm">لم يتم رفع هذا المستند بعد.</p>
          </div>
        )
      }
    </ViewerFrame>
  );
}
