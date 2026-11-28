"use client";

import { Fragment, useState, useMemo, useEffect, useRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
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
  EmptyMedia,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemHeader,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import {
  type StudentScoreSummary,
  useStudentScoreHistory,
} from "@/lib/hooks/use-dashboard";
import { cn } from "@/lib/utils";
import {
  RUBRIC_CRITERIA,
  DIAGNOSTIC_NOTES,
  getBandFromScore,
  RUBRIC_BANDS,
} from "@/lib/utils/scoring";
import { BandBadge } from "@/components/shared/band-badge";
import { BandPositionBar } from "@/components/shared/band-position-bar";
import { CriterionTrendChart } from "./criterion-trend-chart";
import { Button } from "@/components/ui/button";
import { useTeacherModals } from "@/components/teacher-modals-provider";
import {
  ChevronLeft,
  ChevronRight,
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
  onPreviousStudent?: () => void;
  onNextStudent?: () => void;
  studentPosition?: { current: number; total: number } | null;
}

export function StudentDrillDownDrawer({
  student,
  open,
  onOpenChange,
  onOpenSubmission,
  onUpload,
  onPreviousStudent,
  onNextStudent,
  studentPosition,
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

  // Recent score velocity calculation (latest vs preceding submission)
  const recentVelocity = useMemo(() => {
    if (!latestSubmission?.compositeScore || !precedingSubmission?.compositeScore) return null;
    return latestSubmission.compositeScore - precedingSubmission.compositeScore;
  }, [latestSubmission, precedingSubmission]);

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

  // Keyboard navigation for tab cycling and student stepping scoped to the drawer dialog
  useEffect(() => {
    if (!open) return;

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

      // Require Alt/Meta modifier for numeric tab shortcuts (WCAG 2.1.4 compliance)
      if (hasSubmissions && e.key === "1" && (e.altKey || e.metaKey)) {
        e.preventDefault();
        setActiveTab("overview");
      } else if (hasSubmissions && e.key === "2" && (e.altKey || e.metaKey)) {
        e.preventDefault();
        setActiveTab("trends");
      } else if (hasSubmissions && e.key === "3" && (e.altKey || e.metaKey)) {
        e.preventDefault();
        setActiveTab("history");
      } else if (e.key === "ArrowLeft" && e.altKey && onPreviousStudent) {
        e.preventDefault();
        onPreviousStudent();
      } else if (e.key === "ArrowRight" && e.altKey && onNextStudent) {
        e.preventDefault();
        onNextStudent();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, hasSubmissions, onPreviousStudent, onNextStudent]);

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
          <SheetHeader className={cn("p-5 sm:p-6 bg-card border-b border-border shrink-0 flex flex-col gap-4", hasSubmissions ? "pb-0 sm:pb-0" : "pb-5 sm:pb-6")}>
            <div className="flex items-start justify-between gap-3 pr-14 sm:pr-12">
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <SheetTitle className="font-heading text-lg sm:text-xl font-bold text-foreground leading-snug break-words">
                  {student.fullName}
                </SheetTitle>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <SheetDescription className="text-xs font-medium text-muted-foreground inline">
                    Section: <span className="font-semibold text-foreground">{student.section}</span>
                  </SheetDescription>
                  <span aria-hidden="true">•</span>
                  <span className="tabular-nums">
                    {knownZeroSubmissions
                      ? "0 submissions"
                      : `${history.length} ${history.length === 1 ? "submission" : "submissions"}`}
                  </span>
                </div>
              </div>

              {studentPosition && studentPosition.total > 1 && (onPreviousStudent || onNextStudent) && (
                <div className="flex items-center gap-1 shrink-0" aria-label="Step between students">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={onPreviousStudent}
                    disabled={!onPreviousStudent}
                    title="Previous student (Alt + Left)"
                    aria-label="Previous student"
                    className="min-h-10 min-w-10 sm:min-h-9 sm:min-w-9 cursor-pointer"
                  >
                    <ChevronLeft aria-hidden="true" />
                  </Button>
                  <span className="text-xs font-medium text-muted-foreground tabular-nums px-1">
                    {studentPosition.current}/{studentPosition.total}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={onNextStudent}
                    disabled={!onNextStudent}
                    title="Next student (Alt + Right)"
                    aria-label="Next student"
                    className="min-h-10 min-w-10 sm:min-h-9 sm:min-w-9 cursor-pointer"
                  >
                    <ChevronRight aria-hidden="true" />
                  </Button>
                </div>
              )}
            </div>

            {/* Accessible Segmented Tab Navigation Bar */}
            {hasSubmissions && (
              <div className="-mx-5 sm:-mx-6 px-5 sm:px-6 pt-1">
                <TabsList
                  variant="line"
                  className="w-full grid grid-cols-3 h-auto -mb-px gap-0 rounded-none bg-transparent p-0"
                >
                  <TabsTrigger
                    value="overview"
                    title="Overview (Alt + 1)"
                    aria-keyshortcuts="Alt+1"
                    className="inline-flex items-center justify-center gap-1.5 px-1.5 sm:px-3 py-2 text-xs font-semibold cursor-pointer whitespace-nowrap min-h-11 sm:min-h-10 data-active:text-primary data-active:after:bg-primary"
                  >
                    <LayoutDashboard data-icon="inline-start" aria-hidden="true" />
                    <span>Overview</span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="trends"
                    title="Score Trends (Alt + 2)"
                    aria-keyshortcuts="Alt+2"
                    className="inline-flex items-center justify-center gap-1.5 px-1.5 sm:px-3 py-2 text-xs font-semibold cursor-pointer whitespace-nowrap min-h-11 sm:min-h-10 data-active:text-primary data-active:after:bg-primary"
                  >
                    <LineChart data-icon="inline-start" aria-hidden="true" />
                    <span>
                      <span className="sm:hidden">Trends</span>
                      <span className="hidden sm:inline">Score Trends</span>
                    </span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="history"
                    title="History (Alt + 3)"
                    aria-keyshortcuts="Alt+3"
                    className="inline-flex items-center justify-center gap-1.5 px-1.5 sm:px-3 py-2 text-xs font-semibold cursor-pointer whitespace-nowrap min-h-11 sm:min-h-10 data-active:text-primary data-active:after:bg-primary"
                  >
                    <History data-icon="inline-start" aria-hidden="true" />
                    <span>History</span>
                    <Badge variant="secondary" className="ml-0.5 h-5 px-1.5 text-xs font-bold tabular-nums">
                      {history.length}
                    </Badge>
                  </TabsTrigger>
                </TabsList>
              </div>
            )}
          </SheetHeader>

          {/* Scrollable Drawer Body with Custom Slim Scrollbar */}
          <div className={cn("flex-1 overflow-y-auto overflow-x-hidden p-5 sm:p-6 min-w-0 flex flex-col [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/30", hasSubmissions && "gap-6")}>
            {isLoading ? (
              <div className="flex flex-col gap-4">
                <Skeleton className="h-32 w-full rounded-xl" />
                <Skeleton className="h-64 w-full rounded-xl" />
                <Skeleton className="h-32 w-full rounded-xl" />
              </div>
            ) : error ? (
              /* Dedicated Error State */
              <Alert variant="destructive" className="my-auto">
                <AlertCircle aria-hidden="true" />
                <AlertTitle className="font-semibold">
                  Couldn&apos;t load worksheet history
                </AlertTitle>
                <AlertDescription className="flex flex-col items-start gap-3">
                  <span className="text-xs leading-relaxed">
                    We couldn&apos;t load {student.fullName}&apos;s worksheet history right now. Check your internet connection and try again.
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11 sm:min-h-9 px-4 text-xs font-semibold cursor-pointer"
                    onClick={() => refetch()}
                    disabled={isRefetching}
                  >
                    {isRefetching ? (
                      <Spinner data-icon="inline-start" />
                    ) : (
                      <RefreshCw data-icon="inline-start" aria-hidden="true" />
                    )}
                    <span>{isRefetching ? "Retrying…" : "Try again"}</span>
                  </Button>
                </AlertDescription>
              </Alert>
            ) : !hasSubmissions ? (
              /* Actionable Pedagogical Onboarding & Criteria Preview Empty State */
              <div className="flex flex-col gap-6">
                {/* Hero Upload Prompt Card using Standard Empty Primitives */}
                <Empty className="p-4 sm:p-6 rounded-xl border border-dashed border-border/80 bg-muted/20 text-center shadow-warm-sm">
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
                      className="text-xs font-semibold cursor-pointer shadow-warm-sm min-h-11 sm:min-h-10 px-4"
                      onClick={() => {
                        onOpenChange(false);
                        if (onUpload && student.studentId) {
                          onUpload(student.studentId);
                        } else {
                          openUpload({ studentId: student.studentId });
                        }
                      }}
                    >
                      <UploadCloud data-icon="inline-start" aria-hidden="true" />
                      <span>Upload Worksheet</span>
                    </Button>
                  </EmptyContent>
                </Empty>

                {/* Inactive 5-Criteria Pedagogical Framework Scaffolding */}
                <section aria-labelledby="diagnostic-framework-title" className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h3 id="diagnostic-framework-title" className="font-heading text-sm font-semibold text-foreground">
                      Diagnostic Criteria Framework
                    </h3>
                  </div>

                  <Card size="sm" className="p-0 shadow-warm-sm">
                    <CardContent className="p-0">
                      <ItemGroup className="gap-0">
                        {RUBRIC_CRITERIA.map((criterion, index) => (
                          <Fragment key={criterion.key}>
                            <Item size="sm" className="rounded-none">
                              <ItemContent>
                                <ItemHeader>
                                  <ItemTitle className="text-xs font-semibold">
                                    {criterion.shortName}
                                  </ItemTitle>
                                  <Badge variant="secondary" className="text-xs font-medium shrink-0">
                                    Awaiting Assessment
                                  </Badge>
                                </ItemHeader>
                                <ItemDescription className="text-xs leading-normal">
                                  {criterion.hint}
                                </ItemDescription>
                              </ItemContent>
                            </Item>
                            {index < RUBRIC_CRITERIA.length - 1 && <ItemSeparator className="my-0" />}
                          </Fragment>
                        ))}
                      </ItemGroup>
                    </CardContent>
                  </Card>
                </section>
              </div>
            ) : (
              <>
                <TabsContent value="overview" className="mt-0 focus-visible:outline-none flex flex-col gap-6">
              {/* Integrated Overall Performance & Highlights Hero Card */}
              {student.scores.composite !== null && (
                <Card size="sm" className="shadow-warm-sm">
                  <CardHeader>
                    <CardTitle as="h3" className="font-sans text-xs font-medium text-muted-foreground">
                      Overall Performance
                    </CardTitle>
                    <CardAction>
                      <BandBadge score={student.scores.composite} size="default" showDot />
                    </CardAction>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <span className="font-sans text-2xl sm:text-3xl font-bold tabular-nums text-foreground">
                      {student.scores.composite.toFixed(1)}%
                    </span>

                    {(topStrength || focusArea) && (
                      <>
                        <Separator />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {topStrength && (
                            <div className="p-3 rounded-lg bg-muted/20 border border-border/60 flex flex-col gap-1.5 min-w-0">
                              <span className="text-xs font-medium text-muted-foreground block">
                                Top Strength
                              </span>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-semibold truncate text-foreground">
                                  {topStrength.shortName}
                                </span>
                                <span className="font-sans text-sm font-bold tabular-nums text-foreground shrink-0">
                                  {topStrength.score.toFixed(1)}%
                                </span>
                              </div>
                              <div>
                                <BandBadge score={topStrength.score} band={topStrength.band} size="sm" showDot />
                              </div>
                            </div>
                          )}

                          {focusArea && (
                            <div className="p-3 rounded-lg bg-muted/20 border border-border/60 flex flex-col gap-1.5 min-w-0">
                              <span className="text-xs font-medium text-muted-foreground block">
                                Priority Focus
                              </span>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-semibold truncate text-foreground">
                                  {focusArea.shortName}
                                </span>
                                <span className="font-sans text-sm font-bold tabular-nums text-foreground shrink-0">
                                  {focusArea.score.toFixed(1)}%
                                </span>
                              </div>
                              <div>
                                <BandBadge score={focusArea.score} band={focusArea.band} size="sm" showDot />
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* 5-Criteria Diagnostic Breakdown */}
              <section className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading text-sm font-semibold text-foreground">
                    Diagnostic Breakdown
                  </h3>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="link"
                      size="xs"
                      onClick={toggleExpandAll}
                      aria-expanded={accordionValue.length === allCriteriaKeys.length}
                      aria-controls="diagnostic-breakdown-accordion"
                      className="min-h-10 px-2 -my-2.5 font-medium cursor-pointer"
                    >
                      {accordionValue.length === allCriteriaKeys.length ? "Collapse all" : "Expand all"}
                    </Button>
                    {latestSubmission && (
                      <>
                        <span className="text-muted-foreground" aria-hidden="true">•</span>
                        <span className="text-xs font-medium text-muted-foreground tabular-nums">
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

                <div className="flex flex-col gap-2">
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
                    className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border shadow-warm-sm"
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

                          <AccordionContent className="px-3.5 sm:px-4 pb-4 flex flex-col gap-3.5 border-0">
                            <BandPositionBar score={score} showLabel={false} height="sm" />
                            {diagnosticNote && (
                              <Alert className="bg-muted/40 border-border/60">
                                <AlertTitle className="text-xs font-semibold">
                                  Diagnostic note
                                </AlertTitle>
                                <AlertDescription className="text-xs leading-relaxed">
                                  {diagnosticNote}
                                </AlertDescription>
                              </Alert>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </div>
              </section>

              {/* Recent Submissions Preview (Capped to 3 items with 'View All' affordance) */}
              <section className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading text-sm font-semibold text-foreground">
                    Recent Worksheets
                  </h3>
                  {history.length > 3 && (
                    <Button
                      type="button"
                      variant="link"
                      size="xs"
                      onClick={() => setActiveTab("history")}
                      className="min-h-10 px-2 -my-2.5 font-semibold cursor-pointer"
                    >
                      <span>View all {history.length}</span>
                      <ChevronRight data-icon="inline-end" aria-hidden="true" />
                    </Button>
                  )}
                </div>

                <ItemGroup className="gap-2.5">
                  {recentHistoryPreview.map((item) => (
                    <SubmissionHistoryItem
                      key={item.submissionId}
                      item={item}
                      onOpenSubmission={onOpenSubmission}
                    />
                  ))}
                </ItemGroup>
              </section>
            </TabsContent>

            <TabsContent value="trends" className="mt-0 focus-visible:outline-none flex flex-col gap-4">
              {/* Tab 2: TRENDS PANEL */}
              <div className="flex items-center justify-between min-w-0">
                <div>
                  <h3 className="font-heading text-sm font-semibold text-foreground">
                    Longitudinal Progress
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Skill scores evaluated across {history.length}{" "}
                    {history.length === 1 ? "completed worksheet" : "completed worksheets"}.
                  </p>
                </div>
                {recentVelocity !== null ? (
                  <div
                    className="shrink-0 text-right"
                    title={
                      precedingSubmission
                        ? `Compared to "${precedingSubmission.targetText}" (${new Date(precedingSubmission.submissionDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })})`
                        : undefined
                    }
                  >
                    <span className="text-xs font-medium text-muted-foreground block">
                      Recent Change
                    </span>
                    <div className="flex items-center justify-end gap-1.5">
                      <span
                        className={cn(
                          "text-xs font-bold tabular-nums",
                          recentVelocity > 0
                            ? "text-band-4-text"
                            : recentVelocity < 0
                              ? "text-band-2-text"
                              : "text-muted-foreground"
                        )}
                      >
                        {recentVelocity > 0
                          ? `+${recentVelocity.toFixed(1)}%`
                          : `${recentVelocity.toFixed(1)}%`}
                      </span>
                      {precedingSubmission && (
                        <span className="text-xs font-normal text-muted-foreground hidden sm:inline truncate max-w-[120px]">
                          vs. &quot;{precedingSubmission.targetText}&quot;
                        </span>
                      )}
                    </div>
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
                <Empty className="p-8 sm:p-10 rounded-xl border border-dashed border-border/80 bg-muted/20 my-auto">
                  <EmptyMedia
                    variant="icon"
                    className="rounded-full bg-background border border-border/60 text-primary shadow-warm-sm"
                  >
                    <LineChart className="size-5" aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyHeader>
                    <EmptyTitle className="text-sm font-semibold text-foreground">
                      Trend Tracking Unlocks at 2 Worksheets
                    </EmptyTitle>
                    <EmptyDescription className="text-xs leading-relaxed">
                      {student.fullName} has 1 evaluated worksheet. Once a second worksheet is graded, WriteWise will plot criterion trajectories, score velocity, and progress comparisons over time.
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button
                      type="button"
                      variant="link"
                      size="xs"
                      onClick={() => setActiveTab("overview")}
                      className="min-h-10 sm:min-h-8 px-3 font-semibold cursor-pointer"
                    >
                      View latest breakdown in Overview &rarr;
                    </Button>
                  </EmptyContent>
                </Empty>
              ) : (
                <Card size="sm" className="shadow-warm-sm">
                  <CardHeader>
                    <CardTitle as="h4" className="text-sm font-semibold">
                      Skill Trajectories
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CriterionTrendChart history={history} showBandLegend={false} />
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="history" className="mt-0 focus-visible:outline-none flex flex-col gap-3">
              {/* Tab 3: FULL HISTORY PANEL */}
              <div className="flex items-center justify-between">
                <h3 className="font-heading text-sm font-semibold text-foreground">
                  All Graded Submissions ({history.length})
                </h3>
              </div>

              <ItemGroup className="gap-2.5">
                {reversedHistory.map((item) => (
                  <SubmissionHistoryItem
                    key={item.submissionId}
                    item={item}
                    onOpenSubmission={onOpenSubmission}
                  />
                ))}
              </ItemGroup>
            </TabsContent>
          </>
        )}
      </div>

      {/* Persistent Rubric Score Bands Footer */}
      <Separator />
      <SheetFooter className="shrink-0 mt-0 bg-card/95 backdrop-blur-xs px-4 sm:px-6 py-2.5 sm:py-3">
        <div className="flex flex-col gap-1.5 sm:gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
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
                <div key={band.band} className="flex items-center gap-1.5 min-w-0">
                  <span className={cn("size-2 rounded-full shrink-0", band.dotColor)} aria-hidden="true" />
                  <span className="font-medium text-foreground text-xs truncate">{band.label}</span>
                  <span className="text-muted-foreground text-xs tabular-nums shrink-0">({range})</span>
                </div>
              );
            })}
          </div>
        </div>
      </SheetFooter>
    </Tabs>
  </SheetContent>
</Sheet>
);
}

function SubmissionHistoryItem({
  item,
  onOpenSubmission,
}: {
  item: {
    submissionId: string;
    activityId: string;
    targetText: string;
    isTakeHome?: boolean;
    submissionDate: string;
    compositeScore: number | null;
  };
  onOpenSubmission: (submissionId: string, activityId: string) => void;
}) {
  return (
    <Item
      variant="outline"
      size="sm"
      render={
        <Button
          type="button"
          variant="ghost"
          onClick={() => onOpenSubmission(item.submissionId, item.activityId)}
          aria-label={`View worksheet submission for "${item.targetText}", scored ${item.compositeScore != null ? `${item.compositeScore.toFixed(1)}%` : "—"}`}
          className="group h-auto min-h-11 w-full justify-between bg-card text-left font-normal hover:bg-muted/50 cursor-pointer"
        />
      }
    >
      <ItemContent className="min-w-0">
        <ItemTitle className="w-full">
          <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
            &quot;{item.targetText}&quot;
          </span>
          {item.isTakeHome && (
            <Badge variant="secondary" className="text-xs font-medium shrink-0">
              Take-Home
            </Badge>
          )}
        </ItemTitle>
        <ItemDescription className="text-xs font-medium tabular-nums line-clamp-1">
          {new Date(item.submissionDate).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </ItemDescription>
      </ItemContent>

      <ItemActions className="shrink-0 gap-3">
        <div className="flex flex-col items-end gap-0.5 text-right">
          <span className="font-sans text-xs sm:text-sm font-bold tabular-nums text-foreground">
            {item.compositeScore != null ? `${item.compositeScore.toFixed(1)}%` : "—"}
          </span>
          <BandBadge score={item.compositeScore} size="sm" showDot={false} />
        </div>
        <ChevronRight
          className="size-4 text-muted-foreground/70 group-hover:text-primary group-hover:translate-x-0.5 transition-all motion-reduce:transform-none motion-reduce:transition-colors"
          aria-hidden="true"
        />
      </ItemActions>
    </Item>
  );
}




