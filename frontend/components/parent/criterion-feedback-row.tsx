import { Eye } from "lucide-react";
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
}

export function CriterionFeedbackRow({
  criterionKey,
  label,
  score,
  band,
  onInspect,
  showDiagnosticNote = true,
}: CriterionFeedbackRowProps) {
  const meta = PARENT_CRITERIA_METADATA[criterionKey];
  const displayLabel = label || meta?.label || criterionKey;
  const diagnosticNote = band ? DIAGNOSTIC_NOTES[criterionKey][band] : null;

  return (
    <div className="space-y-1.5 py-3 first:pt-1 last:pb-1">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <span className="text-xs sm:text-sm font-medium text-foreground">{displayLabel}</span>
          {meta?.shortDescription && (
            <p className="text-[11px] text-muted-foreground font-normal leading-tight mt-0.5">
              {meta.shortDescription}
            </p>
          )}
        </div>
        <div className="shrink-0 flex items-center gap-2 pt-0.5">
          {score != null && (
            <span className="text-xs font-semibold tabular-nums text-foreground">
              {Math.round(score)}%
            </span>
          )}
          <BandBadge band={band} score={score} size="sm" showDot />
          {onInspect && (
            <button
              type="button"
              onClick={onInspect}
              className="text-xs text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 hover:underline inline-flex items-center gap-1 cursor-pointer min-h-[40px] sm:min-h-[32px] px-2 sm:px-1.5 -my-1.5 sm:-my-1 rounded-md focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
              title={`Inspect ${displayLabel} on worksheet`}
              aria-label={`Inspect ${displayLabel} on worksheet photo`}
            >
              <Eye className="size-3.5 sm:size-3" aria-hidden="true" />
              <span className="text-[11px] font-medium">Inspect</span>
            </button>
          )}
        </div>
      </div>
      <BandPositionBar score={score} height="sm" />
      {showDiagnosticNote && diagnosticNote && (
        <p className="text-xs text-muted-foreground leading-relaxed pt-0.5 animate-in fade-in-50 duration-200">
          {diagnosticNote}
        </p>
      )}
    </div>
  );
}
