"use client";

import { memo } from "react";
import type { ActiveAnnotationHover } from "./types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface AnnotationTooltipProps {
  hover: ActiveAnnotationHover | null;
  imageWidth: number;
  imageHeight: number;
}

const CRITERION_LABELS: Record<string, string> = {
  baseline_alignment: "Baseline Alignment",
  spacing: "Spacing",
  size_consistency: "Size Consistency",
  slant: "Slant Angle",
  letter_formation: "Letter Formation",
};

export const AnnotationTooltip = memo(function AnnotationTooltip({
  hover,
  imageWidth,
  imageHeight,
}: AnnotationTooltipProps) {
  if (!hover || imageWidth <= 0 || imageHeight <= 0) return null;

  const { title, note, severity, criterion, x, y } = hover;
  const isAttention = severity === "needs_attention";

  // Calculate percentage offset inside relative image container
  const leftPct = Math.max(5, Math.min(95, (x / imageWidth) * 100));
  const topPct = Math.max(5, Math.min(95, (y / imageHeight) * 100));

  return (
    <div
      className="absolute pointer-events-none z-30 transition-all duration-150 transform -translate-x-1/2 -translate-y-full"
      style={{ left: `${leftPct}%`, top: `${topPct}%` }}
    >
      <div
        className={cn(
          "max-w-xs p-2.5 mb-2 rounded-xl shadow-lg border backdrop-blur-md transition-all",
          "bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-100",
          isAttention
            ? "border-amber-500/40 dark:border-amber-400/40 ring-2 ring-amber-500/10"
            : "border-sky-500/40 dark:border-sky-400/40 ring-2 ring-sky-500/10"
        )}
      >
        <div className="flex items-center gap-1.5 mb-1">
          {isAttention ? (
            <AlertCircle className="size-3.5 text-amber-500 shrink-0" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="size-3.5 text-sky-500 shrink-0" aria-hidden="true" />
          )}
          <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
            {CRITERION_LABELS[criterion] ?? criterion}
          </span>
          <Badge
            variant={isAttention ? "outline" : "secondary"}
            className={cn(
              "ml-auto text-[10px] px-1.5 py-0 h-4 font-medium",
              isAttention
                ? "border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40"
                : "text-sky-600 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40"
            )}
          >
            {isAttention ? "Needs Attention" : "Consistent"}
          </Badge>
        </div>

        <p className="text-xs font-semibold leading-snug">{title}</p>
        <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{note}</p>
      </div>
    </div>
  );
});
