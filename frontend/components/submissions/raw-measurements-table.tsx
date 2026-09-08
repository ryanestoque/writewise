"use client";

import { useMemo } from "react";
import type { Submission } from "@/lib/hooks/use-submissions";
import { CRITERIA_GUIDE } from "./manual-rubric-entry-form";
import { Info, Eye } from "lucide-react";

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
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          5 Physical Penmanship Features
        </h3>
        <span className="text-[11px] text-muted-foreground">Tap to inspect</span>
      </div>

      <div className="space-y-2">
        {rawCriteria.map((c) => {
          const isSelected = selectedCriterion === c.name;
          const activeCriterionInfo = CRITERIA_GUIDE[c.name] ?? null;
          const inlineId = `raw-criterion-guide-inline-${c.name.toLowerCase().replace(/\s+/g, "-")}`;
          return (
            <div key={c.name} className="space-y-1.5">
              <button
                type="button"
                onClick={() => onSelectCriterion(c.name)}
                aria-expanded={isSelected}
                aria-controls={
                  isSelected
                    ? `${inlineId} criterion-diagnostic-guide`
                    : undefined
                }
                aria-label={`${c.name}: ${c.primaryValue}. Tap to inspect.`}
                className={`w-full flex flex-col p-2.5 sm:p-3 rounded-xl border transition-all text-xs text-left cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring min-h-[44px] sm:min-h-0 touch-manipulation ${
                  isSelected
                    ? "bg-brand-50/80 dark:bg-brand-950/60 border-brand-300 dark:border-brand-800 shadow-xs ring-1 ring-brand-400/40"
                    : "bg-surface dark:bg-card border-border/70 hover:border-brand-300 dark:hover:border-brand-800 hover:bg-muted/30"
                }`}
              >
                <div className="w-full flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-semibold text-foreground truncate block">
                      {c.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-sans font-semibold text-foreground tabular-nums text-xs px-2 py-0.5 rounded-md bg-muted/60 border border-border/60">
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
                        <span className="font-sans font-semibold text-foreground tabular-nums text-right truncate">
                          {sub.value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </button>

              {/* Inline Mobile & Tablet Coaching Tip when selected (lg:hidden) */}
              {isSelected && activeCriterionInfo && (
                <div
                  id={inlineId}
                  role="region"
                  aria-label={`${c.name} coaching tip`}
                  className="lg:hidden p-2.5 rounded-lg bg-brand-50/70 dark:bg-brand-950/40 border border-brand-200/80 dark:border-brand-900 text-xs space-y-1 animate-in fade-in-50 duration-150 text-left"
                >
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-brand-800 dark:text-brand-300">
                    <Info
                      className="size-3 text-brand-600 dark:text-brand-400"
                      aria-hidden="true"
                    />
                    <h4 className="font-semibold text-brand-800 dark:text-brand-300">
                      Diagnostic Goal:
                    </h4>
                  </div>
                  <p className="text-[11px] text-foreground/80 leading-relaxed">
                    {activeCriterionInfo.rubricGoal}
                  </p>
                  <div className="pt-1 border-t border-brand-200/60 dark:border-brand-900/60 flex items-start gap-1 text-[11px] text-brand-800 dark:text-brand-300">
                    <Eye
                      className="size-3 text-brand-600 dark:text-brand-400 shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <span className="leading-normal">
                      <strong>Tip:</strong> {activeCriterionInfo.coachingTip}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
