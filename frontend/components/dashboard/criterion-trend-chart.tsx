"use client";

import { useState, useMemo, useEffect } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
} from "recharts";
import type { StudentScoreHistoryItem } from "@/lib/hooks/use-dashboard";
import { getBandFromScore, getBandMeta } from "@/lib/utils/scoring";
import { BandBadge } from "@/components/shared/band-badge";
import { LineChart as LineChartIcon, Info, Table2, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

import { CRITERION_CONFIG, CHART_BAND_AREAS, CHART_DOT_STROKE } from "@/lib/utils/chart-theme";

interface CriterionTrendChartProps {
  history: StudentScoreHistoryItem[];
  className?: string;
}

export function CriterionTrendChart({
  history,
  className,
}: CriterionTrendChartProps) {
  const [viewMode, setViewMode] = useState<"chart" | "table">("chart");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [activeCriteria, setActiveCriteria] = useState<Record<string, boolean>>({
    composite: true,
    letter_formation: true,
    size_consistency: false,
    spacing: false,
    slant: false,
    baseline_alignment: false,
  });

  useEffect(() => {
    const checkDark = () => {
      const isDarkMode =
        document.documentElement.classList.contains("dark") ||
        (!document.documentElement.classList.contains("light") &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);
      setIsDark(isDarkMode);
    };
    checkDark();

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", checkDark);

    const observer = new MutationObserver(() => checkDark());
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      mediaQuery.removeEventListener("change", checkDark);
      observer.disconnect();
    };
  }, []);

  const getCriterionColor = (c: (typeof CRITERION_CONFIG)[number]) =>
    isDark ? c.darkColor : c.lightColor;

  const toggleCriterion = (key: string) => {
    setActiveCriteria((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const resetCriteria = () => {
    setActiveCriteria({
      composite: true,
      letter_formation: true,
      size_consistency: false,
      spacing: false,
      slant: false,
      baseline_alignment: false,
    });
  };

  const handleTabKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const nextMode = viewMode === "chart" ? "table" : "chart";
      setViewMode(nextMode);
      const targetTabId =
        nextMode === "chart"
          ? "progress-view-tab-chart"
          : "progress-view-tab-table";
      setTimeout(() => {
        document.getElementById(targetTabId)?.focus();
      }, 0);
    }
  };

  const isCustomized =
    !activeCriteria.composite ||
    !activeCriteria.letter_formation ||
    activeCriteria.size_consistency ||
    activeCriteria.spacing ||
    activeCriteria.slant ||
    activeCriteria.baseline_alignment;

  const chartData = useMemo(() => {
    return history.map((item, idx) => {
      const date = new Date(item.submissionDate);
      const formattedDate = date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });

      return {
        id: item.submissionId,
        index: idx + 1,
        dateLabel: `${formattedDate}`,
        fullDate: date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        activity: item.targetText,
        composite: item.compositeScore,
        letter_formation: item.scores.letter_formation,
        size_consistency: item.scores.size_consistency,
        spacing: item.scores.spacing,
        slant: item.scores.slant,
        baseline_alignment: item.scores.baseline_alignment,
      };
    });
  }, [history]);

  const accessibleSummary = useMemo(() => {
    if (!history || history.length === 0) return "";
    const first = history[0];
    const latest = history[history.length - 1];
    const firstScore = first.compositeScore != null ? Math.round(first.compositeScore) : null;
    const latestScore = latest.compositeScore != null ? Math.round(latest.compositeScore) : null;
    const startDate = new Date(first.submissionDate).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const endDate = new Date(latest.submissionDate).toLocaleDateString("en-US", { month: "short", day: "numeric" });

    let trendDesc = "remained consistent";
    if (firstScore != null && latestScore != null) {
      if (latestScore > firstScore) trendDesc = `improved from ${firstScore}% to ${latestScore}%`;
      else if (latestScore < firstScore) trendDesc = `moved from ${firstScore}% to ${latestScore}%`;
      else trendDesc = `remained steady at ${latestScore}%`;
    }

    const activeList = CRITERION_CONFIG.filter((c) => activeCriteria[c.key]).map((c) => c.label).join(", ");

    return `Across ${history.length} worksheets from ${startDate} to ${endDate}, overall penmanship score ${trendDesc}. Currently showing lines for: ${activeList || "none"}.`;
  }, [history, activeCriteria]);

  if (!history || history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 rounded-xl border border-dashed border-border bg-muted/20 text-center">
        <LineChartIcon className="size-8 text-muted-foreground/60 mb-2" />
        <h3 className="text-xs font-semibold text-foreground">No Assessment History</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5 max-w-xs">
          This student doesn&apos;t have any graded submissions yet. Grade an activity to begin tracking progress.
        </p>
      </div>
    );
  }

  if (history.length === 1) {
    const single = history[0];
    return (
      <div className="space-y-3 p-4 rounded-xl border border-border bg-muted/10">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <Info className="size-4 text-brand-600" />
          <span>Single Submission Recorded</span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Score: <strong className="text-foreground">{single.compositeScore?.toFixed(1)}%</strong> ({getBandMeta(single.compositeBand).label}) on {new Date(single.submissionDate).toLocaleDateString()}. Multiple submissions are needed to render a trend trajectory line chart.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Controls Bar: Criteria Filter Pills + View Mode Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1 border-b border-border/50 pb-3">
        {viewMode === "chart" ? (
          <>
            {/* Mobile Filter Toggle (sm:hidden) */}
            <div className="sm:hidden w-full space-y-2">
              <button
                type="button"
                onClick={() => setMobileFiltersOpen((prev) => !prev)}
                aria-expanded={mobileFiltersOpen}
                aria-controls="mobile-skills-filter-list"
                className="w-full flex items-center justify-between px-3 py-2 min-h-[40px] rounded-lg border border-border/70 bg-card text-xs font-medium text-foreground hover:bg-muted/40 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-1.5 truncate">
                  <SlidersHorizontal className="size-3.5 text-brand-600 dark:text-brand-400 shrink-0" aria-hidden="true" />
                  <span className="text-muted-foreground">Showing:</span>
                  <span className="font-semibold truncate">
                    {(() => {
                      const activeLabels = CRITERION_CONFIG.filter((c) => activeCriteria[c.key]).map((c) => c.label);
                      if (activeLabels.length === 0) return "None selected";
                      if (activeLabels.length <= 2) return activeLabels.join(", ");
                      return `${activeLabels.slice(0, 2).join(", ")} +${activeLabels.length - 2} more`;
                    })()}
                  </span>
                </span>
                <span className="text-[11px] text-brand-700 dark:text-brand-300 font-semibold shrink-0 ml-2">
                  {mobileFiltersOpen ? "Done" : "Filter skills"}
                </span>
              </button>

              {mobileFiltersOpen && (
                <div id="mobile-skills-filter-list" className="p-2.5 rounded-xl border border-border/70 bg-muted/20 space-y-2">
                  <div className="grid grid-cols-2 gap-1.5">
                    {CRITERION_CONFIG.map((c) => {
                      const isSelected = activeCriteria[c.key];
                      return (
                        <button
                          key={c.key}
                          type="button"
                          onClick={() => toggleCriterion(c.key)}
                          aria-pressed={isSelected}
                          className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-2 min-h-[40px] rounded-lg text-xs font-medium transition-all cursor-pointer border text-left",
                            isSelected
                              ? "bg-card border-brand-600/50 text-foreground font-semibold shadow-xs"
                              : "bg-background/60 border-transparent text-muted-foreground opacity-70"
                          )}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: getCriterionColor(c) }}
                            aria-hidden="true"
                          />
                          <span className="truncate">{c.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  {isCustomized && (
                    <button
                      type="button"
                      onClick={resetCriteria}
                      className="w-full min-h-[40px] py-2 text-center text-xs text-brand-700 dark:text-brand-300 font-medium hover:underline cursor-pointer flex items-center justify-center"
                    >
                      Reset to default view
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Desktop Filter Pills (hidden sm:flex) */}
            <div className="hidden sm:flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mr-1">
                <SlidersHorizontal className="size-3.5 text-brand-600 dark:text-brand-400" />
                <span>Show:</span>
              </div>
              {CRITERION_CONFIG.map((c) => {
                const isSelected = activeCriteria[c.key];
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => toggleCriterion(c.key)}
                    aria-pressed={isSelected}
                    aria-label={`Toggle ${c.label} trend line`}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[40px] sm:min-h-[36px] rounded-lg text-xs font-medium transition-all cursor-pointer border focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                      isSelected
                        ? "bg-card border-brand-600/40 text-foreground font-semibold shadow-xs"
                        : "bg-muted/40 border-transparent text-muted-foreground hover:text-foreground opacity-70"
                    )}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: getCriterionColor(c) }}
                      aria-hidden="true"
                    />
                    <span>{c.label}</span>
                  </button>
                );
              })}
              {isCustomized && (
                <button
                  type="button"
                  onClick={resetCriteria}
                  className="inline-flex items-center px-2.5 py-1.5 min-h-[40px] sm:min-h-[36px] text-xs text-brand-700 dark:text-brand-300 hover:text-brand-800 dark:hover:text-brand-200 hover:bg-brand-50/60 dark:hover:bg-brand-950/40 rounded-lg font-medium cursor-pointer transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  Reset view
                </button>
              )}
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground font-medium">
            Scores and feedback across all {history.length} completed worksheets.
          </p>
        )}

        {/* View Switcher Tablist */}
        <div
          role="tablist"
          aria-label="Progress view mode"
          onKeyDown={handleTabKeyDown}
          className="flex items-center gap-1 self-start sm:self-auto bg-muted/40 p-1 rounded-lg border border-border/60 shrink-0"
        >
          <button
            id="progress-view-tab-chart"
            role="tab"
            type="button"
            aria-selected={viewMode === "chart"}
            aria-controls="progress-view-panel-chart"
            tabIndex={viewMode === "chart" ? 0 : -1}
            onClick={() => setViewMode("chart")}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-2.5 sm:py-1 min-h-[40px] sm:min-h-[32px] rounded-md text-xs font-medium transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500",
              viewMode === "chart"
                ? "bg-card text-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LineChartIcon className="size-3.5" aria-hidden="true" />
            <span>Chart</span>
          </button>
          <button
            id="progress-view-tab-table"
            role="tab"
            type="button"
            aria-selected={viewMode === "table"}
            aria-controls="progress-view-panel-table"
            tabIndex={viewMode === "table" ? 0 : -1}
            onClick={() => setViewMode("table")}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-2.5 sm:py-1 min-h-[40px] sm:min-h-[32px] rounded-md text-xs font-medium transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500",
              viewMode === "table"
                ? "bg-card text-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Table2 className="size-3.5" aria-hidden="true" />
            <span>Table</span>
          </button>
        </div>
      </div>

      {viewMode === "chart" ? (
        <div
          id="progress-view-panel-chart"
          role="tabpanel"
          aria-labelledby="progress-view-tab-chart"
          className="space-y-4"
        >
          {/* Screen Reader Accessible Summary */}
          <p className="sr-only">
            {accessibleSummary}
          </p>

          {/* Chart Box with Accessible Region */}
          <div
            role="region"
            aria-label="Cursive handwriting progress trend chart across 5 skills"
            className="h-64 sm:h-72 w-full pt-1"
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 12, right: 12, left: -16, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="currentColor"
                  className="text-border/60"
                  vertical={false}
                />

                {/* Shaded Band Background Zones */}
                {CHART_BAND_AREAS.map((band) => (
                  <ReferenceArea
                    key={band.label}
                    y1={band.y1}
                    y2={band.y2}
                    fill={band.fill}
                    fillOpacity={isDark ? band.darkOpacity : band.lightOpacity}
                  />
                ))}

                <XAxis
                  dataKey="dateLabel"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "currentColor" }}
                  className="text-muted-foreground"
                />
                <YAxis
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: "currentColor" }}
                  className="text-muted-foreground"
                  unit="%"
                />

                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const data = payload[0].payload;
                    return (
                      <div className="p-3 bg-popover text-popover-foreground rounded-xl shadow-warm border border-border text-xs space-y-2 min-w-[200px] z-50">
                        <div className="border-b border-border/60 pb-1.5">
                          <p className="font-semibold text-foreground">{data.fullDate}</p>
                          <p className="text-[11px] text-muted-foreground truncate max-w-[220px]">
                            &quot;{data.activity}&quot;
                          </p>
                        </div>

                        <div className="space-y-1">
                          {CRITERION_CONFIG.map((c) => {
                            const val = data[c.key];
                            if (val === null || val === undefined) return null;
                            const band = getBandFromScore(val);
                            const meta = getBandMeta(band);
                            const color = getCriterionColor(c);
                            return (
                              <div
                                key={c.key}
                                className="flex items-center justify-between gap-3 text-[11px]"
                              >
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className="w-1.5 h-1.5 rounded-full shrink-0"
                                    style={{ backgroundColor: color }}
                                  />
                                  <span className="text-muted-foreground">{c.label}:</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="font-semibold tabular-nums text-foreground">
                                    {Number(val).toFixed(1)}%
                                  </span>
                                  <span
                                    className={cn(
                                      "text-[10px] px-1.5 py-0.5 rounded font-medium",
                                      meta.badgeClass
                                    )}
                                  >
                                    {meta.shortLabel}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }}
                />

                {CRITERION_CONFIG.map((c) => {
                  if (!activeCriteria[c.key]) return null;
                  const color = getCriterionColor(c);
                  return (
                    <Line
                      key={c.key}
                      type="monotone"
                      dataKey={c.key}
                      name={c.label}
                      stroke={color}
                      strokeWidth={c.strokeWidth}
                      strokeDasharray={c.strokeDasharray}
                      dot={{
                        r: c.key === "composite" ? 4 : 3,
                        fill: color,
                        stroke: isDark ? CHART_DOT_STROKE.dark : CHART_DOT_STROKE.light,
                        strokeWidth: 1.5,
                      }}
                      activeDot={{
                        r: 5,
                        strokeWidth: 2,
                        stroke: isDark ? CHART_DOT_STROKE.dark : CHART_DOT_STROKE.light,
                      }}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Band Zones Legend */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-4 pt-2 text-[11px] text-muted-foreground border-t border-border/50">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-band-4/60 border border-band-4/80" />
              <span>Excellent (75–100%)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-band-3/60 border border-band-3/80" />
              <span>Satisfactory (50–74%)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-band-2/60 border border-band-2/80" />
              <span>Developing (25–49%)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-band-1/60 border border-band-1/80" />
              <span>Needs Improvement (0–24%)</span>
            </span>
          </div>
        </div>
      ) : (
        /* Accessible Tabular View with Horizontal Scroll Cue */
        <div
          id="progress-view-panel-table"
          role="tabpanel"
          aria-labelledby="progress-view-tab-table"
          className="rounded-xl border border-border bg-card overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <caption className="sr-only">
                Chronological list of completed cursive worksheets and individual handwriting skill scores
              </caption>
              <thead>
                <tr className="border-b border-border bg-muted/30 text-muted-foreground font-semibold">
                  <th scope="col" className="py-2.5 px-3 whitespace-nowrap">Date</th>
                  <th scope="col" className="py-2.5 px-3 min-w-[140px]">Worksheet Activity</th>
                  <th scope="col" className="py-2.5 px-3 text-right whitespace-nowrap">Overall Penmanship</th>
                  <th scope="col" className="py-2.5 px-3 text-right whitespace-nowrap">Letter Shapes</th>
                  <th scope="col" className="py-2.5 px-3 text-right whitespace-nowrap">Size &amp; Proportions</th>
                  <th scope="col" className="py-2.5 px-3 text-right whitespace-nowrap">Spacing</th>
                  <th scope="col" className="py-2.5 px-3 text-right whitespace-nowrap">Slant &amp; Tilt</th>
                  <th scope="col" className="py-2.5 px-3 text-right whitespace-nowrap">Line Alignment</th>
                </tr>
              </thead>
            <tbody className="divide-y divide-border/60">
              {history.map((item) => {
                const formattedDate = new Date(item.submissionDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });
                return (
                  <tr key={item.submissionId} className="hover:bg-muted/20 transition-colors">
                    <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap font-medium">
                      {formattedDate}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-foreground truncate max-w-[180px]" title={item.targetText}>
                      &ldquo;{item.targetText}&rdquo;
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold font-sans tabular-nums text-foreground">
                      <div className="flex items-center justify-end gap-1.5">
                        <span>{item.compositeScore != null ? `${item.compositeScore.toFixed(1)}%` : "—"}</span>
                        <BandBadge score={item.compositeScore} size="sm" />
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-sans tabular-nums text-muted-foreground">
                      {item.scores.letter_formation != null ? `${item.scores.letter_formation.toFixed(0)}%` : "—"}
                    </td>
                    <td className="py-2.5 px-3 text-right font-sans tabular-nums text-muted-foreground">
                      {item.scores.size_consistency != null ? `${item.scores.size_consistency.toFixed(0)}%` : "—"}
                    </td>
                    <td className="py-2.5 px-3 text-right font-sans tabular-nums text-muted-foreground">
                      {item.scores.spacing != null ? `${item.scores.spacing.toFixed(0)}%` : "—"}
                    </td>
                    <td className="py-2.5 px-3 text-right font-sans tabular-nums text-muted-foreground">
                      {item.scores.slant != null ? `${item.scores.slant.toFixed(0)}%` : "—"}
                    </td>
                    <td className="py-2.5 px-3 text-right font-sans tabular-nums text-muted-foreground">
                      {item.scores.baseline_alignment != null ? `${item.scores.baseline_alignment.toFixed(0)}%` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="sm:hidden px-3 py-1.5 bg-muted/20 border-t border-border/50 text-[11px] text-muted-foreground text-center">
          Scroll horizontally to view all 5 penmanship criteria columns &rarr;
        </div>
      </div>
    )}
  </div>
);
}
