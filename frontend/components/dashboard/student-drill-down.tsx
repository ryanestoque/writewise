"use client";

import { useMemo, useEffect } from "react";
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
import { Button } from "@/components/ui/button";
import {
  type StudentScoreSummary,
  useStudentScoreHistory,
} from "@/lib/hooks/use-dashboard";
import {
  RUBRIC_CRITERIA,
  DIAGNOSTIC_NOTES,
  getBandFromScore,
} from "@/lib/utils/scoring";
import { BandBadge } from "@/components/shared/band-badge";
import { BandPositionBar } from "@/components/shared/band-position-bar";
import { CriterionTrendChart } from "./criterion-trend-chart";
import {
  ChevronLeft,
  ChevronRight,
  PenTool,
  Info,
} from "lucide-react";

interface StudentDrillDownProps {
  student: StudentScoreSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenSubmission: (submissionId: string, activityId: string) => void;
  onNavigateStudent?: (direction: "prev" | "next") => void;
  hasPrevStudent?: boolean;
  hasNextStudent?: boolean;
  currentIndex?: number;
  totalStudents?: number;
}

export function StudentDrillDownDrawer({
  student,
  open,
  onOpenChange,
  onOpenSubmission,
  onNavigateStudent,
  hasPrevStudent = false,
  hasNextStudent = false,
  currentIndex,
  totalStudents,
}: StudentDrillDownProps) {
  const studentId = student?.studentId ?? null;
  const { data: history = [], isLoading } = useStudentScoreHistory(studentId);

  // Keyboard navigation accelerators (ArrowLeft / ArrowRight)
  useEffect(() => {
    if (!open || !onNavigateStudent) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if modifier keys are pressed (e.g., Cmd/Ctrl/Alt/Shift + Arrow)
      if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;

      // Ignore if user is inside an input, textarea, select, or contentEditable element
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === "ArrowLeft" && hasPrevStudent) {
        e.preventDefault();
        onNavigateStudent("prev");
      } else if (e.key === "ArrowRight" && hasNextStudent) {
        e.preventDefault();
        onNavigateStudent("next");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onNavigateStudent, hasPrevStudent, hasNextStudent]);

  // Latest submission info
  const latestSubmission = useMemo(() => {
    if (!history || history.length === 0) return null;
    return history[history.length - 1];
  }, [history]);

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

  if (!student) return null;

  const hasSubmissions = history.length > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl p-0 flex flex-col h-full bg-background border-l border-border shadow-warm-sm overflow-hidden"
      >
        {/* Drawer Header with Clean Metadata & Sequential Navigation */}
        <SheetHeader className="p-5 sm:p-6 bg-card border-b border-border shrink-0 space-y-2">
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

            {/* Sequential Student Navigation Pager (Desktop / Header) */}
            {onNavigateStudent && (
              <div className="hidden sm:flex items-center gap-1 shrink-0 bg-muted/60 p-1.5 rounded-xl">
                {typeof currentIndex === "number" && currentIndex >= 0 && totalStudents && (
                  <span className="text-[11px] font-semibold text-muted-foreground px-2 tabular-nums select-none">
                    {currentIndex + 1} of {totalStudents}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onNavigateStudent("prev")}
                  disabled={!hasPrevStudent}
                  className="size-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-background/80 disabled:opacity-30 cursor-pointer touch-manipulation"
                  title="Previous student (Left arrow)"
                  aria-label="Previous student"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onNavigateStudent("next")}
                  disabled={!hasNextStudent}
                  className="size-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-background/80 disabled:opacity-30 cursor-pointer touch-manipulation"
                  title="Next student (Right arrow)"
                  aria-label="Next student"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            )}
          </div>
        </SheetHeader>

        {/* Scrollable Drawer Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-32 w-full rounded-xl" />
              <Skeleton className="h-64 w-full rounded-xl" />
              <Skeleton className="h-32 w-full rounded-xl" />
            </div>
          ) : !hasSubmissions ? (
            /* Actionable Unified Onboarding Empty State for Students with No Submissions */
            <div className="p-8 sm:p-12 rounded-xl border border-dashed border-border/60 bg-muted/20 text-center flex flex-col items-center justify-center space-y-3.5 my-auto">
              <div className="p-3.5 rounded-full bg-background border border-border/60 text-muted-foreground shadow-warm-xs">
                <PenTool className="size-6 text-primary" />
              </div>
              <div className="space-y-1.5 max-w-sm">
                <h4 className="text-base font-semibold text-foreground">
                  No Graded Worksheets Yet
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Once a handwriting submission is uploaded and evaluated for {student.fullName}, diagnostic breakdowns across all 5 criteria, score trend analytics, and past submissions will be displayed here automatically.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Integrated Overall Performance & Highlights Hero Card */}
              {student.scores.composite !== null && (
                <div className="p-4 sm:p-5 rounded-xl bg-card border border-border shadow-warm-xs space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <span className="text-xs font-medium text-muted-foreground block">
                        Overall Performance
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span className="font-sans text-2xl sm:text-3xl font-bold tabular-nums text-foreground">
                          {student.scores.composite.toFixed(1)}%
                        </span>
                        <span className="text-xs text-muted-foreground">average composite score</span>
                      </div>
                    </div>
                    <BandBadge score={student.scores.composite} size="default" showDot />
                  </div>

                  {(topStrength || focusArea) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3.5 border-t border-border/60">
                      {topStrength && (
                        <div className="p-3 rounded-lg bg-muted/20 border border-border/60 space-y-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium text-muted-foreground">
                              Top Strength
                            </span>
                            <BandBadge band={topStrength.band} score={topStrength.score} size="sm" showDot={false} />
                          </div>
                          <div className="flex items-center justify-between gap-2 pt-0.5">
                            <span className="text-sm font-semibold truncate text-foreground">
                              {topStrength.shortName}
                            </span>
                            <span className="font-sans text-sm font-bold tabular-nums shrink-0 text-foreground">
                              {topStrength.score.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      )}

                      {focusArea && (
                        <div className="p-3 rounded-lg bg-muted/20 border border-border/60 space-y-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium text-muted-foreground">
                              Priority Focus
                            </span>
                            <BandBadge band={focusArea.band} score={focusArea.score} size="sm" showDot={false} />
                          </div>
                          <div className="flex items-center justify-between gap-2 pt-0.5">
                            <span className="text-sm font-semibold truncate text-foreground">
                              {focusArea.shortName}
                            </span>
                            <span className="font-sans text-sm font-bold tabular-nums shrink-0 text-foreground">
                              {focusArea.score.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Section 1: 5-Criteria Diagnostic Breakdown */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-sans text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <span>Diagnostic Breakdown</span>
                  </h3>
                  {latestSubmission && (
                    <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
                      {new Date(latestSubmission.submissionDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  {/* Accessible Band Reference Legend Key */}
                  <div className="p-2.5 rounded-lg bg-muted/20 border border-border/50 text-[11px] font-medium text-muted-foreground">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="size-2 rounded-full bg-slate-400 dark:bg-slate-500 shrink-0" />
                        <span className="truncate">Beginning: <strong className="text-foreground font-semibold tabular-nums">0–59%</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="size-2 rounded-full bg-amber-400 dark:bg-amber-500 shrink-0" />
                        <span className="truncate">Developing: <strong className="text-foreground font-semibold tabular-nums">60–74%</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="size-2 rounded-full bg-emerald-400 dark:bg-emerald-500 shrink-0" />
                        <span className="truncate">Proficient: <strong className="text-foreground font-semibold tabular-nums">75–89%</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="size-2 rounded-full bg-indigo-400 dark:bg-indigo-500 shrink-0" />
                        <span className="truncate">Advanced: <strong className="text-foreground font-semibold tabular-nums">90–100%</strong></span>
                      </div>
                    </div>
                  </div>

                  <Accordion className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border shadow-warm-xs">
                    {RUBRIC_CRITERIA.map((criterion) => {
                      const score = student.scores[criterion.criterionKey];
                      const band =
                        student.bands[criterion.criterionKey] ??
                        (score !== null ? getBandFromScore(score) : null);
                      const diagnosticNote =
                        band && DIAGNOSTIC_NOTES[criterion.criterionKey]?.[band];

                      return (
                        <AccordionItem value={criterion.key} key={criterion.key} className="border-0 hover:bg-muted/15 transition-colors px-3.5 sm:px-4">
                          <AccordionTrigger className="hover:no-underline py-3.5 sm:py-4">
                            <div className="flex items-center justify-between w-full pr-4">
                              <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                                {criterion.shortName}
                              </span>
                              <div className="flex items-center gap-2">
                                {score !== null && (
                                  <span className="font-sans text-xs font-semibold tabular-nums text-foreground">
                                    {score.toFixed(1)}%
                                  </span>
                                )}
                                <BandBadge band={band} score={score} size="sm" />
                              </div>
                            </div>
                          </AccordionTrigger>

                          <div className="pb-3.5 sm:pb-4">
                            <BandPositionBar score={score} showLabel={false} height="sm" />
                          </div>

                          {diagnosticNote && (
                            <AccordionContent className="pb-4 border-0">
                              <div className="p-3 rounded-lg bg-muted/30 border border-border text-xs text-muted-foreground leading-relaxed">
                                <div className="flex items-center gap-1.5 font-semibold text-foreground/90 mb-1">
                                  <Info className="size-3.5 text-primary shrink-0" />
                                  <span>Diagnostic Note:</span>
                                </div>
                                <p className="text-muted-foreground">{diagnosticNote}</p>
                              </div>
                            </AccordionContent>
                          )}
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </div>
              </section>

              {/* Section 2: Historical Progress Trend */}
              <section className="space-y-3 pt-1">
                <h3 className="font-sans text-sm font-semibold text-foreground">
                  Score Trend
                </h3>

                <div className="p-4 rounded-xl border border-border bg-card shadow-warm-xs">
                  <CriterionTrendChart history={history} />
                </div>
              </section>

              {/* Section 3: Graded Submissions History List */}
              <section className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-sans text-sm font-semibold text-foreground">
                    Submissions ({history.length})
                  </h3>
                </div>

                <div className="space-y-2.5">
                  {[...history].reverse().map((item) => (
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
            </>
          )}
        </div>

        {/* Mobile Sticky Navigation Footer */}
        {onNavigateStudent && (
          <div className="sm:hidden flex items-center justify-between gap-3 p-3 bg-card border-t border-border/80 shrink-0 shadow-warm-md">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigateStudent("prev")}
              disabled={!hasPrevStudent}
              className="flex-1 h-11 rounded-xl gap-1.5 font-medium cursor-pointer touch-manipulation disabled:opacity-40"
              aria-label="Previous student"
            >
              <ChevronLeft className="size-4" />
              <span>Previous</span>
            </Button>
            {typeof currentIndex === "number" && totalStudents && (
              <span className="text-xs font-semibold text-muted-foreground tabular-nums select-none shrink-0 px-1">
                {currentIndex + 1} of {totalStudents}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigateStudent("next")}
              disabled={!hasNextStudent}
              className="flex-1 h-11 rounded-xl gap-1.5 font-medium cursor-pointer touch-manipulation disabled:opacity-40"
              aria-label="Next student"
            >
              <span>Next</span>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}




