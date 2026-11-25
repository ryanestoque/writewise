"use client";

import { cn } from "@/lib/utils";
import { BandBadge } from "@/components/shared/band-badge";
import { BandPositionBar } from "@/components/shared/band-position-bar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DIAGNOSTIC_NOTES,
  PARENT_CRITERIA_METADATA,
  type CriterionKey,
  type ScoreBand,
} from "@/lib/utils/scoring";
import { ChevronDown } from "lucide-react";

interface CriterionFeedbackRowProps {
  criterionKey: CriterionKey;
  label?: string;
  score: number | null;
  band: ScoreBand | null;
  onInspect?: () => void;
  showDiagnosticNote?: boolean;
  showPositionBar?: boolean;
  highlightBadge?: "top_strength" | "practice_focus" | null;
  homePracticeTip?: string | null;
  isActive?: boolean;
}

export function CriterionFeedbackRow({
  criterionKey,
  label,
  score,
  band,
  onInspect,
  showDiagnosticNote = true,
  showPositionBar = false,
  highlightBadge,
  homePracticeTip,
  isActive = false,
}: CriterionFeedbackRowProps) {
  const meta = PARENT_CRITERIA_METADATA[criterionKey];
  const displayLabel = label || meta?.label || criterionKey;
  const isNotApplicable = score == null && band == null;
  const diagnosticNote = band
    ? DIAGNOSTIC_NOTES[criterionKey][band]
    : isNotApplicable && criterionKey === "spacing"
      ? "Not evaluated on a single-word sample because there are no spaces between words."
      : null;
  const hasDetails = Boolean(diagnosticNote || homePracticeTip);
  const isExpanded = Boolean(showDiagnosticNote && hasDetails);

  const headerContent = (
    <>
      <div className="min-w-0 flex-1 text-left">
        <span className="block text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
          {displayLabel}
        </span>
        {highlightBadge === "top_strength" && (
          <span className="mt-0.5 block text-xs font-medium text-band-4-text">
            Top strength
          </span>
        )}
        {highlightBadge === "practice_focus" && (
          <span className="mt-0.5 block text-xs font-medium text-primary">
            Practice focus
          </span>
        )}
      </div>

      <div className="shrink-0 flex items-center gap-2">
        <BandBadge band={band} score={score} notApplicable={isNotApplicable} size="sm" showDot />
        {score != null && (
          <span className="text-xs font-semibold font-sans tabular-nums text-muted-foreground">
            {Math.round(score)}%
          </span>
        )}
        {onInspect && (
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform duration-150 motion-reduce:transition-none",
              (isActive || isExpanded) && "rotate-180 text-foreground"
            )}
            aria-hidden="true"
          />
        )}
      </div>
    </>
  );

  const positionBar = showPositionBar && (
    <div className="px-4 pb-2">
      <BandPositionBar
        score={score}
        height="sm"
        showBandLabels={false}
        showThresholds={true}
        ariaValueText={
          score != null
            ? `${Math.round(score)}%`
            : band
              ? band.replace("_", " ")
              : undefined
        }
      />
    </div>
  );

  const detailsBody = (
    <>
      {diagnosticNote && (
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          {diagnosticNote}
        </p>
      )}

      {homePracticeTip && (
        <p className="text-xs sm:text-sm text-foreground leading-relaxed">
          <strong className="font-semibold text-primary">Home tip:</strong>{" "}
          {homePracticeTip}
        </p>
      )}
    </>
  );

  if (onInspect) {
    return (
      <Collapsible
        open={isExpanded}
        onOpenChange={() => onInspect()}
        className={cn(
          "transition-colors",
          isActive && "bg-brand-50/70 dark:bg-brand-950/40"
        )}
      >
        <CollapsibleTrigger
          type="button"
          className="group w-full flex items-center justify-between gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors touch-manipulation focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 min-h-11 sm:min-h-10"
        >
          {headerContent}
        </CollapsibleTrigger>
        {positionBar}
        {hasDetails && (
          <CollapsibleContent
            id={`diagnostic-note-${criterionKey}`}
            className="px-4 pb-3.5 pt-0.5 space-y-2"
          >
            {detailsBody}
          </CollapsibleContent>
        )}
      </Collapsible>
    );
  }

  return (
    <div
      className={cn(
        "transition-colors",
        isActive && "bg-brand-50/70 dark:bg-brand-950/40"
      )}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        {headerContent}
      </div>
      {positionBar}
      {isExpanded && (
        <div
          id={`diagnostic-note-${criterionKey}`}
          className="px-4 pb-3.5 pt-0.5 space-y-2"
        >
          {detailsBody}
        </div>
      )}
    </div>
  );
}
