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
            ? "Scores assessed directly by the teacher using curriculum rubric standards."
            : "Scores generated automatically by WriteWise diagnostic engine based on cursive penmanship standards."}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
