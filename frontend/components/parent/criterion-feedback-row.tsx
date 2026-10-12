import { Eye, Target, ChevronDown } from "lucide-react";
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
  onToggleDiagnosticNote,
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
        "py-3 first:pt-1 last:pb-1 transition-colors",
        isActive && "bg-brand-50/80 dark:bg-brand-950/50 ring-1.5 ring-brand-500/80 dark:ring-brand-400/80 shadow-xs rounded-xl px-2.5 -mx-2.5"
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-2">
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs sm:text-sm font-medium text-foreground">{displayLabel}</span>
            {highlightBadge === "top_strength" && (
              <span className="inline-flex items-center text-[10px] sm:text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-800/50 shrink-0 shadow-2xs">
                Top Strength
              </span>
            )}
            {highlightBadge === "practice_focus" && (
              <span className="inline-flex items-center text-[10px] sm:text-[11px] font-semibold text-amber-900 dark:text-amber-200 bg-amber-100/90 dark:bg-amber-950/80 px-2 py-0.5 rounded-md border border-amber-300/90 dark:border-amber-750/80 shrink-0 shadow-2xs">
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
        <div className="shrink-0 flex items-center justify-between sm:justify-end gap-2.5 pt-1 sm:pt-0">
          <div className="flex items-center gap-2">
            {score != null && (
              <span className="text-xs font-semibold font-sans tabular-nums text-foreground">
                {Math.round(score)}%
              </span>
            )}
            <BandBadge band={band} score={score} size="sm" showDot />
          </div>
          <div className="flex items-center gap-1.5">
            {!onToggleDiagnosticNote && onInspect && (
              <button
                type="button"
                onClick={onInspect}
                aria-haspopup="dialog"
                className={cn(
                  "text-xs inline-flex items-center gap-1.5 cursor-pointer min-h-[36px] sm:min-h-[32px] px-2.5 py-1 rounded-lg border focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 transition-colors shadow-2xs font-medium",
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
            {onToggleDiagnosticNote && diagnosticNote && (
              <button
                type="button"
                onClick={onToggleDiagnosticNote}
                aria-expanded={showDiagnosticNote}
                aria-controls={`diagnostic-note-${criterionKey}`}
                aria-label={
                  showDiagnosticNote
                    ? `Hide diagnostic feedback for ${displayLabel}`
                    : `Show diagnostic feedback for ${displayLabel}`
                }
                className="min-h-[40px] min-w-[40px] sm:min-h-[32px] sm:min-w-[32px] sm:size-8 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/70 border border-border/60 hover:border-border focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 cursor-pointer transition-colors shadow-2xs"
                title={showDiagnosticNote ? "Hide details" : "Show details"}
              >
                <ChevronDown
                  className={cn(
                    "size-4 transition-transform duration-200 motion-reduce:transition-none text-muted-foreground",
                    showDiagnosticNote && "rotate-180 text-foreground"
                  )}
                  aria-hidden="true"
                />
              </button>
            )}
          </div>
        </div>
      </div>
      {showPositionBar && <BandPositionBar score={score} height="sm" />}
      {showDiagnosticNote && (diagnosticNote || homePracticeTip || onInspect) && (
        <div
          id={`diagnostic-note-${criterionKey}`}
          className="pt-2 space-y-2 animate-in fade-in-50 duration-200 motion-reduce:animate-none"
        >
          {diagnosticNote && (
            <p className="text-xs text-muted-foreground leading-relaxed">
              {diagnosticNote}
            </p>
          )}

          {homePracticeTip && (
            <div className="p-2.5 rounded-xl bg-brand-50/70 dark:bg-brand-950/40 border border-brand-200/70 dark:border-brand-800/70 text-xs text-brand-900 dark:text-brand-200 flex items-start gap-2 shadow-2xs">
              <Target className="size-3.5 shrink-0 mt-0.5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
              <p className="leading-relaxed">
                <strong className="font-semibold text-brand-800 dark:text-brand-300">Home practice tip:</strong> {homePracticeTip}
              </p>
            </div>
          )}

          {onToggleDiagnosticNote && onInspect && (
            <div className="pt-0.5 flex items-center justify-end">
              <button
                type="button"
                onClick={onInspect}
                aria-haspopup="dialog"
                aria-label={`Inspect ${displayLabel} guide lines on worksheet photo`}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 dark:text-brand-300 hover:text-brand-800 dark:hover:text-brand-200 hover:underline px-2.5 py-1.5 min-h-[40px] sm:min-h-[36px] rounded-md hover:bg-brand-50/80 dark:hover:bg-brand-950/60 cursor-pointer transition-colors"
                title={`Inspect ${displayLabel} guide lines on worksheet`}
              >
                <Eye className="size-3.5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                <span>Inspect {displayLabel} guide lines &rarr;</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
