"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { BandBadge } from "@/components/shared/band-badge";
import { BandPositionBar } from "@/components/shared/band-position-bar";
import { Button } from "@/components/ui/button";
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

export interface CriterionFeedbackRowProps {
  criterionKey: CriterionKey;
  label?: string;
  score: number | null;
  band: ScoreBand | null;
  notApplicable?: boolean;
  onInspect?: () => void;
  showDiagnosticNote?: boolean;
  showPositionBar?: boolean;
  highlightBadge?: "top_strength" | "practice_focus" | null;
  /** Optional inline metadata shown beside or below the highlight tag (e.g., Teacher CV metric or alert count). */
  subtitleMeta?: ReactNode;
  /** Optional override for the main diagnostic description inside the expanded panel. */
  diagnosticNoteOverride?: string | null;
  /** Optional message shown when criterion is not applicable (e.g., single-word spacing). */
  notApplicableNote?: string | null;
  homePracticeTip?: string | null;
  tipLabel?: string;
  isActive?: boolean;
}

/**
 * Shared collapsible criterion row used across Parent and Teacher submission detail views.
 */
export function CriterionFeedbackRow({
  criterionKey,
  label,
  score,
  band,
  notApplicable,
  onInspect,
  showDiagnosticNote = true,
  showPositionBar = false,
  highlightBadge,
  subtitleMeta,
  diagnosticNoteOverride,
  notApplicableNote,
  homePracticeTip,
  tipLabel = "Home tip:",
  isActive = false,
}: CriterionFeedbackRowProps) {
  const meta = PARENT_CRITERIA_METADATA[criterionKey];
  const displayLabel = label || meta?.label || criterionKey;
  const isNotApplicable = notApplicable ?? (score == null && band == null);
  const diagnosticNote =
    diagnosticNoteOverride !== undefined
      ? diagnosticNoteOverride
      : band
        ? DIAGNOSTIC_NOTES[criterionKey][band]
        : isNotApplicable && criterionKey === "spacing"
          ? "Not evaluated on a single-word sample because there are no spaces between words."
          : null;
  const hasDetails = Boolean(notApplicableNote || diagnosticNote || homePracticeTip);
  const isExpanded = Boolean(showDiagnosticNote && hasDetails);
  const hasSubtitle = Boolean(highlightBadge || subtitleMeta);

  const headerContent = (
    <>
      <div className="min-w-0 flex-1 text-left">
        <span className="block text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
          {displayLabel}
        </span>
        {hasSubtitle && (
          <div className="mt-0.5 flex items-center gap-x-2 gap-y-1 flex-wrap">
            {highlightBadge === "top_strength" && (
              <span className="text-xs font-medium text-band-4-text">
                Top strength
              </span>
            )}
            {highlightBadge === "practice_focus" && (
              <span className="text-xs font-medium text-primary">
                Practice focus
              </span>
            )}
            {subtitleMeta}
          </div>
        )}
      </div>

      <div className="shrink-0 flex items-center gap-2">
        <BandBadge band={band} score={score} notApplicable={isNotApplicable} size="sm" showDot />
        {score != null && (
          <span className="text-xs font-semibold font-sans tabular-nums text-muted-foreground min-w-[2.25rem] text-right">
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
      {notApplicableNote && (
        <p className="text-xs sm:text-sm text-muted-foreground font-medium leading-relaxed">
          {notApplicableNote}
        </p>
      )}

      {diagnosticNote && (
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          {diagnosticNote}
        </p>
      )}

      {homePracticeTip && (
        <p className="text-xs sm:text-sm text-foreground leading-relaxed">
          <strong className="font-semibold text-primary">{tipLabel}</strong>{" "}
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
          isActive && "bg-secondary/60"
        )}
      >
        <CollapsibleTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              className="group h-auto w-full justify-between gap-3 rounded-none px-4 py-3 font-normal hover:bg-muted/30 min-h-11 sm:min-h-10"
            />
          }
        >
          {headerContent}
        </CollapsibleTrigger>
        {positionBar}
        {hasDetails && (
          <CollapsibleContent
            id={`diagnostic-note-${criterionKey}`}
            className="flex flex-col gap-2 px-4 pb-3.5 pt-0.5"
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
        isActive && "bg-secondary/60"
      )}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        {headerContent}
      </div>
      {positionBar}
      {isExpanded && (
        <div
          id={`diagnostic-note-${criterionKey}`}
          className="flex flex-col gap-2 px-4 pb-3.5 pt-0.5"
        >
          {detailsBody}
        </div>
      )}
    </div>
  );
}
