"use client";

import { useState, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type StudentScoreSummary,
  useStudentScoreHistory,
} from "@/lib/hooks/use-dashboard";
import { cn } from "@/lib/utils";
import {
  RUBRIC_CRITERIA,
  DIAGNOSTIC_NOTES,
  getBandFromScore,
  getBandMeta,
  RUBRIC_BANDS,
} from "@/lib/utils/scoring";
import { BandBadge } from "@/components/shared/band-badge";
import { BandPositionBar } from "@/components/shared/band-position-bar";
import { CriterionTrendChart } from "./criterion-trend-chart";
import {
  ChevronRight,
  PenTool,
  Info,
  LayoutDashboard,
  LineChart,
  History,
} from "lucide-react";

interface StudentDrillDownProps {
  student: StudentScoreSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenSubmission: (submissionId: string, activityId: string) => void;
}

export function StudentDrillDownDrawer({
  student,
  open,
  onOpenChange,
  onOpenSubmission,
}: StudentDrillDownProps) {
  const studentId = student?.studentId ?? null;
  const { data: history = [], isLoading } = useStudentScoreHistory(studentId);
  const [accordionValue, setAccordionValue] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "trends" | "history">("overview");

  const allCriteriaKeys = useMemo(() => RUBRIC_CRITERIA.map((c) => c.key), []);

  const toggleExpandAll = () => {
    if (accordionValue.length === allCriteriaKeys.length) {
      setAccordionValue([]);
    } else {
      setAccordionValue(allCriteriaKeys);
    }
  };

  // Latest submission info
  const latestSubmission = useMemo(() => {
    if (!history || history.length === 0) return null;
    return history[history.length - 1];
  }, [history]);

  // First submission info for progress trajectory
  const firstSubmission = useMemo(() => {
    if (!history || history.length === 0) return null;
    return history[0];
  }, [history]);

  // Score improvement calculation
  const scoreDelta = useMemo(() => {
    if (!firstSubmission?.compositeScore || !latestSubmission?.compositeScore) return null;
    return latestSubmission.compositeScore - firstSubmission.compositeScore;
  }, [firstSubmission, latestSubmission]);

  // Compute top strength and priority focus area from latest scores
  const { topStrength, focusArea } = useMemo(() => {
    if (!student || student.scores.composite === null) {
      return { topStrength: null, focusArea: null };
    }

    const scoredCriteria = RUBRIC_CRITERIA.map((criterion) => {
      const score = student.scores[criterion.criterionKey];
      const band =
        student.bands[criterion.criterionKey] ??
        (score !== null ? getBandFromScore(score) : null);
      return {
        key: criterion.key,
        criterionKey: criterion.criterionKey,
        shortName: criterion.shortName,
        score,
        band,
      };
    }).filter(
      (c): c is typeof c & { score: number } =>
        c.score !== null && typeof c.score === "number"
    );

    if (scoredCriteria.length === 0) {
      return { topStrength: null, focusArea: null };
    }

    const sorted = [...scoredCriteria].sort((a, b) => a.score - b.score);
    const focus = sorted[0];
    const strength = sorted[sorted.length - 1];

    return {
      topStrength: strength,
      focusArea: focus.key !== strength.key ? focus : null,
    };
  }, [student]);

  const reversedHistory = useMemo(() => [...history].reverse(), [history]);
  // Capped recent history for Overview tab (Harden: P2 requirement)
  const recentHistoryPreview = useMemo(() => reversedHistory.slice(0, 3), [reversedHistory]);

  if (!student) return null;

  const hasSubmissions = history.length > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl p-0 flex flex-col h-full bg-background border-l border-border shadow-warm-sm overflow-hidden"
      >
        {/* Drawer Header with Clean Metadata & Tab Navigation */}
        <SheetHeader className="p-5 sm:p-6 pb-0 sm:pb-0 bg-card border-b border-border shrink-0 space-y-4">
          <div className="flex items-start justify-between gap-3 pr-6">
            <div className="flex-1 min-w-0 space-y-1">
              <SheetTitle className="font-heading text-lg sm:text-xl font-bold text-foreground leading-snug break-words">
                {student.fullName}
              </SheetTitle>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <SheetDescription className="text-xs font-medium text-muted-foreground inline">
                  Section: <span className="font-semibold text-foreground">{student.section}</span>
                </SheetDescription>
                <span>•</span>
                <span className="tabular-nums">
                  {history.length} {history.length === 1 ? "submission" : "submissions"}
                </span>
              </div>
            </div>
          </div>

          {/* Accessible Segmented Tab Navigation Bar */}
          {hasSubmissions && (
            <div className="flex items-center gap-1 border-t border-border/60 pt-2 -mx-5 sm:-mx-6 px-5 sm:px-6 overflow-x-auto no-scrollbar -mb-px">
              <button
                type="button"
                onClick={() => setActiveTab("overview")}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap min-h-[40px] -mb-px",
                  activeTab === "overview"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <LayoutDashboard className="size-3.5" />
                <span>Overview</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("trends")}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap min-h-[40px] -mb-px",
                  activeTab === "trends"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <LineChart className="size-3.5" />
                <span>Score Trends</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("history")}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap min-h-[40px] -mb-px",
                  activeTab === "history"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <History className="size-3.5" />
                <span>History</span>
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-muted text-muted-foreground font-bold tabular-nums">
                  {history.length}
                </span>
              </button>
            </div>
          )}
        </SheetHeader>

        {/* Scrollable Drawer Body */}
        <div className={cn("flex-1 overflow-y-auto overflow-x-hidden p-5 sm:p-6 min-w-0 flex flex-col", hasSubmissions && "space-y-6")}>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-32 w-full rounded-xl" />
              <Skeleton className="h-64 w-full rounded-xl" />
              <Skeleton className="h-32 w-full rounded-xl" />
            </div>
          ) : !hasSubmissions ? (
            /* Actionable Unified Onboarding Empty State */
            <div className="p-8 sm:p-12 rounded-xl border border-dashed border-border/60 bg-muted/20 text-center flex flex-col items-center justify-center space-y-3.5 my-auto w-full">
              <div className="p-3.5 rounded-full bg-background border border-border/60 text-muted-foreground shadow-warm-xs">
                <PenTool className="size-6 text-primary" />
              </div>
              <div className="space-y-1.5 max-w-sm">
                <h4 className="text-base font-semibold text-foreground">
                  No Graded Worksheets Yet
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Upload a handwriting worksheet for {student.fullName} to see diagnostic breakdowns and score trends here.
                </p>
              </div>
            </div>
          ) : activeTab === "overview" ? (
            /* Tab 1: OVERVIEW PANEL */
            <div className="space-y-6">
              {/* Integrated Overall Performance & Highlights Hero Card */}
              {student.scores.composite !== null && (
                <div className="p-4 sm:p-5 rounded-xl bg-card border border-border shadow-warm-xs space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <span className="text-xs font-medium text-muted-foreground block">
                        Overall Performance
                      </span>
                      <div>
                        <span className="font-sans text-2xl sm:text-3xl font-bold tabular-nums text-foreground">
                          {student.scores.composite.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <BandBadge score={student.scores.composite} size="default" showDot />
                  </div>

                  {(topStrength || focusArea) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3.5 border-t border-border/60">
                      {topStrength && (
                        <div className="p-3 rounded-lg bg-muted/20 border border-border/60 space-y-1 min-w-0">
                          <span className="text-xs font-medium text-muted-foreground block">
                            Top Strength
                          </span>
                          <div className="flex items-center justify-between gap-2 pt-0.5">
                            <span className="text-sm font-semibold truncate text-foreground">
                              {topStrength.shortName}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="font-sans text-sm font-bold tabular-nums text-foreground">
                                {topStrength.score.toFixed(1)}%
                              </span>
                              <span className={cn("w-2 h-2 rounded-full shrink-0", getBandMeta(topStrength.band).dotColor)} />
                            </div>
                          </div>
                        </div>
                      )}

                      {focusArea && (
                        <div className="p-3 rounded-lg bg-muted/20 border border-border/60 space-y-1 min-w-0">
                          <span className="text-xs font-medium text-muted-foreground block">
                            Priority Focus
                          </span>
                          <div className="flex items-center justify-between gap-2 pt-0.5">
                            <span className="text-sm font-semibold truncate text-foreground">
                              {focusArea.shortName}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="font-sans text-sm font-bold tabular-nums text-foreground">
                                {focusArea.score.toFixed(1)}%
                              </span>
                              <span className={cn("w-2 h-2 rounded-full shrink-0", getBandMeta(focusArea.band).dotColor)} />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 5-Criteria Diagnostic Breakdown */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-sans text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <span>Diagnostic Breakdown</span>
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={toggleExpandAll}
                      className="text-xs font-medium text-primary hover:underline cursor-pointer"
                    >
                      {accordionValue.length === allCriteriaKeys.length ? "Collapse all" : "Expand all"}
                    </button>
                    {latestSubmission && (
                      <>
                        <span className="text-muted-foreground">•</span>
                        <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
                          {new Date(latestSubmission.submissionDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  {/* Accessible Band Reference Legend Key */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-2.5 rounded-lg bg-muted/20 border border-border/50 text-[11px] font-medium text-muted-foreground">
                    {RUBRIC_BANDS.map((band) => {
                      let range = "";
                      if (band.band === "needs_improvement") range = "0–24%";
                      else if (band.band === "developing") range = "25–49%";
                      else if (band.band === "satisfactory") range = "50–74%";
                      else if (band.band === "excellent") range = "75–100%";

                      return (
                        <div key={band.band} className="flex items-center gap-1.5">
                          <div className={cn("size-2 rounded-full shrink-0", band.dotColor)} />
                          <span>
                            {band.label} <span className="opacity-70 tabular-nums">({range})</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <Accordion
                    multiple
                    value={accordionValue}
                    onValueChange={(val) =>
                      setAccordionValue(
                        Array.isArray(val)
                          ? (val as string[])
                          : val
                          ? [val as string]
                          : []
                      )
                    }
                    className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border shadow-warm-xs"
                  >
                    {RUBRIC_CRITERIA.map((criterion) => {
                      const score = student.scores[criterion.criterionKey];
                      const band =
                        student.bands[criterion.criterionKey] ??
                        (score !== null ? getBandFromScore(score) : null);
                      const diagnosticNote =
                        band && DIAGNOSTIC_NOTES[criterion.criterionKey]?.[band];

                      return (
                        <AccordionItem value={criterion.key} key={criterion.key} className="border-0 hover:bg-muted/15 transition-colors">
                          <AccordionTrigger className="hover:no-underline px-3.5 sm:px-4 py-3 sm:py-3.5 items-center gap-3">
                            <div className="flex items-center justify-between flex-1 min-w-0 pr-1">
                              <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                                {criterion.shortName}
                              </span>
                              <div className="flex items-center justify-end gap-2 w-20 shrink-0 text-right">
                                {score !== null && (
                                  <>
                                    <span className="font-sans text-xs font-bold tabular-nums text-foreground">
                                      {score.toFixed(1)}%
                                    </span>
                                    <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", getBandMeta(band).dotColor)} />
                                  </>
                                )}
                              </div>
                            </div>
                          </AccordionTrigger>

                          <AccordionContent className="px-3.5 sm:px-4 pb-4 space-y-3.5 border-0">
                            <BandPositionBar score={score} showLabel={false} height="sm" />
                            {diagnosticNote && (
                              <div className="p-3 sm:p-3.5 rounded-lg bg-muted/30 border border-border/80 text-xs text-muted-foreground leading-relaxed">
                                <div className="flex items-center gap-1.5 font-semibold text-foreground/90 mb-1.5">
                                  <Info className="size-3.5 text-primary shrink-0" />
                                  <span>Diagnostic Note</span>
                                </div>
                                <p className="text-muted-foreground/90 pl-5">{diagnosticNote}</p>
                              </div>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </div>
              </section>

              {/* Recent Submissions Preview (Capped to 3 items with 'View All' affordance) */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-sans text-sm font-semibold text-foreground">
                    Recent Worksheets
                  </h3>
                  {history.length > 3 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab("history")}
                      className="text-xs font-semibold text-primary hover:underline cursor-pointer inline-flex items-center gap-1"
                    >
                      <span>View all {history.length}</span>
                      <ChevronRight className="size-3" />
                    </button>
                  )}
                </div>

                <div className="space-y-2.5">
                  {recentHistoryPreview.map((item) => (
                    <button
                      key={item.submissionId}
                      type="button"
                      onClick={() => onOpenSubmission(item.submissionId, item.activityId)}
                      className="w-full text-left group p-3.5 rounded-xl border border-border bg-card hover:bg-muted/40 hover:border-primary/30 hover:shadow-warm-xs transition-all flex items-center justify-between gap-3 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring touch-manipulation min-h-[48px]"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                            &quot;{item.targetText}&quot;
                          </span>
                          {item.isTakeHome && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-secondary text-secondary-foreground border border-border/40 font-semibold tracking-wide uppercase shrink-0">
                              Take-Home
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-medium text-muted-foreground tabular-nums">
                          {new Date(item.submissionDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right space-y-0.5">
                          <span className="font-sans text-xs sm:text-sm font-bold tabular-nums text-foreground block">
                            {item.compositeScore?.toFixed(1)}%
                          </span>
                          <BandBadge score={item.compositeScore} size="sm" showDot={false} />
                        </div>
                        <ChevronRight className="size-4 text-muted-foreground/70 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          ) : activeTab === "trends" ? (
            /* Tab 2: TRENDS PANEL */
            <div className="space-y-4">
              <div className="flex items-center justify-between min-w-0">
                <div>
                  <h3 className="font-sans text-sm font-semibold text-foreground">
                    Longitudinal Progress
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Skill scores evaluated across {history.length} completed worksheets.
                  </p>
                </div>
                {scoreDelta !== null && (
                  <div className="text-right shrink-0">
                    <span className="text-[11px] font-medium text-muted-foreground block">Trajectory</span>
                    <span className={cn(
                      "text-xs font-bold tabular-nums",
                      scoreDelta > 0 ? "text-emerald-600 dark:text-emerald-400" : scoreDelta < 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                    )}>
                      {scoreDelta > 0 ? `+${scoreDelta.toFixed(1)}%` : `${scoreDelta.toFixed(1)}%`}
                    </span>
                  </div>
                )}
              </div>

              <div className="p-4 rounded-xl border border-border bg-card shadow-warm-xs">
                <CriterionTrendChart history={history} />
              </div>
            </div>
          ) : (
            /* Tab 3: FULL HISTORY PANEL */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-sans text-sm font-semibold text-foreground">
                  All Graded Submissions ({history.length})
                </h3>
              </div>

              <div className="space-y-2.5">
                {reversedHistory.map((item) => (
                  <button
                    key={item.submissionId}
                    type="button"
                    onClick={() => onOpenSubmission(item.submissionId, item.activityId)}
                    className="w-full text-left group p-3.5 rounded-xl border border-border bg-card hover:bg-muted/40 hover:border-primary/30 hover:shadow-warm-xs transition-all flex items-center justify-between gap-3 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring touch-manipulation min-h-[48px]"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                          &quot;{item.targetText}&quot;
                        </span>
                        {item.isTakeHome && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-secondary text-secondary-foreground border border-border/40 font-semibold tracking-wide uppercase shrink-0">
                            Take-Home
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-medium text-muted-foreground tabular-nums">
                        {new Date(item.submissionDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right space-y-0.5">
                        <span className="font-sans text-xs sm:text-sm font-bold tabular-nums text-foreground block">
                          {item.compositeScore?.toFixed(1)}%
                        </span>
                        <BandBadge score={item.compositeScore} size="sm" showDot={false} />
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground/70 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}




