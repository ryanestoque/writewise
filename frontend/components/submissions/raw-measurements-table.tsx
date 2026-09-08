"use client";

import { useMemo } from "react";
import type { Submission } from "@/lib/hooks/use-submissions";
import { Badge } from "@/components/ui/badge";

export function formatMetric(
  mean: number | null | undefined,
  std?: number | null | undefined,
  unit: string = ""
): string {
  if (mean === null || mean === undefined) return "—";
  const numMean = Number(mean);
  const formattedMean = Number.isInteger(numMean)
    ? numMean.toString()
    : numMean.toFixed(2);

  if (std !== null && std !== undefined) {
    const numStd = Number(std);
    const formattedStd = Number.isInteger(numStd)
      ? numStd.toString()
      : numStd.toFixed(2);
    return `${formattedMean} ± ${formattedStd}${unit ? ` ${unit}` : ""}`;
  }
  return `${formattedMean}${unit ? ` ${unit}` : ""}`;
}

export interface RawMeasurementsTableProps {
  measurement: Submission["measurement"];
  selectedCriterion: string | null;
  onSelectCriterion: (criterionName: string) => void;
}

export function RawMeasurementsTable({
  measurement,
  selectedCriterion,
  onSelectCriterion,
}: RawMeasurementsTableProps) {
  const rawCriteria = useMemo(() => {
    return [
      {
        name: "Letter Formation",
        primaryValue:
          measurement?.letter_formation_mean != null
            ? formatMetric(
                measurement.letter_formation_mean,
                measurement.letter_formation_std,
                "%"
              )
            : "Awaiting Analysis",
        description:
          "OpenCV curvature and CNN stroke loop analysis across ascenders (b, d, h, k, l) and descenders (g, j, p, q, y, z).",
        subDetails: [
          {
            label: "Status",
            value:
              measurement?.letter_formation_mean != null
                ? "Feature Extracted"
                : "Awaiting Analysis",
          },
          {
            label: "Stroke curvature",
            value: formatMetric(measurement?.letter_formation_mean, null, "%"),
          },
        ],
      },
      {
        name: "Size Consistency",
        primaryValue: formatMetric(
          measurement?.size_consistency_mean,
          measurement?.size_consistency_std,
          "ratio"
        ),
        description:
          "Proportion of lowercase x-height relative to printed 3-line guidelines (Headline, Midline, Baseline).",
        subDetails: [
          {
            label: "Core x-height ratio",
            value: formatMetric(measurement?.size_consistency_mean),
          },
          {
            label: "Target guideline ratio",
            value: "0.50 (at midline)",
          },
          {
            label: "Height variation (std)",
            value: formatMetric(measurement?.size_consistency_std),
          },
        ],
      },
      {
        name: "Spacing",
        primaryValue: formatMetric(
          measurement?.word_spacing_mean,
          measurement?.word_spacing_std,
          "gap"
        ),
        description:
          "Word separation rhythm and inter-letter connector spacing normalized to ruling guidelines.",
        subDetails: [
          {
            label: "Word-to-word gap",
            value: formatMetric(
              measurement?.word_spacing_mean,
              measurement?.word_spacing_std
            ),
          },
          {
            label: "Letter-to-letter gap",
            value: formatMetric(
              measurement?.letter_spacing_mean,
              measurement?.letter_spacing_std
            ),
          },
          {
            label: "Target benchmark",
            value: "~1 lowercase 'o'",
          },
        ],
      },
      {
        name: "Slant Angle",
        primaryValue:
          measurement?.slant_mean != null
            ? `${Number(measurement.slant_mean).toFixed(1)}°${
                measurement.slant_std != null
                  ? ` ± ${Number(measurement.slant_std).toFixed(1)}°`
                  : ""
              }`
            : "—",
        description:
          "Average forward cursive stroke angle relative to baseline perpendicular (Target standard: 60°–68°).",
        subDetails: [
          {
            label: "Mean slant angle",
            value:
              measurement?.slant_mean != null
                ? `${Number(measurement.slant_mean).toFixed(1)}°`
                : "—",
          },
          {
            label: "Target slant range",
            value: "60.0° – 68.0°",
          },
          {
            label: "Slant consistency (std)",
            value:
              measurement?.slant_std != null
                ? `±${Number(measurement.slant_std).toFixed(1)}°`
                : "—",
          },
        ],
      },
      {
        name: "Baseline Alignment",
        primaryValue: formatMetric(
          measurement?.baseline_deviation_mean,
          measurement?.baseline_deviation_std,
          "drift"
        ),
        description:
          "Vertical distance of letter bases from the ruled penmanship baseline guideline across each word.",
        subDetails: [
          {
            label: "Mean baseline drift",
            value: formatMetric(measurement?.baseline_deviation_mean),
          },
          {
            label: "Target alignment",
            value: "< 0.05 drift ratio",
          },
          {
            label: "Drift variation (std)",
            value: formatMetric(measurement?.baseline_deviation_std),
          },
        ],
      },
    ];
  }, [measurement]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          5 Physical Penmanship Features
        </span>
        <span className="text-[11px] text-muted-foreground">Tap to inspect</span>
      </div>

      <div className="space-y-2">
        {rawCriteria.map((c) => {
          const isSelected = selectedCriterion === c.name;
          return (
            <button
              key={c.name}
              type="button"
              onClick={() => onSelectCriterion(c.name)}
              aria-pressed={isSelected}
              aria-controls="criterion-diagnostic-guide"
              aria-label={`${c.name}: ${c.primaryValue}. Tap to inspect.`}
              className={`w-full flex flex-col p-2.5 sm:p-3 rounded-xl border transition-all text-xs text-left cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring min-h-[44px] sm:min-h-0 ${
                isSelected
                  ? "bg-brand-50/80 dark:bg-brand-950/60 border-brand-300 dark:border-brand-800 shadow-xs ring-1 ring-brand-400/40"
                  : "bg-surface dark:bg-card border-border/70 hover:border-brand-300 dark:hover:border-brand-800 hover:bg-muted/30"
              }`}
            >
              <div className="w-full flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-semibold text-foreground truncate block">
                    {c.name}
                  </span>
                  {isSelected && (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 bg-brand-100 text-brand-800 dark:bg-brand-900 dark:text-brand-200 border-brand-300"
                    >
                      Active
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono font-semibold text-foreground tabular-nums text-xs px-2 py-0.5 rounded-md bg-muted/60 border border-border/60">
                    {c.primaryValue}
                  </span>
                </div>
              </div>

              <span className="text-[11px] text-muted-foreground mt-0.5 leading-snug block line-clamp-2">
                {c.description}
              </span>

              {c.subDetails && c.subDetails.length > 0 && (
                <div className="mt-1.5 pt-1.5 border-t border-border/50 grid grid-cols-1 sm:grid-cols-2 gap-x-3.5 gap-y-1 text-[11px] w-full">
                  {c.subDetails.map((sub, sIdx) => (
                    <div
                      key={sIdx}
                      className="flex items-baseline justify-between gap-1.5 text-muted-foreground min-w-0"
                    >
                      <span className="shrink-0 font-medium text-muted-foreground/90">
                        {sub.label}:
                      </span>
                      <span className="font-mono font-semibold text-foreground tabular-nums text-right truncate">
                        {sub.value}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
