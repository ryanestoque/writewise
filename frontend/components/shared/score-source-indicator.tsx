import { cn } from "@/lib/utils";
import { UserCheck, Sparkles } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ScoreSourceIndicatorProps {
  source: "manual" | "calibrated";
  compact?: boolean;
  className?: string;
}

export function ScoreSourceIndicator({
  source,
  compact = false,
  className,
}: ScoreSourceIndicatorProps) {
  const isManual = source === "manual";

  return (
    <TooltipProvider delay={150}>
      <Tooltip>
        <TooltipTrigger
          className={cn(
            "inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-muted/60 hover:bg-muted px-2 py-0.5 rounded-md border border-border/60 transition-colors cursor-default select-none",
            className
          )}
        >
          {isManual ? (
            <UserCheck className="size-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
          ) : (
            <Sparkles className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
          )}
          {!compact && <span>{isManual ? "Teacher-assessed" : "Auto-calibrated"}</span>}
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-xs leading-relaxed">
          {isManual
            ? "Scores currently derived from teacher's rubric assessment (Phase 1 calibration mode)."
            : "Scores generated automatically by calibrated CV and CNN diagnostic pipeline."}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
