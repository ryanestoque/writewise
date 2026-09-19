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
  if (Number.isNaN(numMean)) return "—";
  const formattedMean = Number.isInteger(numMean)
    ? numMean.toString()
    : numMean.toFixed(2);

  if (std !== null && std !== undefined) {
    const numStd = Number(std);
    if (!Number.isNaN(numStd)) {
      const formattedStd = Number.isInteger(numStd)
        ? numStd.toString()
        : numStd.toFixed(2);
      return `${formattedMean} ± ${formattedStd}${unit ? ` ${unit}` : ""}`;
    }
  }
  return `${formattedMean}${unit ? ` ${unit}` : ""}`;
}

export function formatStd(
  std: number | null | undefined,
  unit: string = ""
): string {
  if (std === null || std === undefined) return "—";
  const numStd = Number(std);
  if (Number.isNaN(numStd)) return "—";
  const formattedStd = Number.isInteger(numStd)
    ? numStd.toString()
    : numStd.toFixed(2);
  return `±${formattedStd}${unit ? ` ${unit}` : ""}`;
}

export interface RawMeasurementsTableProps {
  measurement: Submission["measurement"];
  selectedCriterion: string | null;
  onSelectCriterion: (criterionName: string) => void;
}

export interface BenchmarkIndicator {
  status: "within_target" | "borderline" | "deviating" | "qualitative";
  label: string;
  badgeClass: string;
  dotClass: string;
  meter?: {
    min: number;
    max: number;
    targetMin: number;
    targetMax: number;
    current: number;
  };
}

export function RawMeasurementsTable({
  measurement,
  selectedCriterion,
  onSelectCriterion,
}: RawMeasurementsTableProps) {
  const rawCriteria = useMemo(() => {
    // 1. Letter formation benchmark
    let formationBenchmark: BenchmarkIndicator;
    if (measurement?.letter_formation_mean != null) {
      const val = Number(measurement.letter_formation_mean);
      if (val >= 80) {
        formationBenchmark = {
          status: "within_target",
          label: "Optimal (CNN)",
          badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
          dotClass: "bg-emerald-500",
        };
      } else if (val >= 60) {
        formationBenchmark = {
          status: "borderline",
          label: "Developing",
          badgeClass: "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
          dotClass: "bg-amber-500",
        };
      } else {
        formationBenchmark = {
          status: "deviating",
          label: "Needs Focus",
          badgeClass: "bg-[#9c4a2f]/10 text-[#9c4a2f] border-[#9c4a2f]/30 dark:bg-[#9c4a2f]/20 dark:text-[#e07a5f] dark:border-[#9c4a2f]/50",
          dotClass: "bg-[#9c4a2f]",
        };
      }
    } else {
      formationBenchmark = {
        status: "qualitative",
        label: "Phase 1 Rubric",
        badgeClass: "bg-brand-50 text-brand-800 border-brand-300 dark:bg-brand-950/60 dark:text-brand-300 dark:border-brand-800",
        dotClass: "bg-brand-600",
      };
    }

    // 2. Size consistency benchmark (target: 0.85 - 1.00)
    let sizeBenchmark: BenchmarkIndicator | undefined;
    if (measurement?.size_consistency_mean != null && !Number.isNaN(Number(measurement.size_consistency_mean))) {
      const val = Number(measurement.size_consistency_mean);
      const isOptimal = val >= 0.85 && val <= 1.05;
      const isBorderline = (val >= 0.70 && val < 0.85) || (val > 1.05 && val <= 1.20);
      sizeBenchmark = {
        status: isOptimal ? "within_target" : isBorderline ? "borderline" : "deviating",
        label: isOptimal ? "Within Target" : isBorderline ? "Borderline" : "Deviating",
        badgeClass: isOptimal
          ? "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
          : isBorderline
            ? "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
            : "bg-[#9c4a2f]/10 text-[#9c4a2f] border-[#9c4a2f]/30 dark:bg-[#9c4a2f]/20 dark:text-[#e07a5f] dark:border-[#9c4a2f]/50",
        dotClass: isOptimal ? "bg-emerald-500" : isBorderline ? "bg-amber-500" : "bg-[#9c4a2f]",
        meter: { min: 0.5, max: 1.3, targetMin: 0.85, targetMax: 1.0, current: val },
      };
    }

    // 3. Spacing benchmark (target: 1.5 - 2.5x)
    let spacingBenchmark: BenchmarkIndicator | undefined;
    if (measurement?.word_spacing_mean != null && !Number.isNaN(Number(measurement.word_spacing_mean))) {
      const val = Number(measurement.word_spacing_mean);
      const isOptimal = val >= 1.5 && val <= 2.5;
      const isBorderline = (val >= 1.1 && val < 1.5) || (val > 2.5 && val <= 2.9);
      spacingBenchmark = {
        status: isOptimal ? "within_target" : isBorderline ? "borderline" : "deviating",
        label: isOptimal ? "Within Target" : isBorderline ? "Borderline" : "Deviating",
        badgeClass: isOptimal
          ? "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
          : isBorderline
            ? "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
            : "bg-[#9c4a2f]/10 text-[#9c4a2f] border-[#9c4a2f]/30 dark:bg-[#9c4a2f]/20 dark:text-[#e07a5f] dark:border-[#9c4a2f]/50",
        dotClass: isOptimal ? "bg-emerald-500" : isBorderline ? "bg-amber-500" : "bg-[#9c4a2f]",
        meter: { min: 0.8, max: 3.2, targetMin: 1.5, targetMax: 2.5, current: val },
      };
    }

    // 4. Slant benchmark (target: 6.0° - 15.0°)
    let slantBenchmark: BenchmarkIndicator | undefined;
    if (measurement?.slant_mean != null && !Number.isNaN(Number(measurement.slant_mean))) {
      const val = Number(measurement.slant_mean);
      const isOptimal = val >= 6.0 && val <= 15.0;
      const isBorderline = (val >= 3.0 && val < 6.0) || (val > 15.0 && val <= 19.0);
      slantBenchmark = {
        status: isOptimal ? "within_target" : isBorderline ? "borderline" : "deviating",
        label: isOptimal ? "Within Target" : isBorderline ? "Borderline" : "Deviating",
        badgeClass: isOptimal
          ? "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
          : isBorderline
            ? "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
            : "bg-[#9c4a2f]/10 text-[#9c4a2f] border-[#9c4a2f]/30 dark:bg-[#9c4a2f]/20 dark:text-[#e07a5f] dark:border-[#9c4a2f]/50",
        dotClass: isOptimal ? "bg-emerald-500" : isBorderline ? "bg-amber-500" : "bg-[#9c4a2f]",
        meter: { min: 0, max: 24, targetMin: 6.0, targetMax: 15.0, current: val },
      };
    }

    // 5. Baseline benchmark (target: < 0.05 drift ratio)
    let baselineBenchmark: BenchmarkIndicator | undefined;
    if (measurement?.baseline_deviation_mean != null && !Number.isNaN(Number(measurement.baseline_deviation_mean))) {
      const val = Number(measurement.baseline_deviation_mean);
      const isOptimal = val <= 0.05;
      const isBorderline = val > 0.05 && val <= 0.15;
      baselineBenchmark = {
        status: isOptimal ? "within_target" : isBorderline ? "borderline" : "deviating",
        label: isOptimal ? "Within Target" : isBorderline ? "Borderline" : "High Drift",
        badgeClass: isOptimal
          ? "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
          : isBorderline
            ? "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
            : "bg-[#9c4a2f]/10 text-[#9c4a2f] border-[#9c4a2f]/30 dark:bg-[#9c4a2f]/20 dark:text-[#e07a5f] dark:border-[#9c4a2f]/50",
        dotClass: isOptimal ? "bg-emerald-500" : isBorderline ? "bg-amber-500" : "bg-[#9c4a2f]",
        meter: { min: 0, max: 0.8, targetMin: 0, targetMax: 0.05, current: val },
      };
    }

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
            : "Phase 1 Rubric",
        description:
          "Cursive stroke aesthetics and loop closures evaluated via Teacher Rubric in Phase 1 (automated via fine-tuned CNN in Phase 2).",
        benchmark: formationBenchmark,
        targetText: "Qualitative Cursive Loops",
        subDetails: [
          {
            label: "Evaluation model",
            value:
              measurement?.letter_formation_mean != null
                ? "CNN Calibrated (Phase 2)"
                : "Teacher Rubric (Phase 1)",
          },
          {
            label: "Formation quality",
            value:
              measurement?.letter_formation_mean != null
                ? formatMetric(measurement.letter_formation_mean, null, "%")
                : "Qualitative Rubric",
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
          "Proportion of lowercase core x-height relative to baseline-to-midline ruling distance (1.00 = full midline height).",
        benchmark: sizeBenchmark,
        targetText: "0.85 – 1.00 ratio",
        subDetails: [
          {
            label: "Core x-height ratio",
            value: formatMetric(measurement?.size_consistency_mean),
          },
          {
            label: "Target guideline ratio",
            value: "0.85 – 1.00 (at midline)",
          },
          {
            label: "Height variation (std)",
            value: formatStd(measurement?.size_consistency_std),
          },
        ],
      },
      {
        name: "Spacing",
        primaryValue: formatMetric(
          measurement?.word_spacing_mean,
          measurement?.word_spacing_std,
          "x guideline"
        ),
        description:
          "Word separation rhythm and inter-letter connector spacing normalized to ruling guideline height.",
        benchmark: spacingBenchmark,
        targetText: "1.5 – 2.5x guideline",
        subDetails: [
          {
            label: "Word-to-word gap",
            value: formatMetric(
              measurement?.word_spacing_mean,
              measurement?.word_spacing_std,
              "x"
            ),
          },
          {
            label: "Letter-to-letter gap",
            value: formatMetric(
              measurement?.letter_spacing_mean,
              measurement?.letter_spacing_std,
              "x"
            ),
          },
          {
            label: "Word gap target",
            value: "~1.5 – 2.5x (finger space)",
          },
          {
            label: "Letter gap target",
            value: "~0.3 – 0.5x (~1 letter 'o')",
          },
        ],
      },
      {
        name: "Slant Angle",
        primaryValue:
          measurement?.slant_mean != null && !Number.isNaN(Number(measurement.slant_mean))
            ? `${Number(measurement.slant_mean).toFixed(1)}°${
                measurement.slant_std != null && !Number.isNaN(Number(measurement.slant_std))
                  ? ` ± ${Number(measurement.slant_std).toFixed(1)}°`
                  : ""
              }`
            : "—",
        description:
          "Average forward cursive stroke lean relative to vertical guideline perpendicular (Standard cursive lean: 6.0° – 15.0°).",
        benchmark: slantBenchmark,
        targetText: "6.0° – 15.0° forward",
        subDetails: [
          {
            label: "Mean forward slant",
            value:
              measurement?.slant_mean != null && !Number.isNaN(Number(measurement.slant_mean))
                ? `${Number(measurement.slant_mean).toFixed(1)}°`
                : "—",
          },
          {
            label: "Target forward lean",
            value: "6.0° – 15.0° (from vertical)",
          },
          {
            label: "Slant variation (std)",
            value:
              measurement?.slant_std != null && !Number.isNaN(Number(measurement.slant_std))
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
          "drift ratio"
        ),
        description:
          "Vertical distance of letter bases from the ruled penmanship baseline guideline across each word.",
        benchmark: baselineBenchmark,
        targetText: "< 0.05 drift ratio",
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
            value: formatStd(measurement?.baseline_deviation_std),
          },
        ],
      },
    ];
  }, [measurement]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          5 Physical Penmanship Features
        </h3>
        <span className="text-xs text-muted-foreground">Select a criterion to view guide</span>
      </div>

      {!measurement && (
        <div className="p-2 sm:p-2.5 rounded-xl bg-muted/40 border border-border/70 text-xs text-muted-foreground flex items-center gap-2">
          <Info className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
          <span>Physical geometric measurements are pending computer vision feature extraction.</span>
        </div>
      )}

      <div className="space-y-1.5">
        {rawCriteria.map((c) => {
          const isSelected = selectedCriterion === c.name;
          const activeCriterionInfo = CRITERIA_GUIDE[c.name] ?? null;
          const safeName = c.name.toLowerCase().replace(/\s+/g, "-");
          const inlineId = `raw-criterion-guide-inline-${safeName}`;
          const titleId = `raw-metric-title-${safeName}`;
          const valueId = `raw-metric-value-${safeName}`;
          const descId = `raw-metric-desc-${safeName}`;
          const detailsId = `raw-metric-details-${safeName}`;

          return (
            <div key={c.name} className="space-y-1">
              <button
                type="button"
                onClick={() => onSelectCriterion(c.name)}
                aria-expanded={isSelected}
                aria-labelledby={`${titleId} ${valueId}`}
                aria-describedby={`${descId} ${detailsId}`}
                aria-controls={
                  isSelected
                    ? `${inlineId} criterion-diagnostic-guide`
                    : undefined
                }
                className={`w-full flex flex-col p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl border transition-all text-xs text-left cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring min-h-[40px] sm:min-h-0 touch-manipulation ${
                  isSelected
                    ? "bg-brand-50/80 dark:bg-brand-950/60 border-brand-300 dark:border-brand-800 shadow-xs ring-1 ring-brand-400/40"
                    : "bg-surface dark:bg-card border-border/70 hover:border-brand-300 dark:hover:border-brand-800 hover:bg-muted/30"
                }`}
              >
                <div className="w-full flex items-center justify-between gap-2">
                  <div className="min-w-0 flex items-center gap-2 flex-wrap">
                    <span id={titleId} className="font-semibold text-foreground truncate block">
                      {c.name}
                    </span>
                    {c.benchmark && (
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${c.benchmark.badgeClass}`}
                      >
                        <span className={`size-1.5 rounded-full shrink-0 ${c.benchmark.dotClass}`} aria-hidden="true" />
                        <span>{c.benchmark.label}</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span id={valueId} className="font-sans font-semibold text-foreground tabular-nums text-xs px-2.5 py-0.5 rounded-md bg-muted/60 border border-border/60">
                      {c.primaryValue}
                    </span>
                  </div>
                </div>

                <span id={descId} className="text-xs text-muted-foreground mt-0.5 leading-snug block line-clamp-1">
                  {c.description}
                </span>

                {/* Visual Target Range Meter (if quantitative meter exists) */}
                {c.benchmark?.meter && (
                  <div className="mt-1.5 pt-1.5 border-t border-border/50 space-y-1 w-full">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground font-medium">
                      <span className="flex items-center gap-1">
                        <span>Range meter</span>
                        <span className="text-border">·</span>
                        <span className="text-foreground/80 font-semibold">{c.benchmark.label}</span>
                      </span>
                      <span className="tabular-nums font-medium">Target: {c.targetText}</span>
                    </div>
                    <div className="relative h-2 w-full bg-muted/70 dark:bg-muted/40 rounded-full overflow-hidden border border-border/50">
                      {/* Target Window Highlight */}
                      <div
                        className="absolute top-0 bottom-0 bg-emerald-500/20 dark:bg-emerald-500/30 border-x border-emerald-500/40"
                        style={{
                          left: `${Math.max(0, Math.min(100, ((c.benchmark.meter.targetMin - c.benchmark.meter.min) / (c.benchmark.meter.max - c.benchmark.meter.min)) * 100))}%`,
                          width: `${Math.max(4, Math.min(100, ((c.benchmark.meter.targetMax - c.benchmark.meter.targetMin) / (c.benchmark.meter.max - c.benchmark.meter.min)) * 100))}%`,
                        }}
                        title="Target Guideline Window"
                      />
                      {/* Measured Value Tick */}
                      <div
                        className={`absolute top-0 bottom-0 w-2 -ml-1 rounded-full shadow-xs transition-all ${
                          c.benchmark.status === "within_target"
                            ? "bg-emerald-600 dark:bg-emerald-400"
                            : c.benchmark.status === "borderline"
                              ? "bg-amber-600 dark:bg-amber-400"
                              : "bg-[#9c4a2f]"
                        }`}
                        style={{
                          left: `${Math.max(2, Math.min(98, ((c.benchmark.meter.current - c.benchmark.meter.min) / (c.benchmark.meter.max - c.benchmark.meter.min)) * 100))}%`,
                        }}
                        title={`Measured value: ${c.primaryValue}`}
                      />
                    </div>
                  </div>
                )}

                {c.subDetails && c.subDetails.length > 0 && (
                  <div id={detailsId} className="mt-1.5 pt-1.5 border-t border-border/50 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs w-full pr-1 sm:pr-2">
                    {c.subDetails.map((sub, sIdx) => (
                      <div
                        key={sIdx}
                        className="flex items-baseline justify-between gap-1.5 text-muted-foreground min-w-0"
                      >
                        <span className="shrink-0 font-medium text-muted-foreground">
                          {sub.label}:
                        </span>
                        <span className="font-sans font-semibold text-foreground tabular-nums text-right break-words sm:whitespace-normal">
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
                  className="lg:hidden p-2.5 rounded-lg bg-brand-50/70 dark:bg-brand-950/40 border border-brand-200/80 dark:border-brand-900 text-xs space-y-1 animate-in fade-in-50 duration-150 motion-reduce:animate-none text-left"
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
