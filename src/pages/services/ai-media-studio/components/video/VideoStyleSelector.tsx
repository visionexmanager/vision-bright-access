import { cn } from "@/lib/utils";
import { VIDEO_STYLES } from "@/lib/types/video-studio";

interface VideoStyleSelectorProps {
  value:    string;
  onChange: (style: string) => void;
}

export function VideoStyleSelector({ value, onChange }: VideoStyleSelectorProps) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4">
      {VIDEO_STYLES.map((style) => (
        <button
          key={style.id}
          type="button"
          onClick={() => onChange(style.id)}
          title={style.description}
          className={cn(
            "relative flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition-all",
            "hover:border-primary/60 hover:bg-primary/5",
            value === style.id
              ? "border-primary bg-primary/10 ring-1 ring-primary"
              : "border-border bg-background"
          )}
        >
          <span className="text-xl leading-none">{style.emoji}</span>
          <span className="text-[10px] font-medium leading-tight text-foreground line-clamp-1">
            {style.label}
          </span>
          {value === style.id && (
            <span className="absolute -top-1 -right-1 size-3 rounded-full bg-primary" />
          )}
        </button>
      ))}
    </div>
  );
}
