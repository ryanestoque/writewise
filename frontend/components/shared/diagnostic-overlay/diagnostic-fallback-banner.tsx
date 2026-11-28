"use client";

import { memo } from "react";
import { Cpu } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface DiagnosticFallbackBannerProps {
  scoreSource?: "manual" | "calibrated" | "hybrid" | "none" | string;
  isParentView?: boolean;
  className?: string;
}

export const DiagnosticFallbackBanner = memo(function DiagnosticFallbackBanner({
  scoreSource,
  isParentView = false,
  className,
}: DiagnosticFallbackBannerProps) {
  const isManual = scoreSource === "manual";

  return (
    <Alert
      role="status"
      aria-label="Diagnostic stroke guidelines status"
      className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2.5 sm:p-3 rounded-xl",
        "bg-muted/30 border-border/70 text-xs shadow-2xs transition-colors",
        className
      )}
    >
      <div className="flex items-start sm:items-center gap-2.5 min-w-0">
        {!isParentView && (
          <div className="flex size-7 sm:size-8 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-900 shrink-0 mt-0.5 sm:mt-0">
            <Cpu className="size-3.5 sm:size-4" aria-hidden="true" />
          </div>
        )}
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-foreground text-xs">
              {isParentView
                ? isManual
                  ? "Checked by your child's teacher"
                  : "Writing marks unavailable"
                : isManual
                  ? "Manual Rubric Evaluation"
                  : "Diagnostic Stroke Analysis Unavailable"}
            </span>
            {(!isParentView || isManual) && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 h-4 font-medium border-border/80 text-muted-foreground bg-muted/40"
              >
                {isParentView ? "Teacher review" : isManual ? "Teacher Rubric" : "CV Processing"}
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {isParentView
              ? isManual
                ? "Your child's teacher reviewed this worksheet directly. Colored stroke marks only appear on automatically measured sheets."
                : "Colored stroke marks aren't available for this photo, so you're viewing the original worksheet."
              : "Automated geometric stroke guidelines (formation, baseline drift, slant vectors, inter-word spacing) appear when computer-vision guideline analysis is available."}
          </p>
        </div>
      </div>
    </Alert>
  );
});
