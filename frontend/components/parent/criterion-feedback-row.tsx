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

  return (
    <div
      role={onInspect ? "button" : undefined}
      tabIndex={onInspect ? 0 : undefined}
      aria-pressed={onInspect ? isActive : undefined}
      onClick={onInspect}
      onKeyDown={
        onInspect
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
        "px-3.5 py-3 transition-colors space-y-2",
        onInspect &&
          "cursor-pointer hover:bg-muted/30 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 group",
        isActive &&
          "bg-brand-50/70 dark:bg-brand-950/40"
      )}
    >
      {/* Header Row */}
      <div className="flex items-start sm:items-center justify-between gap-2.5 flex-wrap">
        {/* Left: Criterion Info */}
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold text-foreground group-hover:text-brand-700 dark:group-hover:text-brand-300 transition-colors">
              {displayLabel}
            </span>
            {highlightBadge === "top_strength" && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-band-4-text dark:text-emerald-300 bg-band-4/15 dark:bg-band-4/25 px-1.5 py-0.5 rounded-md border border-band-4/30 dark:border-band-4/40 shrink-0">
                <span className="size-1.5 rounded-full bg-band-4 shrink-0" aria-hidden="true" />
                Top Strength
              </span>
            )}
            {highlightBadge === "practice_focus" && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-band-2-text dark:text-amber-200 bg-band-2/15 dark:bg-band-2/25 px-1.5 py-0.5 rounded-md border border-band-2/30 dark:border-band-2/40 shrink-0">
                <span className="size-1.5 rounded-full bg-band-2 shrink-0" aria-hidden="true" />
                Practice Focus
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
          {onInspect && inspectLabel && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground group-hover:text-brand-700 dark:group-hover:text-brand-300 transition-colors bg-muted/40 group-hover:bg-brand-50 dark:group-hover:bg-brand-950/40 px-2 py-0.5 rounded-md border border-border/60">
              <Eye className="size-3 shrink-0" aria-hidden="true" />
              <span>{inspectLabel}</span>
            </span>
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
      {showDiagnosticNote && (diagnosticNote || homePracticeTip || (isActive && onSeeOnWorksheetMobile)) && (
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
            <div className="p-3 rounded-xl bg-band-2/15 dark:bg-band-2/25 border border-band-2/30 dark:border-band-2/40 text-xs sm:text-sm text-band-2-text dark:text-amber-200 shadow-2xs">
              <p className="leading-relaxed">
                <strong className="font-semibold text-band-2-text dark:text-amber-200">Home tip:</strong> {homePracticeTip}
              </p>
            </div>
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
