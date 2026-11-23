import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BandBadge } from "@/components/shared/band-badge";
import { BandPositionBar } from "@/components/shared/band-position-bar";
import {
  DIAGNOSTIC_NOTES,
  PARENT_CRITERIA_METADATA,
  type CriterionKey,
  type ScoreBand,
} from "@/lib/utils/scoring";
import { Eye } from "lucide-react";

interface CriterionFeedbackRowProps {
  criterionKey: CriterionKey;
  label?: string;
  score: number | null;
  band: ScoreBand | null;
  onInspect?: () => void;
  inspectLabel?: string | null;
  onSeeOnWorksheetMobile?: () => void;
  showDiagnosticNote?: boolean;
  onToggleDiagnosticNote?: () => void;
  showPositionBar?: boolean;
  highlightBadge?: "top_strength" | "practice_focus" | null;
  homePracticeTip?: string | null;
  isActive?: boolean;
  showScoreDetails?: boolean;
}

export function CriterionFeedbackRow({
  criterionKey,
  label,
  score,
  band,
  onInspect,
  inspectLabel = "See on worksheet",
  onSeeOnWorksheetMobile,
  showDiagnosticNote = true,
  showPositionBar = false,
  highlightBadge,
  homePracticeTip,
  isActive = false,
  showScoreDetails = false,
}: CriterionFeedbackRowProps) {
  const meta = PARENT_CRITERIA_METADATA[criterionKey];
  const displayLabel = label || meta?.label || criterionKey;
  const diagnosticNote = band ? DIAGNOSTIC_NOTES[criterionKey][band] : null;
  const hasNestedButton = Boolean(isActive && onSeeOnWorksheetMobile);

  return (
    // The row itself is NOT a button: a role=button + aria-label would replace
    // the diagnostic note and home tip for screen readers. Row click is a
    // pointer-only convenience; the "inspect" control below is the real button.
    <div
      onClick={hasNestedButton ? undefined : onInspect}
      className={cn(
        "px-4 py-3 transition-colors space-y-2",
        onInspect &&
        "cursor-pointer hover:bg-muted/30 focus-within:bg-muted/30 group",
        isActive && "bg-brand-50/70 dark:bg-brand-950/40"
      )}
    >
      {/* Header Row */}
      <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
        {/* Left: Criterion Info */}
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold text-foreground group-hover:text-brand-700 dark:group-hover:text-brand-300 transition-colors">
              {displayLabel}
            </span>
            {highlightBadge === "top_strength" && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-band-4-text shrink-0">
                <span className="size-1.5 rounded-full bg-band-4 shrink-0" aria-hidden="true" />
                Top strength
              </span>
            )}
            {highlightBadge === "practice_focus" && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-band-2-text shrink-0">
                <span className="size-1.5 rounded-full bg-band-2 shrink-0" aria-hidden="true" />
                Practice focus
              </span>
            )}
          </div>
        </div>

        {/* Right: Score, BandBadge, and See on worksheet affordance */}
        <div className="shrink-0 flex items-center gap-1.5 sm:gap-2 pt-0.5 sm:pt-0">
          {showScoreDetails && score != null && (
            <span className="text-xs sm:text-sm font-semibold font-sans tabular-nums text-muted-foreground">
              {Math.round(score)}%
            </span>
          )}
          <BandBadge band={band} score={score} size="sm" showDot />
          {onInspect && (
            <button
              type="button"
              aria-pressed={isActive}
              aria-label={inspectLabel ? `${inspectLabel} for ${displayLabel}` : `View ${displayLabel} feedback`}
              onClick={(e) => {
                e.stopPropagation();
                onInspect();
              }}
              className={cn(
                "cursor-pointer touch-manipulation focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500",
                inspectLabel
                  ? "inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground group-hover:text-brand-700 dark:group-hover:text-brand-300 transition-colors bg-muted/40 group-hover:bg-brand-50 dark:group-hover:bg-brand-950/40 px-2.5 py-1.5 min-h-10 sm:min-h-9 rounded-md border border-border/60"
                  : isActive
                    ? "size-10 sm:size-9 rounded-md inline-flex items-center justify-center text-primary bg-primary/10 border border-primary/25 transition-colors"
                    : "size-10 sm:size-9 rounded-md inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent hover:border-border/60 transition-colors"
              )}
            >
              <Eye className="size-3.5 shrink-0" aria-hidden="true" />
              {inspectLabel && <span>{inspectLabel}</span>}
            </button>
          )}
        </div>
      </div>

      {/* Optional Band Position Bar */}
      {showPositionBar && (
        <div className="pt-0.5 pb-0.5">
          <BandPositionBar
            score={score}
            height="sm"
            showThresholds={showScoreDetails}
            ariaValueText={
              showScoreDetails && score != null
                ? `${Math.round(score)}%`
                : band
                  ? band.replace("_", " ")
                  : undefined
            }
          />
        </div>
      )}

      {/* Feedback Note & Home Practice Tip */}
      {showDiagnosticNote &&
        (diagnosticNote || homePracticeTip || (isActive && onSeeOnWorksheetMobile)) && (
          <div
            id={`diagnostic-note-${criterionKey}`}
            className="pt-0.5 space-y-2"
          >
            {diagnosticNote && (
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {diagnosticNote}
              </p>
            )}

            {homePracticeTip && (
              <p className="text-xs sm:text-sm text-band-2-text leading-relaxed pt-1">
                <strong className="font-semibold">Home tip:</strong>{" "}
                {homePracticeTip}
              </p>
            )}

            {isActive && onSeeOnWorksheetMobile && (
              <div className="lg:hidden pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSeeOnWorksheetMobile();
                  }}
                  className="w-full h-10 min-h-[40px] text-xs sm:text-sm font-medium gap-1.5 border-brand-200 dark:border-brand-900 bg-brand-50/50 dark:bg-brand-950/30 text-brand-800 dark:text-brand-200 cursor-pointer touch-manipulation focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  <Eye className="size-3.5" aria-hidden="true" />
                  <span>See on worksheet</span>
                </Button>
              </div>
            )}
          </div>
        )}
    </div>
  );
}
