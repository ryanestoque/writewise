"use client";

import { useMemo } from "react";
import type { Submission } from "@/lib/hooks/use-submissions";
import { CRITERIA_GUIDE } from "./manual-rubric-entry-form";
import { CV_BENCHMARK_RANGES } from "@/lib/utils/scoring";
import { Info } from "lucide-react";

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
    const slantRaw = measurement?.raw_output?.slant_analysis;
    const slantAnalysis = slantRaw && typeof slantRaw === "object" && !Array.isArray(slantRaw)
      ? slantRaw as Record<string, unknown>
      : null;
    const withinWordStd = typeof slantAnalysis?.within_word_std_deg === "number"
      && Number.isFinite(slantAnalysis.within_word_std_deg)
      ? slantAnalysis.within_word_std_deg
      : null;
    const slantCoverage = typeof slantAnalysis?.measured_words === "number"
      && typeof slantAnalysis?.total_words === "number"
      ? `${slantAnalysis.measured_words} / ${slantAnalysis.total_words}`
      : "Not recorded";
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
          badgeClass: "bg-band-1/15 text-band-1-text border-band-1/40 dark:bg-band-1/25 dark:text-orange-200 dark:border-band-1/50",
          dotClass: "bg-band-1",
        };
      }
    } else {
      formationBenchmark = {
        status: "qualitative",
        label: "Teacher Rubric",
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
            : "bg-band-1/15 text-band-1-text border-band-1/40 dark:bg-band-1/25 dark:text-orange-200 dark:border-band-1/50",
        dotClass: isOptimal ? "bg-emerald-500" : isBorderline ? "bg-amber-500" : "bg-band-1",
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
            : "bg-band-1/15 text-band-1-text border-band-1/40 dark:bg-band-1/25 dark:text-orange-200 dark:border-band-1/50",
        dotClass: isOptimal ? "bg-emerald-500" : isBorderline ? "bg-amber-500" : "bg-band-1",
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
        label: isOptimal ? "Mean within target" : isBorderline ? "Mean borderline" : "Mean deviating",
        badgeClass: isOptimal
          ? "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
          : isBorderline
            ? "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
            : "bg-band-1/15 text-band-1-text border-band-1/40 dark:bg-band-1/25 dark:text-orange-200 dark:border-band-1/50",
        dotClass: isOptimal ? "bg-emerald-500" : isBorderline ? "bg-amber-500" : "bg-band-1",
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
            : "bg-band-1/15 text-band-1-text border-band-1/40 dark:bg-band-1/25 dark:text-orange-200 dark:border-band-1/50",
        dotClass: isOptimal ? "bg-emerald-500" : isBorderline ? "bg-amber-500" : "bg-band-1",
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
            : "Teacher Rubric",
        description:
          "Cursive stroke curvature, loop closures, and connection smoothness.",
        benchmark: formationBenchmark,
        targetText: "Qualitative Cursive Loops",
        subDetails: [
          {
            label: "Scoring method",
            value:
              measurement?.letter_formation_mean != null
                ? "Automated Model"
                : "Teacher Rubric",
          },
          {
            label: "Formation score",
            value:
              measurement?.letter_formation_mean != null
                ? formatMetric(measurement.letter_formation_mean, null, "%")
                : "Rubric Graded",
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
        targetText: CV_BENCHMARK_RANGES.wordSpacing.label,
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
            value: `~${CV_BENCHMARK_RANGES.wordSpacing.shortLabel} (finger space)`,
          },
          {
            label: "Letter gap target",
            value: `~${CV_BENCHMARK_RANGES.letterSpacing.shortLabel} (~1 letter 'o')`,
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
            : slantAnalysis ? "Not measurable" : "—",
        description:
          "Mean sustained stem lean from vertical, with direction variation measured within and between words. Target angles are provisional.",
        benchmark: slantBenchmark,
        targetText: CV_BENCHMARK_RANGES.slant.label,
        subDetails: [
          {
            label: "Mean stem lean",
            value:
              measurement?.slant_mean != null && !Number.isNaN(Number(measurement.slant_mean))
                ? `${Number(measurement.slant_mean).toFixed(1)}°`
                : "—",
          },
          {
            label: "Provisional forward lean",
            value: `${CV_BENCHMARK_RANGES.slant.minDeg.toFixed(1)}° – ${CV_BENCHMARK_RANGES.slant.maxDeg.toFixed(1)}° (from vertical)`,
          },
          {
            label: "Between-word variation",
            value:
              measurement?.slant_std != null && !Number.isNaN(Number(measurement.slant_std))
                ? `±${Number(measurement.slant_std).toFixed(1)}°`
                : "—",
          },
          {
            label: "Within-word variation (RMS)",
            value: withinWordStd !== null
              ? `${withinWordStd.toFixed(1)}°`
              : slantAnalysis ? "Not measurable" : "Not recorded",
          },
          {
            label: "Words measured",
            value: slantCoverage,
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
      {!measurement && (
        <div className="p-2.5 rounded-xl bg-muted/40 border border-border/70 text-xs text-muted-foreground flex items-center gap-2">
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
          const secondaryNote =
            c.name === "Spacing" && measurement?.letter_spacing_mean != null
              ? `Letter gap: ${formatMetric(measurement.letter_spacing_mean, measurement.letter_spacing_std, "x")}`
              : c.name === "Slant Angle" && c.subDetails?.[3]?.value && c.subDetails[3].value !== "Not recorded"
                ? `Within-word: ${c.subDetails[3].value}`
                : null;

          return (
            <div key={c.name} className="space-y-1">
              <div
                className={`w-full flex flex-col p-2.5 sm:px-3 sm:py-2.5 rounded-xl border transition-all text-xs text-left ${
                  isSelected
                    ? "bg-brand-50/80 dark:bg-brand-950/60 border-brand-300 dark:border-brand-800 shadow-xs ring-1 ring-brand-400/40"
                    : "bg-surface dark:bg-card border-border/70 hover:border-brand-300 dark:hover:border-brand-800 hover:bg-muted/30"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectCriterion(c.name)}
                  aria-expanded={isSelected}
                  aria-labelledby={`${titleId} ${valueId}`}
                  aria-controls={
                    isSelected
                      ? activeCriterionInfo
                        ? `${inlineId} criterion-diagnostic-guide`
                        : inlineId
                      : undefined
                  }
                  className="w-full flex items-center justify-between gap-2 text-left cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded-lg touch-manipulation min-h-[40px] sm:min-h-0"
                >
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
                  <span id={valueId} className="font-sans font-semibold text-foreground tabular-nums text-xs px-2 py-0.5 rounded-md bg-muted/60 border border-border/60 shrink-0">
                    {c.primaryValue}
                  </span>
                </button>

                {/* Visual Target Range Meter */}
                {c.benchmark?.meter && (
                  <div className="mt-2 space-y-1 w-full">
                    <div
                      role="meter"
                      aria-label={`${c.name} target range meter`}
                      aria-valuenow={c.benchmark.meter.current}
                      aria-valuemin={c.benchmark.meter.min}
                      aria-valuemax={c.benchmark.meter.max}
                      aria-valuetext={`${c.benchmark.label}: ${c.primaryValue} (Target: ${c.targetText})`}
                      className="relative h-1.5 w-full bg-muted/70 dark:bg-muted/40 rounded-full overflow-hidden border border-border/50"
                    >
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
                              : "bg-band-1"
                        }`}
                        style={{
                          left: `${Math.max(2, Math.min(98, ((c.benchmark.meter.current - c.benchmark.meter.min) / (c.benchmark.meter.max - c.benchmark.meter.min)) * 100))}%`,
                        }}
                        title={`Measured value: ${c.primaryValue}`}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground tabular-nums">
                      <span>{secondaryNote ?? c.description}</span>
                      <span className="shrink-0 font-medium">Target: {c.targetText}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Inline Mobile & Tablet Coaching Tip when selected (lg:hidden) */}
              {isSelected && activeCriterionInfo && (
                <div
                  id={inlineId}
                  role="region"
                  aria-label={`${c.name} coaching tip`}
                  className="lg:hidden p-2.5 rounded-lg bg-brand-50/70 dark:bg-brand-950/40 border border-brand-200/80 dark:border-brand-900 text-[11px] space-y-1 animate-in fade-in-50 duration-150 motion-reduce:animate-none text-left"
                >
                  <p className="text-foreground/85 leading-snug">
                    <strong className="font-semibold text-brand-900 dark:text-brand-200">{c.name}:</strong>{" "}
                    {activeCriterionInfo.rubricGoal}
                  </p>
                  <p className="text-brand-800 dark:text-brand-300 leading-snug">
                    <strong>Tip:</strong> {activeCriterionInfo.coachingTip}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
