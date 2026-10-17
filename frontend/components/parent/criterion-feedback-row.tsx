import { cn } from "@/lib/utils";
import { BandBadge } from "@/components/shared/band-badge";
import { BandPositionBar } from "@/components/shared/band-position-bar";
import {
  DIAGNOSTIC_NOTES,
  PARENT_CRITERIA_METADATA,
  type CriterionKey,
  type ScoreBand,
} from "@/lib/utils/scoring";

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
      className={cn(
        "py-2.5 sm:py-3 first:pt-1 last:pb-1 transition-colors space-y-1.5",
        onInspect &&
          "cursor-pointer rounded-xl px-2.5 -mx-2.5 hover:bg-muted/20 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500",
        isActive &&
          "bg-brand-50/80 dark:bg-brand-950/50 ring-2 ring-brand-500/80 dark:ring-brand-400/80 shadow-xs rounded-xl px-2.5 -mx-2.5"
      )}
    >
      {/* Header Row */}
      <div className="flex items-start sm:items-center justify-between gap-2.5">
        {/* Left: Criterion Info */}
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs sm:text-sm font-semibold text-foreground">
              {displayLabel}
            </span>
            {highlightBadge === "top_strength" && (
              <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-band-4-text dark:text-emerald-300 bg-band-4/15 dark:bg-band-4/25 px-1.5 py-0.5 rounded-md border border-band-4/30 dark:border-band-4/40 shrink-0">
                <span className="size-1.5 rounded-full bg-band-4 shrink-0" aria-hidden="true" />
                Top Strength
              </span>
            )}
            {highlightBadge === "practice_focus" && (
              <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-band-2-text dark:text-amber-200 bg-band-2/15 dark:bg-band-2/25 px-1.5 py-0.5 rounded-md border border-band-2/30 dark:border-band-2/40 shrink-0">
                <span className="size-1.5 rounded-full bg-band-2 shrink-0" aria-hidden="true" />
                Practice Focus
              </span>
            )}
          </div>
        </div>

        {/* Right: Score and BandBadge */}
        <div className="shrink-0 flex items-center gap-1.5 sm:gap-2 pt-0.5 sm:pt-0">
          {score != null && (
            <span className="text-xs sm:text-sm font-semibold font-sans tabular-nums text-foreground">
              {Math.round(score)}%
            </span>
          )}
          <BandBadge band={band} score={score} size="sm" showDot />
        </div>
      </div>

      {/* Optional Band Position Bar */}
      {showPositionBar && (
        <div className="pt-1 pb-0.5">
          <BandPositionBar score={score} height="sm" />
        </div>
      )}

      {/* Diagnostic Note & Home Practice Tip */}
      {showDiagnosticNote && (diagnosticNote || homePracticeTip) && (
        <div
          id={`diagnostic-note-${criterionKey}`}
          className="pt-1 space-y-2 animate-in fade-in-50 duration-200 motion-reduce:animate-none"
        >
          {diagnosticNote && (
            <p className="text-xs text-muted-foreground leading-relaxed">
              {diagnosticNote}
            </p>
          )}

          {homePracticeTip && (
            <div className="p-2.5 rounded-xl bg-band-2/15 dark:bg-band-2/25 border border-band-2/30 dark:border-band-2/40 text-xs text-band-2-text dark:text-amber-200 shadow-2xs">
              <p className="leading-relaxed">
                <strong className="font-semibold text-band-2-text dark:text-amber-200">Tip:</strong> {homePracticeTip}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
