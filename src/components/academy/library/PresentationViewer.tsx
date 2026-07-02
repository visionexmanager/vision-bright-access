import { Presentation, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ViewerFrame } from "./ViewerFrame";

interface PresentationViewerProps {
  title: string;
  fileUrl: string | null;
}

export function PresentationViewer({ title, fileUrl }: PresentationViewerProps) {
  return (
    <ViewerFrame
      title={title}
      toolbarExtra={fileUrl && (
        <Button variant="ghost" size="sm" asChild className="h-8 gap-1.5 text-xs">
          <a href={fileUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            فتح في تبويب جديد
          </a>
        </Button>
      )}
    >
      {() =>
        fileUrl ? (
          <iframe src={fileUrl} title={title} className="w-full h-[70vh] border-0" allowFullScreen />
        ) : (
          <div className="h-[50vh] flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Presentation className="w-10 h-10" aria-hidden="true" />
            <p className="text-sm">لم يتم رفع العرض التقديمي لهذا المورد بعد.</p>
          </div>
        )
      }
    </ViewerFrame>
  );
}
