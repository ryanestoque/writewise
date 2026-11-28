"use client";

import { useMemo } from "react";
import type { Submission } from "@/lib/hooks/use-submissions";
import { CRITERIA_GUIDE } from "./manual-rubric-entry-form";
import { CV_BENCHMARK_RANGES } from "@/lib/utils/scoring";
import { Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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
    const optimalBadgeClass =
      "bg-band-4/15 text-band-4-text border-band-4/40";
    const borderlineBadgeClass =
      "bg-band-2/15 text-band-2-text border-band-2/40";
    const deviatingBadgeClass =
      "bg-band-1/15 text-band-1-text border-band-1/40";

    // 1. Letter formation benchmark
    let formationBenchmark: BenchmarkIndicator;
    if (measurement?.letter_formation_mean != null) {
      const val = Number(measurement.letter_formation_mean);
      if (val >= CV_BENCHMARK_RANGES.letterFormation.minScore) {
        formationBenchmark = {
          status: "within_target",
          label: "Optimal (CNN)",
          badgeClass: optimalBadgeClass,
          dotClass: "bg-band-4",
        };
      } else if (val >= CV_BENCHMARK_RANGES.letterFormation.borderlineMinScore) {
        formationBenchmark = {
          status: "borderline",
          label: "Developing",
          badgeClass: borderlineBadgeClass,
          dotClass: "bg-band-2",
        };
      } else {
        formationBenchmark = {
          status: "deviating",
          label: "Needs Focus",
          badgeClass: deviatingBadgeClass,
          dotClass: "bg-band-1",
        };
      }
    } else {
      formationBenchmark = {
        status: "qualitative",
        label: "Teacher Rubric",
        badgeClass: "bg-secondary text-secondary-foreground border-border",
        dotClass: "bg-primary",
      };
    }

    // 2. Size consistency benchmark
    let sizeBenchmark: BenchmarkIndicator | undefined;
    if (measurement?.size_consistency_mean != null && !Number.isNaN(Number(measurement.size_consistency_mean))) {
      const val = Number(measurement.size_consistency_mean);
      const { minRatio, maxRatio, borderlineMinRatio, borderlineMaxRatio } = CV_BENCHMARK_RANGES.sizeConsistency;
      const isOptimal = val >= minRatio && val <= maxRatio;
      const isBorderline = (val >= borderlineMinRatio && val < minRatio) || (val > maxRatio && val <= borderlineMaxRatio);
      sizeBenchmark = {
        status: isOptimal ? "within_target" : isBorderline ? "borderline" : "deviating",
        label: isOptimal ? "Within Target" : isBorderline ? "Borderline" : "Deviating",
        badgeClass: isOptimal
          ? optimalBadgeClass
          : isBorderline
            ? borderlineBadgeClass
            : deviatingBadgeClass,
        dotClass: isOptimal ? "bg-band-4" : isBorderline ? "bg-band-2" : "bg-band-1",
        meter: { min: 0.5, max: 1.3, targetMin: minRatio, targetMax: maxRatio, current: val },
      };
    }

    // 3. Spacing benchmark
    let spacingBenchmark: BenchmarkIndicator | undefined;
    if (measurement?.word_spacing_mean != null && !Number.isNaN(Number(measurement.word_spacing_mean))) {
      const val = Number(measurement.word_spacing_mean);
      const { minRatio, maxRatio, borderlineMinRatio, borderlineMaxRatio } = CV_BENCHMARK_RANGES.wordSpacing;
      const isOptimal = val >= minRatio && val <= maxRatio;
      const isBorderline = (val >= borderlineMinRatio && val < minRatio) || (val > maxRatio && val <= borderlineMaxRatio);
      spacingBenchmark = {
        status: isOptimal ? "within_target" : isBorderline ? "borderline" : "deviating",
        label: isOptimal ? "Within Target" : isBorderline ? "Borderline" : "Deviating",
        badgeClass: isOptimal
          ? optimalBadgeClass
          : isBorderline
            ? borderlineBadgeClass
            : deviatingBadgeClass,
        dotClass: isOptimal ? "bg-band-4" : isBorderline ? "bg-band-2" : "bg-band-1",
        meter: { min: 0.8, max: 3.2, targetMin: minRatio, targetMax: maxRatio, current: val },
      };
    }

    // 4. Slant benchmark
    let slantBenchmark: BenchmarkIndicator | undefined;
    if (measurement?.slant_mean != null && !Number.isNaN(Number(measurement.slant_mean))) {
      const val = Number(measurement.slant_mean);
      const { minDeg, maxDeg, borderlineMinDeg, borderlineMaxDeg } = CV_BENCHMARK_RANGES.slant;
      const isOptimal = val >= minDeg && val <= maxDeg;
      const isBorderline = (val >= borderlineMinDeg && val < minDeg) || (val > maxDeg && val <= borderlineMaxDeg);
      slantBenchmark = {
        status: isOptimal ? "within_target" : isBorderline ? "borderline" : "deviating",
        label: isOptimal ? "Mean within target" : isBorderline ? "Mean borderline" : "Mean deviating",
        badgeClass: isOptimal
          ? optimalBadgeClass
          : isBorderline
            ? borderlineBadgeClass
            : deviatingBadgeClass,
        dotClass: isOptimal ? "bg-band-4" : isBorderline ? "bg-band-2" : "bg-band-1",
        meter: { min: 0, max: 24, targetMin: minDeg, targetMax: maxDeg, current: val },
      };
    }

    // 5. Baseline benchmark
    let baselineBenchmark: BenchmarkIndicator | undefined;
    if (measurement?.baseline_deviation_mean != null && !Number.isNaN(Number(measurement.baseline_deviation_mean))) {
      const val = Number(measurement.baseline_deviation_mean);
      const { maxRatio, borderlineMaxRatio } = CV_BENCHMARK_RANGES.baselineDeviation;
      const isOptimal = val <= maxRatio;
      const isBorderline = val > maxRatio && val <= borderlineMaxRatio;
      baselineBenchmark = {
        status: isOptimal ? "within_target" : isBorderline ? "borderline" : "deviating",
        label: isOptimal ? "Within Target" : isBorderline ? "Borderline" : "High Drift",
        badgeClass: isOptimal
          ? optimalBadgeClass
          : isBorderline
            ? borderlineBadgeClass
            : deviatingBadgeClass,
        dotClass: isOptimal ? "bg-band-4" : isBorderline ? "bg-band-2" : "bg-band-1",
        meter: { min: 0, max: 0.8, targetMin: 0, targetMax: maxRatio, current: val },
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
        targetText: CV_BENCHMARK_RANGES.sizeConsistency.label,
        subDetails: [
          {
            label: "Core x-height ratio",
            value: formatMetric(measurement?.size_consistency_mean),
          },
          {
            label: "Target guideline ratio",
            value: CV_BENCHMARK_RANGES.sizeConsistency.label,
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
        targetText: CV_BENCHMARK_RANGES.baselineDeviation.label,
        subDetails: [
          {
            label: "Mean baseline drift",
            value: formatMetric(measurement?.baseline_deviation_mean),
          },
          {
            label: "Target alignment",
            value: CV_BENCHMARK_RANGES.baselineDeviation.label,
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
    <div className="flex flex-col gap-1.5">
      {!measurement && (
        <Alert
          role="status"
          className="bg-muted/40 border-border/70 px-3 py-2 text-xs text-muted-foreground items-center"
        >
          <Info aria-hidden="true" />
          <AlertDescription className="text-xs">
            Physical geometric measurements are pending computer vision feature extraction.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-1.5">
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
            <div key={c.name} className="flex flex-col gap-1">
              <Card
                size="sm"
                className={cn(
                  "py-2.5 shadow-none transition-colors text-xs text-left",
                  isSelected
                    ? "bg-primary/5 border-primary/40 shadow-xs ring-1 ring-primary/25"
                    : "border-border/70 hover:border-primary/40 hover:bg-muted/30"
                )}
              >
                <CardContent className="flex flex-col px-2.5 sm:px-3">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => onSelectCriterion(c.name)}
                    aria-pressed={isSelected}
                    aria-labelledby={`${titleId} ${valueId}`}
                    className="w-full h-auto px-0 justify-between gap-2 text-left font-normal whitespace-normal hover:bg-transparent cursor-pointer rounded-lg touch-manipulation min-h-11 sm:min-h-0"
                  >
                    <div className="min-w-0 flex items-center gap-2 flex-wrap">
                      <span id={titleId} className="font-semibold text-foreground truncate block">
                        {c.name}
                      </span>
                      {c.benchmark && (
                        <Badge
                          variant="outline"
                          className={cn(
                            "h-auto rounded-full text-xs font-semibold px-2 py-0.5 gap-1",
                            c.benchmark.badgeClass
                          )}
                        >
                          <span
                            className={cn("size-1.5 rounded-full shrink-0", c.benchmark.dotClass)}
                            aria-hidden="true"
                          />
                          <span>{c.benchmark.label}</span>
                        </Badge>
                      )}
                    </div>
                    <Badge
                      id={valueId}
                      variant="outline"
                      className="h-auto font-sans font-semibold text-foreground tabular-nums text-xs px-2 py-0.5 rounded-md bg-muted/60 border-border/60 shrink-0"
                    >
                      {c.primaryValue}
                    </Badge>
                  </Button>

                  {/* Visual Target Range Meter */}
                  {c.benchmark?.meter && (
                    <div className="mt-2 flex flex-col gap-1 w-full">
                      <div
                        role="meter"
                        aria-label={`${c.name} target range meter`}
                        aria-valuenow={c.benchmark.meter.current}
                        aria-valuemin={c.benchmark.meter.min}
                        aria-valuemax={c.benchmark.meter.max}
                        aria-valuetext={`${c.benchmark.label}: ${c.primaryValue} (Target: ${c.targetText})`}
                        className="relative h-1.5 w-full bg-muted/70 rounded-full overflow-hidden border border-border/50"
                      >
                        {/* Target Window Highlight */}
                        <div
                          className="absolute top-0 bottom-0 bg-band-4/25 border-x border-band-4/50"
                          style={{
                            left: `${Math.max(0, Math.min(100, ((c.benchmark.meter.targetMin - c.benchmark.meter.min) / (c.benchmark.meter.max - c.benchmark.meter.min)) * 100))}%`,
                            width: `${Math.max(4, Math.min(100, ((c.benchmark.meter.targetMax - c.benchmark.meter.targetMin) / (c.benchmark.meter.max - c.benchmark.meter.min)) * 100))}%`,
                          }}
                          title="Target Guideline Window"
                        />
                        {/* Measured Value Tick */}
                        <div
                          className={cn(
                            "absolute top-0 bottom-0 w-2 -ml-1 rounded-full shadow-xs transition-[left,background-color]",
                            c.benchmark.status === "within_target"
                              ? "bg-band-4"
                              : c.benchmark.status === "borderline"
                                ? "bg-band-2"
                                : "bg-band-1"
                          )}
                          style={{
                            left: `${Math.max(2, Math.min(98, ((c.benchmark.meter.current - c.benchmark.meter.min) / (c.benchmark.meter.max - c.benchmark.meter.min)) * 100))}%`,
                          }}
                          title={`Measured value: ${c.primaryValue}`}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground tabular-nums">
                        <span>{secondaryNote ?? c.description}</span>
                        <span className="shrink-0 font-medium">Target: {c.targetText}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Inline Mobile & Tablet Coaching Tip when selected (lg:hidden) */}
              {isSelected && activeCriterionInfo && (
                <Alert
                  id={inlineId}
                  role="region"
                  aria-label={`${c.name} coaching tip`}
                  className="lg:hidden rounded-lg bg-primary/5 border-primary/25 p-2.5 text-xs animate-in fade-in-50 duration-150 motion-reduce:animate-none text-left"
                >
                  <AlertDescription className="flex flex-col gap-1 text-xs text-left [&>p:not(:last-child)]:mb-0">
                    <p className="text-foreground/85 leading-snug">
                      <strong className="font-semibold text-foreground">{c.name}:</strong>{" "}
                      {activeCriterionInfo.rubricGoal}
                    </p>
                    <p className="text-primary leading-snug">
                      <strong>Tip:</strong> {activeCriterionInfo.coachingTip}
                    </p>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
