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
import { ChevronRight, Eye } from "lucide-react";

// Overview copy stays brief; the worksheet viewer retains the full diagnostic notes.
const DIAGNOSTIC_SUMMARIES: Record<CriterionKey, Record<ScoreBand, string>> = {
  letter_formation: {
    needs_improvement: "Several letters are not fully formed yet.",
    developing: "Letter shapes are taking form but are still inconsistent.",
    satisfactory: "Most letters are well formed, with a few inconsistencies.",
    excellent: "Letters are consistently well formed across the page.",
  },
  size_consistency: {
    needs_improvement: "Letter sizes vary a lot across the page.",
    developing: "Letter sizes are becoming more even but still vary in places.",
    satisfactory: "Letter sizes are mostly consistent, with minor variation.",
    excellent: "Letter sizes are consistent throughout the page.",
  },
  spacing: {
    needs_improvement: "Gaps between letters and words vary a lot.",
    developing: "Spacing is becoming more even but is still uneven in places.",
    satisfactory: "Spacing is mostly even and easy to read.",
    excellent: "Spacing is even and consistent throughout the page.",
  },
  slant: {
    needs_improvement: "Letter slant varies noticeably across the page.",
    developing: "Letter slant is becoming more consistent but still shifts in places.",
    satisfactory: "Letter slant is mostly consistent, with slight variation.",
    excellent: "Letter slant is consistent throughout the page.",
  },
  baseline_alignment: {
    needs_improvement: "Letters often drift above or below the writing line.",
    developing: "Letters stay closer to the writing line but still drift in places.",
    satisfactory: "Letters mostly sit on the writing line, with occasional drift.",
    excellent: "Letters consistently sit on the writing line.",
  },
};

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
  concise?: boolean;
  inspectOpensDialog?: boolean;
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
  concise = false,
  inspectOpensDialog = false,
}: CriterionFeedbackRowProps) {
  const meta = PARENT_CRITERIA_METADATA[criterionKey];
  const displayLabel = label || meta?.label || criterionKey;
  const diagnosticNote = band
    ? (concise ? DIAGNOSTIC_SUMMARIES : DIAGNOSTIC_NOTES)[criterionKey][band]
    : null;
  const hasNestedButton = Boolean(isActive && onSeeOnWorksheetMobile);

  return (
    <div
      role={onInspect && !hasNestedButton ? "button" : undefined}
      tabIndex={onInspect && !hasNestedButton ? 0 : undefined}
      aria-pressed={onInspect && !hasNestedButton && !inspectOpensDialog ? isActive : undefined}
      aria-haspopup={onInspect && inspectOpensDialog ? "dialog" : undefined}
      onClick={hasNestedButton ? undefined : onInspect}
      onKeyDown={
        onInspect && !hasNestedButton
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onInspect();
              }
            }
          : undefined
      }
      aria-label={
        onInspect
          ? `See ${displayLabel} on worksheet. Rating: ${band ? band.replace("_", " ") : "Pending"}`
          : undefined
      }
      className={cn(
        "space-y-2 px-3.5 py-3 transition-colors",
        onInspect &&
          "hover:bg-muted/30 focus-visible:ring-brand-500 group cursor-pointer focus-visible:ring-2 focus-visible:outline-hidden focus-visible:ring-inset",
        isActive && "bg-brand-50/70 dark:bg-brand-950/40"
      )}
    >
      {/* Header Row */}
      <div className="flex flex-wrap items-start justify-between gap-2.5 sm:items-center">
        {/* Left: Criterion Info */}
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-foreground group-hover:text-brand-700 dark:group-hover:text-brand-300 text-sm font-semibold transition-colors">
              {displayLabel}
            </span>
            {highlightBadge === "top_strength" && (
              <span className="text-band-4-text inline-flex shrink-0 items-center gap-1 text-xs font-medium">
                <span className="bg-band-4 size-1.5 shrink-0 rounded-full" aria-hidden="true" />
                Top strength
              </span>
            )}
            {highlightBadge === "practice_focus" && (
              <span className="text-band-2-text inline-flex shrink-0 items-center gap-1 text-xs font-medium">
                <span className="bg-band-2 size-1.5 shrink-0 rounded-full" aria-hidden="true" />
                Practice focus
              </span>
            )}
          </div>
        </div>

        {/* Right: Score, BandBadge, and See on worksheet affordance */}
        <div className="flex shrink-0 items-center gap-1.5 pt-0.5 sm:gap-2 sm:pt-0">
          {showScoreDetails && score != null && (
            <span className="text-muted-foreground font-sans text-xs font-semibold tabular-nums sm:text-sm">
              {Math.round(score)}%
            </span>
          )}
          <BandBadge band={band} score={score} size="sm" showDot />
          {onInspect && inspectLabel && (
            <ChevronRight
              className="text-muted-foreground group-hover:text-brand-700 dark:group-hover:text-brand-300 size-4 shrink-0 transition-colors"
              aria-hidden="true"
            />
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
          <div id={`diagnostic-note-${criterionKey}`} className="space-y-2 pt-0.5">
            {diagnosticNote && (
              <p className="text-muted-foreground text-xs leading-relaxed sm:text-sm">
                {diagnosticNote}
              </p>
            )}

            {homePracticeTip && (
              <div className="bg-band-2/15 dark:bg-band-2/25 border-band-2/30 dark:border-band-2/40 text-band-2-text rounded-xl border p-3 text-xs shadow-2xs sm:text-sm">
                <p className="leading-relaxed">
                  <strong className="text-band-2-text font-semibold">Home tip:</strong>{" "}
                  {homePracticeTip}
                </p>
              </div>
            )}

            {isActive && onSeeOnWorksheetMobile && (
              <div className="pt-1 lg:hidden">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSeeOnWorksheetMobile();
                  }}
                  className="border-brand-200 dark:border-brand-900 bg-brand-50/50 dark:bg-brand-950/30 text-brand-800 dark:text-brand-200 focus-visible:ring-brand-500 h-10 min-h-[40px] w-full cursor-pointer touch-manipulation gap-1.5 text-xs font-medium focus-visible:ring-2 focus-visible:outline-hidden sm:text-sm"
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
