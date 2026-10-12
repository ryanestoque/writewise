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
          type="button"
          aria-label={isManual ? "Teacher-assessed score: click for details" : "Auto-calibrated score: click for details"}
          className={cn(
            "inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground/80 hover:text-foreground transition-all cursor-pointer rounded-sm px-1 -mx-1 focus-visible:outline-hidden focus-visible:ring-1.5 focus-visible:ring-ring focus-visible:ring-offset-1 select-none",
            className
          )}
        >
          <span className="text-muted-foreground/40 font-normal">•</span>
          <span className={cn(
            "font-medium underline decoration-dotted underline-offset-2 decoration-current/40 hover:decoration-current",
            isManual ? "text-brand-600 dark:text-brand-400" : "text-amber-600 dark:text-amber-400"
          )}>
            {compact ? (isManual ? "Teacher rubric" : "Auto score") : (isManual ? "Teacher-assessed" : "Auto-calibrated")}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" align="end" className="text-xs max-w-xs p-3 leading-relaxed shadow-warm border border-border">
          <p className="font-semibold text-foreground mb-1">
            {isManual ? "Teacher-Assessed Rubric" : "Automated Diagnostic Engine"}
          </p>
          <p className="text-muted-foreground text-[11px]">
            {isManual
              ? "Evaluated directly by your child's classroom teacher using standardized cursive rubric criteria."
              : "Evaluated automatically by WriteWise's calibrated computer vision pipeline across 5 cursive penmanship standards."}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
