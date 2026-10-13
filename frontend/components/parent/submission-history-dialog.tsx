"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BandBadge } from "@/components/shared/band-badge";
import { CriterionFeedbackRow } from "./criterion-feedback-row";
import { WorksheetViewDialog } from "./worksheet-view-dialog";
import { PARENT_CRITERIA_LIST } from "@/lib/utils/scoring";
import type { StudentScoreHistoryItem } from "@/lib/hooks/use-dashboard";
import type { CriterionFilter } from "@/components/shared/diagnostic-overlay";
import { cn } from "@/lib/utils";
import {
  Calendar,
  FileText,
  Eye,
  TrendingUp,
  TrendingDown,
  ChevronDown,
} from "lucide-react";

interface SubmissionHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  history: StudentScoreHistoryItem[];
  childName: string;
}

const PARENT_CRITERIA = PARENT_CRITERIA_LIST.map((c) => ({
  criterionKey: c.key,
  label: c.label,
}));

export function SubmissionHistoryDialog({
  open,
  onOpenChange,
  history,
  childName,
}: SubmissionHistoryDialogProps) {
  const [selectedItemForView, setSelectedItemForView] =
    useState<StudentScoreHistoryItem | null>(null);
  const [initialCriterionForView, setInitialCriterionForView] =
    useState<CriterionFilter | undefined>(undefined);
  const [expandedSubmissions, setExpandedSubmissions] = useState<
    Record<string, boolean>
  >({});

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const savedScrollTopRef = useRef<number>(0);

  // Sort reverse-chronologically (newest first)
  const sortedHistory = useMemo(() => [...history].reverse(), [history]);
  const isViewingWorksheet = !!selectedItemForView;

  // Restore scroll position when returning from the worksheet photo viewer
  useEffect(() => {
    if (!isViewingWorksheet && scrollContainerRef.current && savedScrollTopRef.current > 0) {
      const scrollEl = scrollContainerRef.current;
      const targetScroll = savedScrollTopRef.current;
      requestAnimationFrame(() => {
        if (scrollEl) {
          scrollEl.scrollTop = targetScroll;
        }
      });
    }
  }, [isViewingWorksheet]);

  const handleOpenWorksheetView = (
    item: StudentScoreHistoryItem,
    criterion?: CriterionFilter
  ) => {
    if (scrollContainerRef.current) {
      savedScrollTopRef.current = scrollContainerRef.current.scrollTop;
    }
    setInitialCriterionForView(criterion);
    setSelectedItemForView(item);
  };

  const handleBackFromWorksheetView = () => {
    setSelectedItemForView(null);
    setInitialCriterionForView(undefined);
  };

  const toggleExpanded = (submissionId: string) => {
    setExpandedSubmissions((prev) => ({
      ...prev,
      [submissionId]: !prev[submissionId],
    }));
  };

  const allExpanded = useMemo(() => {
    return (
      sortedHistory.length > 0 &&
      sortedHistory.every((item) => !!expandedSubmissions[item.submissionId])
    );
  }, [sortedHistory, expandedSubmissions]);

  const toggleAllExpanded = () => {
    if (allExpanded) {
      setExpandedSubmissions({});
    } else {
      const next: Record<string, boolean> = {};
      for (const item of sortedHistory) {
        next[item.submissionId] = true;
      }
      setExpandedSubmissions(next);
    }
  };

  // Compute longitudinal trajectory from earliest to latest attempt
  const overallStats = useMemo(() => {
    if (sortedHistory.length < 2) return null;
    const newestScore = sortedHistory[0]?.compositeScore;
    const oldestScore =
      sortedHistory[sortedHistory.length - 1]?.compositeScore;
    if (newestScore == null || oldestScore == null) return null;
    const overallDelta = newestScore - oldestScore;
    return {
      newestScore,
      oldestScore,
      overallDelta,
    };
  }, [sortedHistory]);

  return (
    <>
      <Dialog open={open && !isViewingWorksheet} onOpenChange={onOpenChange}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-2xl max-h-[min(90dvh,calc(100vh-2rem))] p-0 gap-0 overflow-hidden flex flex-col shadow-warm">
          {/* Header */}
          <DialogHeader className="p-5 sm:p-6 pb-4 border-b border-border bg-card/60">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <DialogTitle className="font-heading text-lg sm:text-xl font-semibold text-foreground">
                  Worksheet History &amp; Scores
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
                  {sortedHistory.length > 0 ? (
                    <>
                      {sortedHistory.length} scored{" "}
                      {sortedHistory.length === 1 ? "worksheet" : "worksheets"}{" "}
                      for{" "}
                      <span className="font-medium text-foreground">
                        {childName}
                      </span>{" "}
                      (showing newest first)
                    </>
                  ) : (
                    `Past scored worksheets and skill feedback for ${childName}.`
                  )}
                </DialogDescription>

                {overallStats && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
                    <span className="text-muted-foreground">Overall trajectory:</span>
                    <span
                      className={cn(
                        "font-semibold font-sans tabular-nums inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] shadow-2xs",
                        overallStats.overallDelta > 0
                          ? "text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800/50"
                          : overallStats.overallDelta < 0
                          ? "text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/60 border border-amber-200/60 dark:border-amber-800/50"
                          : "text-muted-foreground bg-muted/40 border border-border/60"
                      )}
                    >
                      {overallStats.overallDelta > 0 && (
                        <TrendingUp className="size-3 shrink-0" aria-hidden="true" />
                      )}
                      {overallStats.overallDelta < 0 && (
                        <TrendingDown className="size-3 shrink-0" aria-hidden="true" />
                      )}
                      {overallStats.overallDelta > 0
                        ? `+${overallStats.overallDelta.toFixed(1)}%`
                        : `${overallStats.overallDelta.toFixed(1)}%`}
                    </span>
                    <span className="text-muted-foreground font-sans tabular-nums text-[11px]">
                      ({overallStats.oldestScore.toFixed(0)}% baseline &rarr;{" "}
                      {overallStats.newestScore.toFixed(0)}% latest)
                    </span>
                  </div>
                )}
              </div>

              {sortedHistory.length > 1 && (
                <button
                  type="button"
                  onClick={toggleAllExpanded}
                  className="text-xs font-medium text-brand-700 dark:text-brand-300 hover:text-brand-800 dark:hover:text-brand-200 hover:underline cursor-pointer shrink-0 min-h-[36px] sm:min-h-[32px] py-1.5 px-3 rounded-lg hover:bg-brand-50/60 dark:hover:bg-brand-950/40 border border-transparent hover:border-brand-200/60 dark:hover:border-brand-800/60 transition-colors self-start sm:self-center inline-flex items-center"
                >
                  {allExpanded ? "Collapse All Details" : "Expand All Details"}
                </button>
              )}
            </div>
          </DialogHeader>

          {/* List of submissions */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4"
          >
            {sortedHistory.length === 0 ? (
              <div className="p-8 text-center space-y-2 rounded-xl border border-dashed border-border bg-muted/20">
                <FileText
                  className="size-8 text-muted-foreground/60 mx-auto"
                  aria-hidden="true"
                />
                <p className="text-sm font-medium text-foreground">
                  No past submissions recorded
                </p>
                <p className="text-xs text-muted-foreground">
                  Completed worksheets will appear here in chronological order.
                </p>
              </div>
            ) : (
              sortedHistory.map((item, index) => {
                const formattedDate = new Date(
                  item.submissionDate
                ).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });

                // Delta vs chronologically preceding attempt
                const previousItem = sortedHistory[index + 1];
                const currentScore = item.compositeScore;
                const prevScore = previousItem?.compositeScore;
                const delta =
                  currentScore != null && prevScore != null
                    ? currentScore - prevScore
                    : null;
                const isBaseline =
                  index === sortedHistory.length - 1 && sortedHistory.length > 1;
                const isExpanded = !!expandedSubmissions[item.submissionId];

                return (
                  <div
                    key={item.submissionId}
                    className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-warm space-y-3.5 transition-shadow hover:shadow-md"
                  >
                    {/* Top Row: Attempt metadata & Composite Score */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 border-b border-border/60 pb-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Attempt #{sortedHistory.length - index}
                          </span>

                          {delta != null && (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md tabular-nums shrink-0 shadow-2xs",
                                delta > 0
                                  ? "text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800/50"
                                  : delta < 0
                                  ? "text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/60 border border-amber-200/60 dark:border-amber-800/50"
                                  : "text-muted-foreground bg-muted/40 border border-border/60"
                              )}
                              title={
                                delta > 0
                                  ? `Improvement of +${delta.toFixed(1)}% compared to Attempt #${sortedHistory.length - (index + 1)}`
                                  : delta < 0
                                  ? `Difference of ${delta.toFixed(1)}% compared to Attempt #${sortedHistory.length - (index + 1)}`
                                  : "No score change compared to previous attempt"
                              }
                            >
                              {delta > 0 && (
                                <TrendingUp className="size-3 shrink-0" aria-hidden="true" />
                              )}
                              {delta < 0 && (
                                <TrendingDown className="size-3 shrink-0" aria-hidden="true" />
                              )}
                              <span>
                                {delta > 0
                                  ? `+${delta.toFixed(1)}%`
                                  : `${delta.toFixed(1)}%`}
                              </span>
                            </span>
                          )}

                          {isBaseline && (
                            <span className="inline-flex items-center text-[11px] font-medium text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-md border border-border/50 shrink-0">
                              Baseline attempt
                            </span>
                          )}
                        </div>

                        <h4
                          className="text-sm sm:text-base font-semibold text-foreground truncate"
                          title={item.targetText}
                        >
                          &ldquo;{item.targetText}&rdquo;
                        </h4>

                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Calendar className="size-3.5 text-muted-foreground/70" aria-hidden="true" />
                          <span>Assessed on {formattedDate}</span>
                        </p>
                      </div>

                      <div className="flex items-center sm:flex-col sm:items-end justify-between sm:justify-start gap-2 shrink-0 pt-1 sm:pt-0">
                        <div className="flex items-center gap-2">
                          <span className="text-lg sm:text-xl font-bold font-sans tabular-nums text-foreground">
                            {item.compositeScore != null
                              ? `${item.compositeScore.toFixed(1)}%`
                              : "—"}
                          </span>
                          <BandBadge score={item.compositeScore} size="sm" />
                        </div>

                        {item.imagePath && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenWorksheetView(item)}
                            aria-haspopup="dialog"
                            aria-label={`View photo and guide lines for attempt #${sortedHistory.length - index}: "${item.targetText}"`}
                            className="h-9 min-h-[36px] text-xs font-medium gap-1.5 border-brand-200 dark:border-brand-900 bg-brand-50/40 dark:bg-brand-950/30 text-brand-800 dark:text-brand-200 hover:bg-brand-100/60 dark:hover:bg-brand-900/50 cursor-pointer shadow-2xs"
                          >
                            <Eye
                              className="size-3.5 text-brand-600 dark:text-brand-400"
                              aria-hidden="true"
                            />
                            <span>View Photo &amp; Lines</span>
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* 5-Skill Summary: Stacked on Mobile, 5-col Grid on sm+ */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-muted-foreground">
                          5-Skill Summary
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleExpanded(item.submissionId)}
                          aria-expanded={isExpanded}
                          aria-controls={`details-${item.submissionId}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 dark:text-brand-300 hover:text-brand-800 dark:hover:text-brand-200 hover:underline cursor-pointer py-1 px-1.5 rounded-md hover:bg-brand-50/60 dark:hover:bg-brand-950/40 transition-colors"
                        >
                          <span>{isExpanded ? "Hide Details" : "View Details"}</span>
                          <ChevronDown
                            className={cn(
                              "size-3.5 transition-transform duration-200 motion-reduce:transition-none text-brand-600 dark:text-brand-400",
                              isExpanded && "rotate-180"
                            )}
                            aria-hidden="true"
                          />
                        </button>
                      </div>

                      {/* Mobile Stacked List (xs) */}
                      <div className="sm:hidden space-y-1.5 pt-0.5">
                        {PARENT_CRITERIA.map((criterion) => {
                          const score = item.scores[criterion.criterionKey];
                          const band = item.bands[criterion.criterionKey];
                          return (
                            <div
                              key={criterion.criterionKey}
                              className="rounded-lg border border-border/60 bg-muted/20 px-3 py-1.5 flex items-center justify-between gap-2"
                            >
                              <span className="text-xs font-medium text-foreground">
                                {criterion.label}
                              </span>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-xs font-semibold font-sans tabular-nums text-foreground">
                                  {score != null ? `${Math.round(score)}%` : "—"}
                                </span>
                                <BandBadge band={band} score={score} size="sm" showDot />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Desktop 5-Column Grid (sm+) */}
                      <div className="hidden sm:grid sm:grid-cols-5 gap-2 pt-0.5">
                        {PARENT_CRITERIA.map((criterion) => {
                          const score = item.scores[criterion.criterionKey];
                          const band = item.bands[criterion.criterionKey];
                          return (
                            <div
                              key={criterion.criterionKey}
                              className="rounded-lg border border-border/60 bg-muted/20 px-2.5 py-1.5 flex flex-col justify-between"
                            >
                              <span className="text-[11px] font-medium text-muted-foreground truncate" title={criterion.label}>
                                {criterion.label}
                              </span>
                              <div className="flex items-center justify-between gap-1 mt-1">
                                <span className="text-xs font-semibold font-sans tabular-nums text-foreground">
                                  {score != null ? `${Math.round(score)}%` : "—"}
                                </span>
                                <BandBadge band={band} score={score} size="sm" showDot />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Detailed Accordion Breakdown (Streamlined & Unboxed) */}
                    {isExpanded && (
                      <div
                        id={`details-${item.submissionId}`}
                        className="pt-3 animate-in fade-in-50 duration-200 motion-reduce:animate-none space-y-2.5 border-t border-border/60"
                      >
                        <h5 className="text-xs font-semibold text-muted-foreground">
                          Diagnostic Feedback &amp; Skill Observations
                        </h5>
                        <div className="divide-y divide-border/60">
                          {PARENT_CRITERIA.map((criterion) => (
                            <CriterionFeedbackRow
                              key={criterion.criterionKey}
                              criterionKey={criterion.criterionKey}
                              label={criterion.label}
                              score={item.scores[criterion.criterionKey]}
                              band={item.bands[criterion.criterionKey]}
                              showDiagnosticNote={true}
                              showPositionBar={true}
                              onInspect={
                                item.imagePath
                                  ? () =>
                                      handleOpenWorksheetView(
                                        item,
                                        criterion.criterionKey as CriterionFilter
                                      )
                                  : undefined
                              }
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Streamlined Footer */}
          <div className="py-2.5 px-4 sm:px-6 border-t border-border bg-card/60 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Showing {sortedHistory.length}{" "}
              {sortedHistory.length === 1 ? "worksheet" : "worksheets"}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3 text-xs font-medium cursor-pointer"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sub-Modal: Individual Historical Worksheet Photo Viewer */}
      {selectedItemForView && (
        <WorksheetViewDialog
          open={!!selectedItemForView}
          onOpenChange={(openNext) => {
            if (!openNext) handleBackFromWorksheetView();
          }}
          onBack={handleBackFromWorksheetView}
          backLabel="Back to History"
          initialCriterion={initialCriterionForView}
          submissionId={selectedItemForView.submissionId}
          canDelete={selectedItemForView.canDelete}
          imagePath={selectedItemForView.imagePath ?? null}
          targetText={selectedItemForView.targetText}
          submissionDate={selectedItemForView.submissionDate}
          childName={childName}
          compositeScore={selectedItemForView.compositeScore}
          scoreSource={selectedItemForView.scoreSource}
          scores={selectedItemForView.scores}
          bands={selectedItemForView.bands}
          guideLines={selectedItemForView.guideLines}
          overlay={selectedItemForView.overlay}
        />
      )}
    </>
  );
}
