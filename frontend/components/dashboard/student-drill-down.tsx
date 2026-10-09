"use client";

import { useState, useMemo, useEffect, useRef } from "react";
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
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
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
import { Button } from "@/components/ui/button";
import { useTeacherModals } from "@/components/teacher-modals-provider";
import {
  ChevronRight,
  Info,
  LayoutDashboard,
  LineChart,
  History,
  UploadCloud,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

interface StudentDrillDownProps {
  student: StudentScoreSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenSubmission: (submissionId: string, activityId: string) => void;
  onUpload?: (studentId: string) => void;
}

export function StudentDrillDownDrawer({
  student,
  open,
  onOpenChange,
  onOpenSubmission,
  onUpload,
}: StudentDrillDownProps) {
  const { openUpload } = useTeacherModals();
  const studentId = student?.studentId ?? null;
  const drawerRef = useRef<HTMLDivElement>(null);

  // Upfront detection of zero submissions from student metadata to prevent CLS & skeleton flash
  const knownZeroSubmissions = student?.scoreSource === "none" || student?.latestSubmissionId === null;

  const {
    data: history = [],
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useStudentScoreHistory(open && !knownZeroSubmissions ? studentId : null);
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

  // Preceding submission info for immediate velocity calculation
  const precedingSubmission = useMemo(() => {
    if (!history || history.length < 2) return null;
    return history[history.length - 2];
  }, [history]);

  // First submission info for all-time baseline progress trajectory
  const firstSubmission = useMemo(() => {
    if (!history || history.length === 0) return null;
    return history[0];
  }, [history]);

  // Recent score velocity calculation (latest vs preceding submission)
  const recentVelocity = useMemo(() => {
    if (!latestSubmission?.compositeScore || !precedingSubmission?.compositeScore) return null;
    return latestSubmission.compositeScore - precedingSubmission.compositeScore;
  }, [latestSubmission, precedingSubmission]);

  // Overall improvement trajectory from baseline (first submission)
  const baselineDelta = useMemo(() => {
    if (!firstSubmission?.compositeScore || !latestSubmission?.compositeScore) return null;
    if (history.length < 2) return null;
    return latestSubmission.compositeScore - firstSubmission.compositeScore;
  }, [firstSubmission, latestSubmission, history]);

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

  const [prevOpen, setPrevOpen] = useState(open);
  const [prevStudentId, setPrevStudentId] = useState(studentId);

  if (open !== prevOpen || studentId !== prevStudentId) {
    setPrevOpen(open);
    setPrevStudentId(studentId);
    if (open) {
      setActiveTab("overview");
      setAccordionValue(focusArea ? [focusArea.key] : []);
    }
  }

  const reversedHistory = useMemo(() => [...history].reverse(), [history]);
  // Capped recent history for Overview tab (Harden: P2 requirement)
  const recentHistoryPreview = useMemo(() => reversedHistory.slice(0, 3), [reversedHistory]);

  const hasSubmissions = !knownZeroSubmissions && history.length > 0;

  // Keyboard navigation for tab cycling scoped exclusively to the drawer dialog
  useEffect(() => {
    if (!open || !hasSubmissions) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ensure key event originated within or is targeted at the drawer dialog
      const container = drawerRef.current;
      if (!container) return;

      const activeEl = document.activeElement;
      const isWithinDrawer = activeEl ? container.contains(activeEl) : false;
      const targetIsWithinDrawer = e.target instanceof Node && container.contains(e.target);

      if (!isWithinDrawer && !targetIsWithinDrawer) return;

      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        (activeEl instanceof HTMLElement && activeEl.isContentEditable);
      if (isInput) return;

      // Require Alt/Meta modifier for numeric shortcuts (WCAG 2.1.4 compliance)
      if (e.key === "1" && (e.altKey || e.metaKey)) {
        e.preventDefault();
        setActiveTab("overview");
      } else if (e.key === "2" && (e.altKey || e.metaKey)) {
        e.preventDefault();
        setActiveTab("trends");
      } else if (e.key === "3" && (e.altKey || e.metaKey)) {
        e.preventDefault();
        setActiveTab("history");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, hasSubmissions]);

  if (!student) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        ref={drawerRef}
        side="right"
        className="w-full sm:max-w-xl p-0 flex flex-col h-full bg-background border-l border-border shadow-warm-sm overflow-hidden"
      >
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as "overview" | "trends" | "history")}
          className="flex flex-col h-full gap-0 overflow-hidden"
        >
          {/* Drawer Header with Clean Metadata & Tab Navigation */}
          <SheetHeader className={cn("p-5 sm:p-6 bg-card border-b border-border shrink-0 space-y-4", hasSubmissions ? "pb-0 sm:pb-0" : "pb-5 sm:pb-6")}>
            <div className="flex items-start justify-between gap-3 pr-14 sm:pr-12">
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
                    {knownZeroSubmissions
                      ? "0 submissions"
                      : `${history.length} ${history.length === 1 ? "submission" : "submissions"}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Accessible Segmented Tab Navigation Bar */}
            {hasSubmissions && (
              <div className="-mx-5 sm:-mx-6 px-5 sm:px-6 pt-1">
                <TabsList
                  variant="line"
                  className="w-full grid grid-cols-3 h-auto gap-0 rounded-none bg-transparent p-0"
                >
                  <TabsTrigger
                    value="overview"
                    title="Overview (Alt + 1)"
                    aria-keyshortcuts="Alt+1"
                    className="inline-flex items-center justify-center gap-1.5 px-1.5 sm:px-3 py-2 text-xs font-semibold cursor-pointer whitespace-nowrap min-h-[44px] sm:min-h-[40px] translate-y-[1px] data-active:text-primary data-active:after:bg-primary"
                  >
                    <LayoutDashboard className="size-3.5 shrink-0" aria-hidden="true" />
                    <span>Overview</span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="trends"
                    title="Score Trends (Alt + 2)"
                    aria-keyshortcuts="Alt+2"
                    className="inline-flex items-center justify-center gap-1.5 px-1.5 sm:px-3 py-2 text-xs font-semibold cursor-pointer whitespace-nowrap min-h-[44px] sm:min-h-[40px] translate-y-[1px] data-active:text-primary data-active:after:bg-primary"
                  >
                    <LineChart className="size-3.5 shrink-0" aria-hidden="true" />
                    <span>
                      <span className="sm:hidden">Trends</span>
                      <span className="hidden sm:inline">Score Trends</span>
                    </span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="history"
                    title="History (Alt + 3)"
                    aria-keyshortcuts="Alt+3"
                    className="inline-flex items-center justify-center gap-1.5 px-1.5 sm:px-3 py-2 text-xs font-semibold cursor-pointer whitespace-nowrap min-h-[44px] sm:min-h-[40px] translate-y-[1px] data-active:text-primary data-active:after:bg-primary"
                  >
                    <History className="size-3.5 shrink-0" aria-hidden="true" />
                    <span>History</span>
                    <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] bg-muted text-muted-foreground font-bold tabular-nums">
                      {history.length}
                    </span>
                  </TabsTrigger>
                </TabsList>
              </div>
            )}
          </SheetHeader>

          {/* Scrollable Drawer Body with Custom Slim Scrollbar */}
          <div className={cn("flex-1 overflow-y-auto overflow-x-hidden p-5 sm:p-6 min-w-0 flex flex-col [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/30", hasSubmissions && "space-y-6")}>
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-32 w-full rounded-xl" />
                <Skeleton className="h-64 w-full rounded-xl" />
                <Skeleton className="h-32 w-full rounded-xl" />
              </div>
            ) : error ? (
              /* Dedicated Error State */
              <div className="p-8 sm:p-12 rounded-xl border border-destructive/20 bg-destructive/5 text-center flex flex-col items-center justify-center space-y-3.5 my-auto w-full">
                <div className="p-3.5 rounded-full bg-background border border-destructive/30 text-destructive shadow-warm-xs">
                  <AlertCircle className="size-6 text-destructive" aria-hidden="true" />
                </div>
                <div className="space-y-1.5 max-w-sm">
                  <h4 className="text-base font-semibold text-foreground">
                    Failed to Load Student History
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {error.message || "An unexpected error occurred while fetching worksheet history."}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 text-xs font-semibold gap-1.5 cursor-pointer border-destructive/30 hover:bg-destructive/10 text-destructive"
                  onClick={() => refetch()}
                  disabled={isRefetching}
                >
                  <RefreshCw className={cn("size-3.5", isRefetching && "animate-spin motion-reduce:animate-none")} aria-hidden="true" />
                </Button>
              </div>
            ) : !hasSubmissions ? (
              /* Actionable Pedagogical Onboarding & Criteria Preview Empty State */
              <div className="space-y-6">
                {/* Hero Upload Prompt Card using Standard Empty Primitives */}
                <Empty className="p-4 sm:p-6 rounded-xl border border-dashed border-border/80 bg-muted/20 text-center shadow-warm-xs">
                  <EmptyHeader>
                    <EmptyTitle className="font-heading text-base font-semibold text-foreground">
                      No Graded Worksheets Yet
                    </EmptyTitle>
                    <EmptyDescription className="text-xs text-muted-foreground leading-relaxed max-w-md">
                      Upload a handwriting worksheet for <span className="font-semibold text-foreground">{student.fullName}</span> to automatically evaluate stroke geometry, letter height, and baseline consistency.
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent className="mt-1">
                    <Button
                      type="button"
                      size="default"
                      className="text-xs font-semibold gap-2 cursor-pointer shadow-warm-xs min-h-[44px] sm:min-h-[40px] px-4"
                      onClick={() => {
                        onOpenChange(false);
                        if (onUpload && student.studentId) {
                          onUpload(student.studentId);
                        } else {
                          openUpload({ studentId: student.studentId });
                        }
                      }}
                    >
                      <UploadCloud className="size-4" aria-hidden="true" />
                      <span>Upload Worksheet</span>
                    </Button>
                  </EmptyContent>
                </Empty>

                {/* Inactive 5-Criteria Pedagogical Framework Scaffolding */}
                <section aria-labelledby="diagnostic-framework-title" className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 id="diagnostic-framework-title" className="font-sans text-sm font-semibold text-foreground">
                      Diagnostic Criteria Framework
                    </h3>
                  </div>

                  <ul role="list" className="rounded-xl border border-border bg-card divide-y divide-border shadow-warm-xs overflow-hidden">
                    {RUBRIC_CRITERIA.map((criterion) => (
                      <li key={criterion.key} className="p-3.5 sm:p-4 space-y-1.5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-semibold text-foreground">
                            {criterion.shortName}
                          </span>
                          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/40 shrink-0">
                            Awaiting Assessment
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-normal">
                          {criterion.hint}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            ) : (
              <>
                <TabsContent value="overview" className="mt-0 focus-visible:outline-none space-y-6">
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
                  <h3 className="font-sans text-sm font-semibold text-foreground">
                    Diagnostic Breakdown
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={toggleExpandAll}
                      aria-expanded={accordionValue.length === allCriteriaKeys.length}
                      aria-controls="diagnostic-breakdown-accordion"
                      className="text-xs font-medium text-primary hover:underline cursor-pointer min-h-[40px] px-2 -my-2.5 inline-flex items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                  <Accordion
                    id="diagnostic-breakdown-accordion"
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
                              <div className="flex items-center justify-end gap-2 shrink-0 text-right">
                                {score !== null && (
                                  <>
                                    <span className="font-sans text-xs font-bold tabular-nums text-foreground">
                                      {score.toFixed(1)}%
                                    </span>
                                    <BandBadge score={score} band={band} size="sm" showDot />
                                  </>
                                )}
                              </div>
                            </div>
                          </AccordionTrigger>

                          <AccordionContent className="px-3.5 sm:px-4 pb-4 space-y-3.5 border-0">
                            <BandPositionBar score={score} showLabel={false} height="sm" />
                            {diagnosticNote && (
                              <div className="p-3 sm:p-3.5 rounded-lg bg-muted/40 text-xs text-muted-foreground leading-relaxed">
                                <div className="flex items-center gap-1.5 font-semibold text-foreground/90 mb-1.5">
                                  <Info className="size-3.5 text-primary shrink-0" aria-hidden="true" />
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
                      className="text-xs font-semibold text-primary hover:underline cursor-pointer min-h-[40px] px-2 -my-2.5 inline-flex items-center gap-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span>View all {history.length}</span>
                      <ChevronRight className="size-3" aria-hidden="true" />
                    </button>
                  )}
                </div>

                <ul role="list" className="space-y-2.5">
                  {recentHistoryPreview.map((item) => (
                    <li key={item.submissionId}>
                      <button
                        type="button"
                        onClick={() => onOpenSubmission(item.submissionId, item.activityId)}
                        aria-label={`View worksheet submission for "${item.targetText}", scored ${item.compositeScore != null ? `${item.compositeScore.toFixed(1)}%` : "—"}`}
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
                          <ChevronRight className="size-4 text-muted-foreground/70 group-hover:text-primary group-hover:translate-x-0.5 transition-all" aria-hidden="true" />
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            </TabsContent>

            <TabsContent value="trends" className="mt-0 focus-visible:outline-none space-y-4">
              {/* Tab 2: TRENDS PANEL */}
              <div className="flex items-center justify-between min-w-0">
                <div>
                  <h3 className="font-sans text-sm font-semibold text-foreground">
                    Longitudinal Progress
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Skill scores evaluated across {history.length}{" "}
                    {history.length === 1 ? "completed worksheet" : "completed worksheets"}.
                  </p>
                </div>
                {recentVelocity !== null ? (
                  <div className="flex items-center gap-3 sm:gap-4 shrink-0 text-right">
                    <div
                      title={
                        precedingSubmission
                          ? `Compared to "${precedingSubmission.targetText}" (${new Date(precedingSubmission.submissionDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })})`
                          : undefined
                      }
                    >
                      <span className="text-[10px] sm:text-[11px] font-medium text-muted-foreground block">
                        Recent Growth
                      </span>
                      <div className="flex items-center justify-end gap-1.5">
                        <span className={cn(
                          "text-xs font-bold tabular-nums",
                          recentVelocity > 0 ? "text-band-4-text" : recentVelocity < 0 ? "text-band-2-text" : "text-muted-foreground"
                        )}>
                          {recentVelocity > 0 ? `+${recentVelocity.toFixed(1)}%` : `${recentVelocity.toFixed(1)}%`}
                        </span>
                        {precedingSubmission && (
                          <span className="text-[10px] font-normal text-muted-foreground hidden sm:inline truncate max-w-[110px]">
                            vs. &quot;{precedingSubmission.targetText}&quot;
                          </span>
                        )}
                      </div>
                    </div>
                    {baselineDelta !== null && history.length > 2 && (
                      <div className="border-l border-border pl-3 sm:pl-4">
                        <span className="text-[10px] sm:text-[11px] font-medium text-muted-foreground block">
                          Overall Growth
                        </span>
                        <span className={cn(
                          "text-xs font-bold tabular-nums",
                          baselineDelta > 0 ? "text-band-4-text" : baselineDelta < 0 ? "text-band-2-text" : "text-muted-foreground"
                        )}>
                          {baselineDelta > 0 ? `+${baselineDelta.toFixed(1)}%` : `${baselineDelta.toFixed(1)}%`}
                        </span>
                      </div>
                    )}
                  </div>
                ) : history.length === 1 ? (
                  <div className="text-right shrink-0">
                    <span className="text-[11px] font-medium text-muted-foreground block">Trajectory</span>
                    <span className="text-xs font-medium text-muted-foreground">
                      Baseline established
                    </span>
                  </div>
                ) : null}
              </div>

              {history.length < 2 ? (
                <div className="p-8 sm:p-10 rounded-xl border border-dashed border-border/80 bg-muted/20 text-center flex flex-col items-center justify-center space-y-3.5 my-auto">
                  <div className="p-3 rounded-full bg-background border border-border/60 text-primary shadow-warm-xs">
                    <LineChart className="size-5" aria-hidden="true" />
                  </div>
                  <div className="space-y-1.5 max-w-sm">
                    <h4 className="text-sm font-semibold text-foreground">
                      Trend Tracking Unlocks at 2 Worksheets
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {student.fullName} has 1 evaluated worksheet. Once a second worksheet is graded, WriteWise will plot criterion trajectories, score velocity, and progress comparisons over time.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab("overview")}
                    className="text-xs font-semibold text-primary hover:underline cursor-pointer pt-1"
                  >
                    View latest breakdown in Overview &rarr;
                  </button>
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-border bg-card shadow-warm-xs">
                  <CriterionTrendChart history={history} />
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="mt-0 focus-visible:outline-none space-y-3">
              {/* Tab 3: FULL HISTORY PANEL */}
              <div className="flex items-center justify-between">
                <h3 className="font-sans text-sm font-semibold text-foreground">
                  All Graded Submissions ({history.length})
                </h3>
              </div>

              <ul role="list" className="space-y-2.5">
                {reversedHistory.map((item) => (
                  <li key={item.submissionId}>
                    <button
                      type="button"
                      onClick={() => onOpenSubmission(item.submissionId, item.activityId)}
                      aria-label={`View worksheet submission for "${item.targetText}", scored ${item.compositeScore != null ? `${item.compositeScore.toFixed(1)}%` : "—"}`}
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
                        <ChevronRight className="size-4 text-muted-foreground/70 group-hover:text-primary group-hover:translate-x-0.5 transition-all" aria-hidden="true" />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </TabsContent>
          </>
        )}
      </div>

      {/* Persistent Rubric Score Bands Footer */}
      <footer className="shrink-0 border-t border-border bg-card/95 backdrop-blur-xs px-4 sm:px-6 py-2.5 sm:py-3">
        <div className="flex flex-col gap-1.5 sm:gap-2">
          <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
            Rubrics
          </span>
          <div className="grid grid-cols-2 gap-x-3 sm:gap-x-4 gap-y-1 sm:gap-y-1.5 text-xs max-w-max">
            {RUBRIC_BANDS.map((band) => {
              let range = "";
              if (band.band === "needs_improvement") range = "0–24%";
              else if (band.band === "developing") range = "25–49%";
              else if (band.band === "satisfactory") range = "50–74%";
              else if (band.band === "excellent") range = "75–100%";

              return (
                <div key={band.band} className="flex items-center gap-1 sm:gap-1.5 min-w-0">
                  <span className={cn("size-2 rounded-full shrink-0", band.dotColor)} />
                  <span className="font-medium text-foreground text-[10px] sm:text-[11px] truncate">{band.label}</span>
                  <span className="text-muted-foreground text-[10px] sm:text-[11px] tabular-nums shrink-0">({range})</span>
                </div>
              );
            })}
          </div>
        </div>
      </footer>
    </Tabs>
  </SheetContent>
</Sheet>
);
}




