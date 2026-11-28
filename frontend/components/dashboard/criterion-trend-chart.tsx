"use client";

import { useState, useMemo, useEffect, useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

function useIsMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceArea,
} from "recharts";
import type { StudentScoreHistoryItem } from "@/lib/hooks/use-dashboard";
import { getBandFromScore, getBandMeta } from "@/lib/utils/scoring";
import { BandBadge } from "@/components/shared/band-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LineChart as LineChartIcon, Info, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatScoreDifference,
  getScoreProgressDirection,
  getScoreProgressLabel,
} from "@/lib/utils/score-progress";

import { CRITERION_CONFIG, CHART_BAND_AREAS, CHART_DOT_STROKE } from "@/lib/utils/chart-theme";

const CHART_CONFIG: ChartConfig = Object.fromEntries(
  CRITERION_CONFIG.map((c) => [
    c.key,
    {
      label: c.label,
      theme: {
        light: c.lightColor,
        dark: c.darkColor,
      },
    },
  ])
);

interface CriterionTrendChartProps {
  history: StudentScoreHistoryItem[];
  className?: string;
  variant?: "teacher" | "parent";
  showScoreDetails?: boolean;
  onToggleScoreDetails?: () => void;
  practiceFocusKey?: string | null;
  showBandLegend?: boolean;
}

export function CriterionTrendChart({
  history,
  className,
  variant = "teacher",
  showScoreDetails: controlledShowDetails,
  onToggleScoreDetails,
  practiceFocusKey,
  showBandLegend = true,
}: CriterionTrendChartProps) {
  const isParent = variant === "parent";
  const showScoreDetails =
    controlledShowDetails !== undefined ? controlledShowDetails : true;

  const [viewMode, setViewMode] = useState<"chart" | "table">("chart");
  const [isDark, setIsDark] = useState(false);
  const [visibleSeries, setVisibleSeries] = useState<Set<string>>(() =>
    isParent ? new Set(["composite"]) : new Set(["composite", "letter_formation"])
  );

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  const hasMounted = useIsMounted();

  useEffect(() => {
    const checkDark = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };
    checkDark();

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleMotionChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    motionQuery.addEventListener("change", handleMotionChange);

    const observer = new MutationObserver(() => checkDark());
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      motionQuery.removeEventListener("change", handleMotionChange);
      observer.disconnect();
    };
  }, []);

  const getCriterionColor = (c: (typeof CRITERION_CONFIG)[number]) =>
    isDark ? c.darkColor : c.lightColor;

  const resetCriteria = () => {
    setVisibleSeries(
      isParent ? new Set(["composite"]) : new Set(["composite", "letter_formation"])
    );
  };

  const showAllSkills = () => {
    setVisibleSeries(new Set(CRITERION_CONFIG.map((c) => c.key)));
  };

  const isCustomized = isParent
    ? visibleSeries.size !== 1 || !visibleSeries.has("composite")
    : visibleSeries.size !== 2 ||
      !visibleSeries.has("composite") ||
      !visibleSeries.has("letter_formation");

  const hasActiveCriteria = visibleSeries.size > 0;

  const chartData = useMemo(() => {
    const dateCounts: Record<string, number> = {};
    history.forEach((item) => {
      const d = new Date(item.submissionDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      dateCounts[d] = (dateCounts[d] || 0) + 1;
    });

    const uniqueDateCount = Object.keys(dateCounts).length;
    const allSameDate = uniqueDateCount === 1 && history.length > 1;

    return history.map((item, idx) => {
      const date = new Date(item.submissionDate);
      const formattedDate = date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });

      const isFirstOfThisDate =
        idx === 0 ||
        new Date(history[idx - 1].submissionDate).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }) !== formattedDate;

      let dateLabel: string;
      if (allSameDate) {
        dateLabel = `#${idx + 1}`;
      } else if (dateCounts[formattedDate] > 1) {
        dateLabel = isFirstOfThisDate ? `${formattedDate} (#${idx + 1})` : `#${idx + 1}`;
      } else {
        dateLabel = formattedDate;
      }

      return {
        id: item.submissionId,
        index: idx + 1,
        submissionIndex: idx + 1,
        dateLabel,
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
    const firstScore = first.compositeScore;
    const latestScore = latest.compositeScore;
    const startDate = new Date(first.submissionDate).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const endDate = new Date(latest.submissionDate).toLocaleDateString("en-US", { month: "short", day: "numeric" });

    const difference = firstScore != null && latestScore != null ? latestScore - firstScore : null;
    const trendDesc = difference == null
      ? "Overall comparison is not available."
      : `${getScoreProgressLabel(difference, "first")}${showScoreDetails ? ` (${formatScoreDifference(difference)})` : ""}.`;

    const activeList = CRITERION_CONFIG.filter((c) => visibleSeries.has(c.key)).map((c) => c.label).join(", ");

    return `Across ${history.length} worksheets from ${startDate} to ${endDate}. ${trendDesc} Currently showing lines for: ${activeList || "none"}.`;
  }, [history, visibleSeries, showScoreDetails]);

  const trajectoryStats = useMemo(() => {
    if (!history || history.length < 2) return null;
    const first = history[0];
    const latest = history[history.length - 1];
    if (first.compositeScore == null || latest.compositeScore == null) return null;
    const diff = latest.compositeScore - first.compositeScore;
    const firstDate = new Date(first.submissionDate).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const latestDate = new Date(latest.submissionDate).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return {
      baselineScore: first.compositeScore,
      latestScore: latest.compositeScore,
      diff,
      direction: getScoreProgressDirection(diff),
      label: getScoreProgressLabel(diff, "first"),
      firstDate,
      latestDate,
      totalCount: history.length,
    };
  }, [history]);

  if (!history || history.length === 0) {
    return (
      <Empty className="border border-dashed border-border bg-muted/20 p-8 gap-2">
        <EmptyMedia variant="icon" className="mb-0 bg-transparent text-muted-foreground/60 [&_svg:not([class*='size-'])]:size-8">
          <LineChartIcon aria-hidden="true" />
        </EmptyMedia>
        <EmptyHeader className="gap-1">
          <EmptyTitle className="text-sm font-semibold">No Assessment History</EmptyTitle>
          <EmptyDescription className="text-xs max-w-xs">
            Completed worksheets will appear here to track progress over time.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (history.length === 1) {
    const single = history[0];
    const dateStr = new Date(single.submissionDate).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return (
      <Card size="sm" className={cn("shadow-warm-sm", className)}>
        <CardHeader>
          <CardTitle as="h4" className="text-sm font-semibold">
            First Worksheet Recorded
          </CardTitle>
          <CardDescription className="text-xs">
            Completed on {dateStr} • &ldquo;{single.targetText}&rdquo;
          </CardDescription>
          <CardAction>
            <BandBadge score={single.compositeScore} size="sm" />
          </CardAction>
        </CardHeader>
        <CardContent>
          <Alert className="bg-muted/20 border-border/40 text-xs">
            <Info className="text-primary" aria-hidden="true" />
            <AlertDescription className="text-xs text-muted-foreground">
              The progress chart will unlock automatically once a second worksheet is checked.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Tabs
      value={viewMode}
      onValueChange={(value) => setViewMode(value as "chart" | "table")}
      className={cn("flex flex-col gap-4", className)}
    >
      {/* Controls Bar */}
      <div className="flex flex-col gap-3 min-w-0">
        {/* Header Row: Label/Action on Left, Tabs on Right */}
        <div className="flex items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0 flex-wrap">
            {viewMode === "chart" ? (
              <>
                <span className="font-semibold text-foreground">
                  {isParent ? "Skills" : "Trend Lines"}
                </span>
                {isCustomized ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={resetCriteria}
                    className="h-auto min-h-11 md:min-h-7 px-2 -my-1 ml-0.5 text-xs font-medium text-primary hover:text-primary hover:underline hover:bg-muted/30 cursor-pointer"
                  >
                    Reset
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={showAllSkills}
                    className="h-auto min-h-11 md:min-h-7 px-2 -my-1 ml-0.5 text-xs font-medium text-primary hover:text-primary hover:underline hover:bg-muted/30 cursor-pointer"
                  >
                    Show all
                  </Button>
                )}
                {onToggleScoreDetails && (
                  <Toggle
                    size="sm"
                    variant="outline"
                    pressed={showScoreDetails}
                    onPressedChange={onToggleScoreDetails}
                    className="h-auto min-h-11 md:min-h-7 rounded-md px-2 py-0.5 ml-1 text-xs font-medium text-primary border-primary/25 bg-secondary/50 aria-pressed:bg-secondary/70 cursor-pointer"
                  >
                    {showScoreDetails ? "Hide scores" : "Show scores"}
                  </Toggle>
                )}
              </>
            ) : (
              <span className="font-semibold text-foreground">
                Score Table
              </span>
            )}
          </div>

          {/* Only 1 Tab Control in the entire component: [Chart] [Table] */}
          <TabsList
            aria-label="Progress view mode"
            className="group-data-horizontal/tabs:h-auto rounded-full bg-muted/60 p-1 border border-border/60 gap-1 shrink-0"
          >
            <TabsTrigger
              value="chart"
              className="min-h-11 md:min-h-8 h-auto px-3.5 py-1.5 sm:px-3 sm:py-1 text-xs font-medium gap-1.5 cursor-pointer data-active:bg-card data-active:text-foreground data-active:font-semibold data-active:shadow-xs"
            >
              <LineChartIcon data-icon="inline-start" aria-hidden="true" />
              <span>Chart</span>
            </TabsTrigger>
            <TabsTrigger
              value="table"
              className="min-h-11 md:min-h-8 h-auto px-3.5 py-1.5 sm:px-3 sm:py-1 text-xs font-medium gap-1.5 cursor-pointer data-active:bg-card data-active:text-foreground data-active:font-semibold data-active:shadow-xs"
            >
              <Table2 data-icon="inline-start" aria-hidden="true" />
              <span>Table</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Level 2: Skill Filter Chips (Single-line horizontal rail) */}
        {viewMode === "chart" && (
          <ScrollArea orientation="horizontal" hideScrollbar className="w-full -mx-1 px-1">
            <ToggleGroup
              multiple
              value={[...visibleSeries]}
              onValueChange={(vals) => {
                if (vals.length > 0) setVisibleSeries(new Set(vals));
              }}
              aria-label="Visible handwriting criteria"
              variant="outline"
              size="sm"
              className="w-max gap-1.5 py-0.5"
            >
              {CRITERION_CONFIG.map((c) => {
                const isSelected = visibleSeries.has(c.key);
                const color = getCriterionColor(c);
                return (
                  <ToggleGroupItem
                    key={c.key}
                    value={c.key}
                    className={cn(
                      "h-auto min-h-11 md:min-h-8 gap-1.5 px-3 py-1.5 sm:py-1 rounded-full text-xs font-medium transition-colors cursor-pointer select-none shrink-0",
                      isSelected
                        ? "bg-card aria-pressed:bg-card text-foreground border-border/90 shadow-2xs font-semibold ring-1 ring-border/50 hover:bg-card"
                        : "bg-muted/20 text-muted-foreground border-dashed border-border/60 hover:bg-muted/40 hover:text-foreground hover:border-border/90"
                    )}
                  >
                    <svg
                      width="18"
                      height="6"
                      viewBox="0 0 18 6"
                      className={cn("shrink-0 transition-opacity", !isSelected && "opacity-35")}
                      aria-hidden="true"
                    >
                      <line
                        x1="0"
                        y1="3"
                        x2="18"
                        y2="3"
                        stroke={color}
                        strokeWidth={c.key === "composite" ? 2.5 : 2}
                        strokeDasharray={c.strokeDasharray}
                      />
                    </svg>
                    <span>{c.label}</span>
                    {practiceFocusKey && c.key === practiceFocusKey && (
                      <Badge
                        variant="outline"
                        className="h-auto text-[10px] font-semibold text-secondary-foreground bg-secondary px-1.5 py-0.5 rounded-full border-primary/25"
                      >
                        Focus
                      </Badge>
                    )}
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
          </ScrollArea>
        )}
      </div>

      <Separator />

      <TabsContent value="chart" className="flex flex-col gap-4">
        {/* High-level Trajectory Summary */}
        {trajectoryStats && (
          <Card size="sm" className="bg-muted/20 shadow-none">
            <CardContent className="flex flex-col sm:grid sm:grid-cols-3 gap-2 sm:gap-2.5 text-xs">
              {/* Trend metric (order-first on mobile to provide headline context, 3rd column on desktop) */}
              <div className="order-first sm:order-none flex items-center justify-between sm:flex-col sm:items-start sm:gap-1 min-w-0">
                <span className="text-xs text-muted-foreground font-medium shrink-0">
                  <span className="sm:hidden">{trajectoryStats.totalCount} worksheets</span>
                  <span className="hidden sm:inline">Trend · {trajectoryStats.totalCount} worksheets</span>
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge
                    variant="outline"
                    className={cn(
                      "h-auto px-2.5 py-0.5 rounded-full font-semibold text-xs tabular-nums",
                      trajectoryStats.direction === "improving"
                        ? "bg-band-4/15 text-band-4-text border-band-4/30"
                        : trajectoryStats.direction === "lower"
                          ? "bg-band-2/15 text-band-2-text border-band-2/30"
                          : "bg-muted text-muted-foreground border-border/60"
                    )}
                  >
                    {trajectoryStats.label}
                    {showScoreDetails ? ` (${formatScoreDifference(trajectoryStats.diff)})` : ""}
                  </Badge>
                </div>
              </div>

              <Separator className="sm:hidden" />

              {/* Baseline (First) milestone */}
              <div className="flex items-center justify-between sm:flex-col sm:items-start sm:gap-1 min-w-0">
                <span className="text-xs text-muted-foreground font-medium font-sans tabular-nums">
                  First ({trajectoryStats.firstDate})
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {showScoreDetails && (
                    <span className="font-bold tabular-nums text-foreground text-sm sm:text-base">
                      {trajectoryStats.baselineScore.toFixed(1)}%
                    </span>
                  )}
                  <BandBadge score={trajectoryStats.baselineScore} size="sm" />
                </div>
              </div>

              {/* Latest milestone */}
              <div className="flex items-center justify-between sm:flex-col sm:items-start sm:gap-1 min-w-0">
                <span className="text-xs text-muted-foreground font-medium font-sans tabular-nums">
                  Latest ({trajectoryStats.latestDate})
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {showScoreDetails && (
                    <span className="font-bold tabular-nums text-foreground text-sm sm:text-base">
                      {trajectoryStats.latestScore.toFixed(1)}%
                    </span>
                  )}
                  <BandBadge score={trajectoryStats.latestScore} size="sm" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <p className="sr-only">
          {accessibleSummary}
        </p>

        {!hasActiveCriteria ? (
          <Empty className="h-64 sm:h-72 w-full border border-dashed border-border bg-muted/15 p-6 gap-3">
            <EmptyMedia variant="icon" className="mb-0 bg-transparent text-muted-foreground/70 [&_svg:not([class*='size-'])]:size-6">
              <Info aria-hidden="true" />
            </EmptyMedia>
            <EmptyHeader className="gap-1">
              <EmptyTitle className="text-sm font-semibold">No Skills Selected</EmptyTitle>
              <EmptyDescription className="text-xs leading-relaxed">
                Select one or more skills above to view progress lines.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                type="button"
                size="sm"
                onClick={resetCriteria}
                className="min-h-11 sm:min-h-8 h-auto px-3.5 py-1.5 text-xs font-medium cursor-pointer"
              >
                Show overall progress
              </Button>
            </EmptyContent>
          </Empty>
        ) : !hasMounted ? (
          <Skeleton
            className="h-64 sm:h-72 w-full min-h-[256px] rounded-xl flex items-center justify-center"
            aria-hidden="true"
          >
            <span className="text-xs text-muted-foreground/60">Rendering progress chart…</span>
          </Skeleton>
        ) : (
          <ChartContainer
            config={CHART_CONFIG}
            initialDimension={{ width: 500, height: 256 }}
            role="region"
            aria-label="Handwriting progress chart"
            className="aspect-auto h-64 sm:h-72 w-full min-w-0 min-h-[256px] relative pt-1"
          >
            <LineChart
              data={chartData}
              margin={{ top: 12, right: 12, left: showScoreDetails ? -16 : 4, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="currentColor"
                className="text-border/60"
                vertical={false}
              />

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
                tick={{ fontSize: 12, fill: "currentColor" }}
                className="text-muted-foreground"
              />
              <YAxis
                domain={[0, 100]}
                ticks={showScoreDetails ? [0, 25, 50, 75, 100] : [12.5, 37.5, 62.5, 87.5]}
                tickFormatter={
                  showScoreDetails
                    ? undefined
                    : (val: number) => {
                        if (val >= 75) return "Excellent";
                        if (val >= 50) return "Satisfactory";
                        if (val >= 25) return "Developing";
                        return "Needs Improvement";
                      }
                }
                width={showScoreDetails ? 52 : 112}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: "currentColor" }}
                className="text-muted-foreground"
                unit={showScoreDetails ? "%" : undefined}
              />

              <ChartTooltip
                content={
                  <ChartTooltipContent
                    indicator="dot"
                    className="min-w-[230px] p-3"
                    labelFormatter={(_, payloadItems) => {
                      const row = payloadItems?.[0]?.payload as
                        | {
                            submissionIndex?: number;
                            fullDate?: string;
                            activity?: string;
                          }
                        | undefined;
                      if (!row) return null;
                      return (
                        <div className="flex flex-col gap-0.5 pb-1">
                          <span className="font-semibold text-foreground">
                            {row.submissionIndex ? `Worksheet #${row.submissionIndex} · ` : ""}
                            {row.fullDate}
                          </span>
                          {row.activity && (
                            <span className="text-xs font-normal text-muted-foreground truncate max-w-[220px]">
                              &quot;{row.activity}&quot;
                            </span>
                          )}
                        </div>
                      );
                    }}
                    formatter={(value, name, item) => {
                      if (value === null || value === undefined) return null;
                      const numericVal = typeof value === "number" ? value : Number(value);
                      if (Number.isNaN(numericVal)) return null;
                      const criterionKey = String(item.dataKey ?? "");
                      const criterion = CRITERION_CONFIG.find((c) => c.key === criterionKey);
                      const color = criterion ? getCriterionColor(criterion) : item.color;
                      const meta = getBandMeta(getBandFromScore(numericVal));

                      return (
                        <div className="flex flex-1 items-center justify-between gap-3">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className="size-2 rounded-full shrink-0"
                              style={{ backgroundColor: color }}
                              aria-hidden="true"
                            />
                            <span className="text-muted-foreground truncate">
                              {criterion?.label ?? String(name)}:
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {showScoreDetails && (
                              <span className="font-semibold tabular-nums text-foreground">
                                {numericVal.toFixed(1)}%
                              </span>
                            )}
                            <Badge
                              variant="outline"
                              className={cn(
                                "h-auto text-xs px-1.5 py-0.5 font-medium whitespace-nowrap",
                                meta.badgeClass
                              )}
                            >
                              {meta.label}
                            </Badge>
                          </div>
                        </div>
                      );
                    }}
                  />
                }
              />

              {CRITERION_CONFIG.map((c) => {
                if (!visibleSeries.has(c.key)) return null;
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
                    isAnimationActive={!prefersReducedMotion}
                    animationDuration={300}
                    dot={{
                      r: c.key === "composite" ? 5 : 4,
                      fill: color,
                      stroke: isDark ? CHART_DOT_STROKE.dark : CHART_DOT_STROKE.light,
                      strokeWidth: 2,
                    }}
                    activeDot={{
                      r: 7,
                      strokeWidth: 2.5,
                      stroke: isDark ? CHART_DOT_STROKE.dark : CHART_DOT_STROKE.light,
                    }}
                  />
                );
              })}
            </LineChart>
          </ChartContainer>
        )}

        {/* Band Zones Legend */}
        {showBandLegend && (
          <>
            <Separator />
            <div className="flex flex-wrap items-center justify-center gap-x-3.5 sm:gap-x-5 gap-y-1.5 sm:gap-y-2 max-w-fit mx-auto text-[11px] sm:text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-3 rounded-xs bg-band-4/60 border border-band-4/80" />
                <span className="font-medium text-foreground/90">
                  Excellent{showScoreDetails ? " (75–100%)" : ""}
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-3 rounded-xs bg-band-3/60 border border-band-3/80" />
                <span className="font-medium text-foreground/90">
                  Satisfactory{showScoreDetails ? " (50–74%)" : ""}
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-3 rounded-xs bg-band-2/60 border border-band-2/80" />
                <span className="font-medium text-foreground/90">
                  Developing{showScoreDetails ? " (25–49%)" : ""}
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-3 rounded-xs bg-band-1/60 border border-band-1/80" />
                <span className="font-medium text-foreground/90">
                  Needs Improvement{showScoreDetails ? " (0–24%)" : ""}
                </span>
              </span>
            </div>
          </>
        )}
      </TabsContent>

      <TabsContent value="table">
        <Card className="p-0 gap-0 shadow-none">
          <CardContent className="p-0">
            <Table className="text-xs">
            <TableCaption className="sr-only">
              Chronological list of completed cursive worksheets and individual handwriting skill scores
            </TableCaption>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="h-auto py-2.5 px-3 text-muted-foreground font-semibold">Date</TableHead>
                <TableHead className="h-auto py-2.5 px-3 min-w-[140px] text-muted-foreground font-semibold">Worksheet Activity</TableHead>
                <TableHead className="h-auto py-2.5 px-3 text-right text-muted-foreground font-semibold">Overall Score</TableHead>
                <TableHead className="h-auto py-2.5 px-3 text-right text-muted-foreground font-semibold">Letter Formation</TableHead>
                <TableHead className="h-auto py-2.5 px-3 text-right text-muted-foreground font-semibold">Size Consistency</TableHead>
                <TableHead className="h-auto py-2.5 px-3 text-right text-muted-foreground font-semibold">Spacing</TableHead>
                <TableHead className="h-auto py-2.5 px-3 text-right text-muted-foreground font-semibold">Slant</TableHead>
                <TableHead className="h-auto py-2.5 px-3 text-right text-muted-foreground font-semibold">Baseline Alignment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((item) => {
                const formattedDate = new Date(item.submissionDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });
                return (
                  <TableRow key={item.submissionId} className="hover:bg-muted/20">
                    <TableCell className="py-2.5 px-3 text-muted-foreground font-medium font-sans tabular-nums">
                      {formattedDate}
                    </TableCell>
                    <TableCell className="py-2.5 px-3 font-medium text-foreground truncate max-w-[180px]" title={item.targetText}>
                      &ldquo;{item.targetText}&rdquo;
                    </TableCell>
                    <TableCell className="py-2.5 px-3 text-right font-semibold font-sans tabular-nums text-foreground">
                      <div className="flex items-center justify-end gap-1.5">
                        <span>{item.compositeScore != null ? `${item.compositeScore.toFixed(1)}%` : "—"}</span>
                        <BandBadge score={item.compositeScore} size="sm" />
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5 px-3 text-right font-sans tabular-nums text-muted-foreground">
                      {item.scores.letter_formation != null ? `${item.scores.letter_formation.toFixed(1)}%` : "—"}
                    </TableCell>
                    <TableCell className="py-2.5 px-3 text-right font-sans tabular-nums text-muted-foreground">
                      {item.scores.size_consistency != null ? `${item.scores.size_consistency.toFixed(1)}%` : "—"}
                    </TableCell>
                    <TableCell className="py-2.5 px-3 text-right font-sans tabular-nums text-muted-foreground">
                      {item.scores.spacing != null ? `${item.scores.spacing.toFixed(1)}%` : "—"}
                    </TableCell>
                    <TableCell className="py-2.5 px-3 text-right font-sans tabular-nums text-muted-foreground">
                      {item.scores.slant != null ? `${item.scores.slant.toFixed(1)}%` : "—"}
                    </TableCell>
                    <TableCell className="py-2.5 px-3 text-right font-sans tabular-nums text-muted-foreground">
                      {item.scores.baseline_alignment != null ? `${item.scores.baseline_alignment.toFixed(1)}%` : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </CardContent>
          <Separator className="sm:hidden" />
          <CardFooter className="sm:hidden justify-center bg-muted/20 py-2 text-xs text-muted-foreground">
            Scroll horizontally to view all columns &rarr;
          </CardFooter>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
