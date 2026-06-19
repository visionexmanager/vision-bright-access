import { useId, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface CollapsibleTableCardProps {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  contentClassName?: string;
  expandLabel?: string;
  collapseLabel?: string;
  summary?: ReactNode;
}

export function CollapsibleTableCard({
  title,
  children,
  defaultOpen = true,
  className,
  contentClassName,
  expandLabel = "Expand table",
  collapseLabel = "Collapse table",
  summary,
}: CollapsibleTableCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <Card className={className}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-lg">{title}</CardTitle>
            {summary && <div className="mt-1 text-sm text-muted-foreground">{summary}</div>}
          </div>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-expanded={open}
              aria-controls={contentId}
              className="shrink-0 gap-2"
            >
              {open ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
              {open ? collapseLabel : expandLabel}
            </Button>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent id={contentId}>
          <CardContent className={cn("p-0", contentClassName)}>{children}</CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
