import { cn } from "@/lib/utils";
import { getBandMeta, getBandFromScore, type ScoreBand } from "@/lib/utils/scoring";

interface BandBadgeProps {
  band?: ScoreBand | null;
  score?: number | null;
  size?: "sm" | "default";
  showDot?: boolean;
  className?: string;
}

export function BandBadge({
  band,
  score,
  size = "default",
  showDot = true,
  className,
}: BandBadgeProps) {
  const resolvedBand =
    band ?? (score !== undefined && score !== null ? getBandFromScore(score) : null);
  const meta = getBandMeta(resolvedBand);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-medium border rounded-full transition-colors shrink-0",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        meta.badgeClass,
        className
      )}
    >
      {showDot && (
        <span
          className={cn(
            "rounded-full shrink-0",
            size === "sm" ? "w-1.5 h-1.5" : "w-2 h-2",
            meta.dotColor
          )}
          aria-hidden="true"
        />
      )}
      <span>{meta.label}</span>
    </span>
  );
}
