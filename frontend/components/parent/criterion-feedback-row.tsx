import { cn } from "@/lib/utils";
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
        "py-3 sm:py-3.5 first:pt-1.5 last:pb-1.5 transition-colors space-y-2",
        onInspect &&
          "cursor-pointer rounded-xl px-2.5 -mx-2.5 hover:bg-muted/30 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 group",
        isActive &&
          "bg-brand-50/80 dark:bg-brand-950/50 ring-2 ring-brand-500/80 dark:ring-brand-400/80 shadow-xs rounded-xl px-2.5 -mx-2.5"
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
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-band-4-text dark:text-emerald-300 bg-band-4/15 dark:bg-band-4/25 px-2 py-0.5 rounded-md border border-band-4/30 dark:border-band-4/40 shrink-0">
                <span className="size-1.5 rounded-full bg-band-4 shrink-0" aria-hidden="true" />
                Top Strength
              </span>
            )}
            {highlightBadge === "practice_focus" && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-band-2-text dark:text-amber-200 bg-band-2/15 dark:bg-band-2/25 px-2 py-0.5 rounded-md border border-band-2/30 dark:border-band-2/40 shrink-0">
                <span className="size-1.5 rounded-full bg-band-2 shrink-0" aria-hidden="true" />
                Practice Focus
              </span>
            )}
          </div>
        </div>

        {/* Right: Score, BandBadge, and See on worksheet affordance */}
        <div className="shrink-0 flex items-center gap-2 pt-0.5 sm:pt-0">
          {showScoreDetails && score != null && (
            <span className="text-xs sm:text-sm font-semibold font-sans tabular-nums text-muted-foreground">
              {Math.round(score)}%
            </span>
          )}
          <BandBadge band={band} score={score} size="sm" showDot />
          {onInspect && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground group-hover:text-brand-700 dark:group-hover:text-brand-300 transition-colors bg-muted/40 group-hover:bg-brand-50 dark:group-hover:bg-brand-950/40 px-2 py-0.5 rounded-md border border-border/60">
              <Eye className="size-3 shrink-0" aria-hidden="true" />
              <span>See on worksheet</span>
            </span>
          )}
        </div>
      </div>

      {/* Optional Band Position Bar */}
      {showPositionBar && (
        <div className="pt-0.5 pb-0.5">
          <BandPositionBar score={score} height="sm" showThresholds={showScoreDetails} />
        </div>
      )}

      {/* Feedback Note & Home Practice Tip */}
      {showDiagnosticNote && (diagnosticNote || homePracticeTip) && (
        <div
          id={`diagnostic-note-${criterionKey}`}
          className="pt-0.5 space-y-2 animate-in fade-in-50 duration-200 motion-reduce:animate-none"
        >
          {diagnosticNote && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {diagnosticNote}
            </p>
          )}

          {homePracticeTip && (
            <div className="p-3 rounded-xl bg-band-2/15 dark:bg-band-2/25 border border-band-2/30 dark:border-band-2/40 text-sm text-band-2-text dark:text-amber-200 shadow-2xs">
              <p className="leading-relaxed">
                <strong className="font-semibold text-band-2-text dark:text-amber-200">Home tip:</strong> {homePracticeTip}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
