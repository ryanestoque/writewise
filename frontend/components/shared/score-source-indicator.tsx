import { cn } from "@/lib/utils";

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
          aria-label={isManual ? "Teacher-assessed score" : "Auto-calibrated score"}
          className={cn(
            "inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground/80 hover:text-foreground transition-colors cursor-default select-none",
            className
          )}
        >
          <span className="text-muted-foreground/40 font-normal">•</span>
          <span className={cn(
            "font-medium",
            isManual ? "text-brand-600 dark:text-brand-400" : "text-amber-600 dark:text-amber-400"
          )}>
            {compact ? (isManual ? "Teacher rubric" : "Auto score") : (isManual ? "Teacher-assessed" : "Auto-calibrated")}
          </span>
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
