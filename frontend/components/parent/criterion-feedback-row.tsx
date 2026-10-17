import { Eye, Target } from "lucide-react";
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
      className={cn(
        "py-2.5 sm:py-3 first:pt-1 last:pb-1 transition-colors space-y-1.5",
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
          {meta?.shortDescription && (
            <p className="text-xs text-muted-foreground font-normal leading-tight">
              {meta.shortDescription}
            </p>
          )}
        </div>

        {/* Right: Score, BandBadge, and Inspect Button */}
        <div className="shrink-0 flex items-center gap-2 pt-0.5 sm:pt-0">
          <div className="flex items-center gap-1.5 sm:gap-2">
            {score != null && (
              <span className="text-xs sm:text-sm font-semibold font-sans tabular-nums text-foreground">
                {Math.round(score)}%
              </span>
            )}
            <BandBadge band={band} score={score} size="sm" showDot />
          </div>

          {onInspect && (
            <button
              type="button"
              onClick={onInspect}
              aria-haspopup="dialog"
              className={cn(
                "h-10 sm:h-8 min-h-[40px] sm:min-h-[32px] px-3 sm:px-2.5 text-xs inline-flex items-center gap-1.5 cursor-pointer rounded-lg border focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 transition-colors font-medium touch-manipulation",
                isActive
                  ? "border-brand-600 bg-brand-600 text-white dark:border-brand-500 dark:bg-brand-500 dark:text-neutral-950 font-semibold shadow-xs"
                  : "text-brand-800 dark:text-brand-200 border-brand-200/90 dark:border-brand-800/80 bg-brand-50/60 dark:bg-brand-950/40 hover:bg-brand-100/70 dark:hover:bg-brand-900/60"
              )}
              title={`Inspect ${displayLabel} on worksheet`}
              aria-label={`Inspect ${displayLabel} strokes on worksheet photo`}
            >
              <Eye className="size-3.5 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden="true" />
              <span className="text-[11px] sm:text-xs">{isActive ? "Viewing" : "Inspect"}</span>
            </button>
          )}
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
            <div className="p-2.5 rounded-xl bg-band-2/15 dark:bg-band-2/25 border border-band-2/30 dark:border-band-2/40 text-xs text-band-2-text dark:text-amber-200 flex items-start gap-2 shadow-2xs">
              <Target className="size-3.5 shrink-0 mt-0.5 text-band-2" aria-hidden="true" />
              <p className="leading-relaxed">
                <strong className="font-semibold text-band-2-text dark:text-amber-200">Home practice tip:</strong> {homePracticeTip}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
