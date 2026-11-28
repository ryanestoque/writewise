"use client";

import { memo } from "react";
import { Cpu } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
      className={cn("bg-muted/30 border-border/70 text-xs shadow-2xs", className)}
    >
      {!isParentView && <Cpu className="text-primary" aria-hidden="true" />}
      <AlertTitle className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-foreground">
        <span>
          {isParentView
            ? isManual
              ? "Checked by your child's teacher"
              : "Writing marks unavailable"
            : isManual
              ? "Manual Rubric Evaluation"
              : "Diagnostic Stroke Analysis Unavailable"}
        </span>
        {(!isParentView || isManual) && (
          <Badge variant="outline" className="h-4 px-1.5 py-0 text-[10px] font-medium">
            {isParentView ? "Teacher review" : isManual ? "Teacher Rubric" : "CV Processing"}
          </Badge>
        )}
      </AlertTitle>
      <AlertDescription className="text-[11px] leading-relaxed">
        {isParentView
          ? isManual
            ? "Your child's teacher reviewed this worksheet directly. Colored stroke marks only appear on automatically measured sheets."
            : "Colored stroke marks aren't available for this photo, so you're viewing the original worksheet."
          : "Automated geometric stroke guidelines (formation, baseline drift, slant vectors, inter-word spacing) appear when computer-vision guideline analysis is available."}
      </AlertDescription>
    </Alert>
  );
});
