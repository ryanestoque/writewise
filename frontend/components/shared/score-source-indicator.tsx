import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

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
  const label = compact
    ? isManual
      ? "Teacher rubric"
      : "Auto-calibrated"
    : isManual
      ? "Teacher-assessed"
      : "Auto-calibrated";

  return (
    <TooltipProvider delay={150}>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="link"
              size="xs"
              aria-label={
                isManual
                  ? "Teacher-assessed score: focus or hover for details"
                  : "Auto-calibrated score: focus or hover for details"
              }
              className={cn(
                "h-auto p-0 text-xs font-medium",
                isManual ? "text-primary" : "text-band-2-text",
                className
              )}
            />
          }
        >
          {label}
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="end"
          className="flex-col items-start gap-1 max-w-xs p-3 text-xs leading-relaxed"
        >
          <p className="font-semibold">
            {isManual ? "Teacher-Assessed Rubric" : "Automated Diagnostic Engine"}
          </p>
          <p className="text-background/80 text-xs">
            {isManual
              ? "Evaluated directly by your child's classroom teacher using standardized cursive rubric criteria."
              : "Evaluated automatically by WriteWise's calibrated computer vision pipeline across 5 cursive penmanship standards."}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
