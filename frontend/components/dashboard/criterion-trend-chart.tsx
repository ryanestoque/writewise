"use client";

import { useState, useMemo } from "react";
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

interface CriterionTrendChartProps {
  history: StudentScoreHistoryItem[];
  className?: string;
}

const CRITERION_CONFIG = [
  {
    key: "composite",
    label: "Overall Score",
    color: "var(--color-brand-600, #1b6b63)",
    strokeWidth: 3,
    strokeDasharray: undefined,
  },
  {
    key: "letter_formation",
    label: "Letter Shapes",
    color: "#298d83",
    strokeWidth: 2,
    strokeDasharray: "4 2",
  },
  {
    key: "size_consistency",
    label: "Size & Proportions",
    color: "#c9a227",
    strokeWidth: 2,
    strokeDasharray: "4 2",
  },
  {
    key: "spacing",
    label: "Spacing",
    color: "#7c9b6e",
    strokeWidth: 2,
    strokeDasharray: "4 2",
  },
  {
    key: "slant",
    label: "Slant & Tilt",
    color: "#b6754a",
    strokeWidth: 2,
    strokeDasharray: "4 2",
  },
  {
    key: "baseline_alignment",
    label: "Line Alignment",
    color: "#4a8b5c",
    strokeWidth: 2,
    strokeDasharray: "4 2",
  },
];

export function CriterionTrendChart({
  history,
  className,
}: CriterionTrendChartProps) {
  const [viewMode, setViewMode] = useState<"chart" | "table">("chart");
  const [activeCriteria, setActiveCriteria] = useState<Record<string, boolean>>({
    composite: true,
    letter_formation: true,
    size_consistency: false,
    spacing: false,
    slant: false,
    baseline_alignment: false,
  });

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

  if (!history || history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 rounded-xl border border-dashed border-border bg-muted/20 text-center">
        <LineChartIcon className="size-8 text-muted-foreground/60 mb-2" />
        <h4 className="text-xs font-semibold text-foreground">No Assessment History</h4>
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
          <div className="flex flex-wrap items-center gap-2">
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
                    "inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] sm:min-h-[32px] rounded-lg text-xs font-medium transition-all cursor-pointer border focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                    isSelected
                      ? "bg-card border-brand-600/40 text-foreground font-semibold shadow-xs"
                      : "bg-muted/40 border-transparent text-muted-foreground hover:text-foreground opacity-70"
                  )}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: c.color }}
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
                className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-medium cursor-pointer ml-1 self-center"
              >
                Reset view
              </button>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground font-medium">
            Chronological scores and criterion diagnostics across all {history.length} assessed worksheets.
          </p>
        )}

        {/* View Switcher Button */}
        <div className="flex items-center gap-1 self-start sm:self-auto bg-muted/40 p-1 rounded-lg border border-border/60 shrink-0">
          <button
            type="button"
            onClick={() => setViewMode("chart")}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer",
              viewMode === "chart"
                ? "bg-card text-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-label="Switch to chart view"
          >
            <LineChartIcon className="size-3.5" />
            <span>Chart</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer",
              viewMode === "table"
                ? "bg-card text-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-label="Switch to accessible table view"
          >
            <Table2 className="size-3.5" />
            <span>Table</span>
          </button>
        </div>
      </div>

      {viewMode === "chart" ? (
        <>
          {/* Chart Box */}
          <div className="h-64 sm:h-72 w-full pt-1">
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
                <ReferenceArea y1={75} y2={100} fill="#4a8b5c" fillOpacity={0.12} />
                <ReferenceArea y1={50} y2={75} fill="#7c9b6e" fillOpacity={0.12} />
                <ReferenceArea y1={25} y2={50} fill="#c9a227" fillOpacity={0.12} />
                <ReferenceArea y1={0} y2={25} fill="#b6754a" fillOpacity={0.12} />

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
                            return (
                              <div
                                key={c.key}
                                className="flex items-center justify-between gap-3 text-[11px]"
                              >
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className="w-1.5 h-1.5 rounded-full shrink-0"
                                    style={{ backgroundColor: c.color }}
                                  />
                                  <span className="text-muted-foreground">{c.label}:</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="font-semibold tabular-nums text-foreground">
                                    {Number(val).toFixed(1)}%
                                  </span>
                                  <span
                                    className={cn(
                                      "text-[9px] px-1 py-0.2 rounded font-medium",
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
                  return (
                    <Line
                      key={c.key}
                      type="monotone"
                      dataKey={c.key}
                      name={c.label}
                      stroke={c.color}
                      strokeWidth={c.strokeWidth}
                      strokeDasharray={c.strokeDasharray}
                      dot={{
                        r: c.key === "composite" ? 4 : 3,
                        fill: c.color,
                        stroke: "var(--color-surface, #ffffff)",
                        strokeWidth: 1.5,
                      }}
                      activeDot={{
                        r: 5,
                        strokeWidth: 2,
                        stroke: "var(--color-surface, #ffffff)",
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
        </>
      ) : (
        /* Accessible Tabular View */
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-muted-foreground font-semibold">
                <th className="py-2.5 px-3 whitespace-nowrap">Date</th>
                <th className="py-2.5 px-3 min-w-[140px]">Worksheet Activity</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Overall</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Letter Shapes</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Size</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Spacing</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Slant</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Alignment</th>
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
      )}
    </div>
  );
}
