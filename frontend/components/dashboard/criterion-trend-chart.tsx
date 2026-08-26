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
import { LineChart as LineChartIcon, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface CriterionTrendChartProps {
  history: StudentScoreHistoryItem[];
  className?: string;
}

const CRITERION_CONFIG = [
  {
    key: "composite",
    label: "Overall Composite",
    color: "var(--color-brand-600, #1b6b63)",
    strokeWidth: 3,
    strokeDasharray: undefined,
  },
  {
    key: "letter_formation",
    label: "Letter Formation",
    color: "#298d83",
    strokeWidth: 2,
    strokeDasharray: "4 2",
  },
  {
    key: "size_consistency",
    label: "Size Consistency",
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
    label: "Slant Angle",
    color: "#b6754a",
    strokeWidth: 2,
    strokeDasharray: "4 2",
  },
  {
    key: "baseline_alignment",
    label: "Baseline Alignment",
    color: "#4a8b5c",
    strokeWidth: 2,
    strokeDasharray: "4 2",
  },
];

export function CriterionTrendChart({
  history,
  className,
}: CriterionTrendChartProps) {
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
    <div className={cn("space-y-3.5", className)}>
      {/* Criteria Filter Pills */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <span className="text-[11px] font-medium text-muted-foreground mr-1">Show:</span>
        {CRITERION_CONFIG.map((c) => {
          const isSelected = activeCriteria[c.key];
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => toggleCriterion(c.key)}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer border",
                isSelected
                  ? "bg-surface dark:bg-card border-border shadow-xs text-foreground font-semibold"
                  : "bg-muted/40 border-transparent text-muted-foreground hover:text-foreground opacity-60"
              )}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: c.color }}
              />
              <span>{c.label}</span>
            </button>
          );
        })}
      </div>

      {/* Chart Box */}
      <div className="h-64 sm:h-72 w-full pt-2">
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
            <ReferenceArea y1={75} y2={100} fill="#4a8b5c" fillOpacity={0.07} />
            <ReferenceArea y1={50} y2={75} fill="#7c9b6e" fillOpacity={0.07} />
            <ReferenceArea y1={25} y2={50} fill="#c9a227" fillOpacity={0.07} />
            <ReferenceArea y1={0} y2={25} fill="#b6754a" fillOpacity={0.07} />

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
                  <div className="p-3 bg-popover text-popover-foreground rounded-xl shadow-warm border border-border text-xs space-y-2 min-w-[180px] z-50">
                    <div className="border-b border-border/60 pb-1.5">
                      <p className="font-semibold text-foreground">{data.fullDate}</p>
                      <p className="text-[11px] text-muted-foreground truncate max-w-[200px]">
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
      <div className="flex flex-wrap items-center justify-center gap-3 pt-1 text-[10px] text-muted-foreground border-t border-border/50">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2 rounded bg-band-4/40" /> Excellent (75–100%)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2 rounded bg-band-3/40" /> Satisfactory (50–75%)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2 rounded bg-band-2/40" /> Developing (25–50%)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2 rounded bg-band-1/40" /> Needs Improvement (0–25%)
        </span>
      </div>
    </div>
  );
}
