import { cn } from "@/lib/utils";
import { getBandFromScore, type ScoreBand } from "@/lib/utils/scoring";

interface BandPositionBarProps {
  score?: number | null;
  band?: ScoreBand | null;
  showLabel?: boolean;
  showThresholds?: boolean;
  showBandLabels?: boolean;
  height?: "sm" | "default";
  className?: string;
  ariaLabel?: string;
  ariaValueText?: string;
}

export function BandPositionBar({
  score,
  band,
  showLabel = false,
  showThresholds = false,
  showBandLabels = true,
  height = "default",
  className,
  ariaLabel,
  ariaValueText,
}: BandPositionBarProps) {
  const numericScore =
    typeof score === "number" && !isNaN(score)
      ? Math.max(0, Math.min(100, score))
      : null;
  const activeBand = band ?? getBandFromScore(numericScore);

  return (
    <div className={cn("flex w-full flex-col gap-1", className)}>
      <div className="w-full flex items-center gap-2.5">
        <div
          role="progressbar"
          aria-valuenow={numericScore !== null ? Math.round(numericScore) : undefined}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext={ariaValueText}
          aria-label={
            ariaLabel ??
            (numericScore !== null
              ? `Diagnostic score position: ${Math.round(numericScore)}%`
              : "Diagnostic score not yet available")
          }
          className={cn(
            "relative flex-1 rounded-full overflow-hidden bg-muted/40 border border-border/50 grid grid-cols-4 p-0.5",
            height === "sm" ? "h-2.5" : "h-3.5"
          )}
        >
          {/* 4 Colored Band Zones: Clay, Gold, Sage, Forest */}
          <div className="bg-band-1/45 rounded-l-full border-r border-background/80" />
          <div className="bg-band-2/45 border-r border-background/80" />
          <div className="bg-band-3/45 border-r border-background/80" />
          <div className="bg-band-4/45 rounded-r-full" />

          {/* Marker indicator for current score */}
          {numericScore !== null && (
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-300 ease-out z-10 motion-reduce:transition-none"
              style={{ left: `${numericScore}%` }}
            >
              <div
                className={cn(
                  "rounded-full bg-foreground shadow-xs border-2 border-background ring-1 ring-border/60",
                  height === "sm" ? "size-2.5" : "size-3.5"
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

      {/* Explicit Band Names — Dual-Signal Accessibility Rule */}
      {showBandLabels && (
        <div
          aria-hidden="true"
          className="grid grid-cols-4 gap-1 sm:gap-2 text-[11px] sm:text-xs leading-tight select-none pt-1"
        >
          <span
            className={cn(
              "text-left sm:text-center",
              activeBand === "needs_improvement"
                ? "font-semibold text-band-1-text"
                : "font-medium text-muted-foreground"
            )}
          >
            <span className="sm:hidden">Needs Imp.</span>
            <span className="hidden sm:inline">Needs Improvement</span>
          </span>
          <span
            className={cn(
              "text-center",
              activeBand === "developing"
                ? "font-semibold text-band-2-text"
                : "font-medium text-muted-foreground"
            )}
          >
            Developing
          </span>
          <span
            className={cn(
              "text-center",
              activeBand === "satisfactory"
                ? "font-semibold text-band-3-text"
                : "font-medium text-muted-foreground"
            )}
          >
            Satisfactory
          </span>
          <span
            className={cn(
              "text-right sm:text-center",
              activeBand === "excellent"
                ? "font-semibold text-band-4-text"
                : "font-medium text-muted-foreground"
            )}
          >
            Excellent
          </span>
        </div>
      )}

      {showThresholds && (
        <div
          aria-hidden="true"
          className="flex items-center justify-between text-xs text-muted-foreground font-sans tabular-nums select-none"
        >
          <span>0%</span>
          <span title="Developing (25%)">25%</span>
          <span title="Satisfactory (50%)" className="font-medium text-foreground/80">50%</span>
          <span title="Excellent (75%)" className="font-medium text-foreground/80">75%</span>
          <span>100%</span>
        </div>
      )}
    </div>
  );
}
