import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AcademyErrorStateProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function AcademyErrorState({ message, onRetry, className = "" }: AcademyErrorStateProps) {
  return (
    <div
      role="alert"
      className={`flex flex-col items-center text-center gap-3 py-6 px-4 ${className}`}
    >
      <AlertTriangle className="w-6 h-6 text-destructive" aria-hidden="true" />
      <p className="text-sm text-destructive">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="rounded-xl">
          إعادة المحاولة
        </Button>
      )}
    </div>
  );
}
