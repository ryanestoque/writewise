import { cn } from "@/lib/utils";
import type { ScoreBand } from "@/lib/utils/scoring";

interface BandPositionBarProps {
  score?: number | null;
  band?: ScoreBand | null;
  showLabel?: boolean;
  height?: "sm" | "default";
  className?: string;
}

export function BandPositionBar({
  score,
  showLabel = false,
  height = "default",
  className,
}: BandPositionBarProps) {
  const numericScore =
    typeof score === "number" && !isNaN(score)
      ? Math.max(0, Math.min(100, score))
      : null;

  return (
    <div className={cn("w-full flex items-center gap-2.5", className)}>
      <div
        role="progressbar"
        aria-valuenow={numericScore !== null ? Math.round(numericScore) : undefined}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={
          numericScore !== null
            ? `Diagnostic score position: ${Math.round(numericScore)}%`
            : "Diagnostic score not yet available"
        }
        className={cn(
          "relative flex-1 rounded-full overflow-hidden bg-muted/40 border border-border/50 grid grid-cols-4 p-0.5",
          height === "sm" ? "h-2.5" : "h-3.5"
        )}
      >
        {/* 4 Colored Band Zones: Clay, Gold, Sage, Forest */}
        <div className="bg-band-1/25 dark:bg-band-1/30 rounded-l-full border-r border-background/60" />
        <div className="bg-band-2/25 dark:bg-band-2/30 border-r border-background/60" />
        <div className="bg-band-3/25 dark:bg-band-3/30 border-r border-background/60" />
        <div className="bg-band-4/25 dark:bg-band-4/30 rounded-r-full" />

        {/* Marker indicator for current score */}
        {numericScore !== null && (
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-300 ease-out z-10 motion-reduce:transition-none"
            style={{ left: `${numericScore}%` }}
          >
            <div
              className={cn(
                "rounded-full bg-foreground shadow-xs border-2 border-background ring-1 ring-border/60",
                height === "sm" ? "w-2.5 h-2.5" : "w-3.5 h-3.5"
              )}
            />
          </div>
        )}
      </div>

      {showLabel && (
        <span className="font-sans text-xs font-semibold tabular-nums text-foreground min-w-[2.5rem] text-right shrink-0">
          {numericScore !== null ? `${numericScore.toFixed(1)}%` : "—"}
        </span>
      )}
    </div>
  );
}
