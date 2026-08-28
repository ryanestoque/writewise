import { BandBadge } from "@/components/shared/band-badge";
import { BandPositionBar } from "@/components/shared/band-position-bar";
import { DIAGNOSTIC_NOTES } from "@/lib/utils/scoring";
import type { ScoreBand } from "@/lib/utils/scoring";

interface CriterionFeedbackRowProps {
  criterionKey:
    | "letter_formation"
    | "size_consistency"
    | "spacing"
    | "slant"
    | "baseline_alignment";
  label: string;
  score: number | null;
  band: ScoreBand | null;
}

export function CriterionFeedbackRow({
  criterionKey,
  label,
  score,
  band,
}: CriterionFeedbackRowProps) {
  const diagnosticNote = band ? DIAGNOSTIC_NOTES[criterionKey][band] : null;

  return (
    <div className="space-y-1.5 py-3 border-b border-border/60 last:border-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <BandBadge band={band} score={score} size="sm" />
      </div>
      <BandPositionBar score={score} height="sm" />
      {diagnosticNote && (
        <p className="text-xs text-muted-foreground leading-relaxed pt-0.5">
          {diagnosticNote}
        </p>
      )}
    </div>
  );
}
