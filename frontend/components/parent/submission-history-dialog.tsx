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
  FileText,
  Eye,
  ChevronDown,
  BookOpen,
  ArrowUpDown,
} from "lucide-react";

interface SubmissionHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  history: StudentScoreHistoryItem[];
  childName: string;
  onOpenRubric?: () => void;
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
  onOpenRubric,
}: SubmissionHistoryDialogProps) {
  const [selectedItemForView, setSelectedItemForView] =
    useState<StudentScoreHistoryItem | null>(null);
  const [initialCriterionForView, setInitialCriterionForView] =
    useState<CriterionFilter | undefined>(undefined);
  const [expandedSubmissions, setExpandedSubmissions] = useState<
    Record<string, boolean>
  >({});
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const savedScrollTopRef = useRef<number>(0);
  const lastTriggeredButtonIdRef = useRef<string | null>(null);

  // Build items with permanent chronological attempt numbers & previous-attempt deltas
  const processedHistory = useMemo(() => {
    // history is in chronological order (earliest = index 0)
    const items = history.map((item, idx) => {
      const prevItem = idx > 0 ? history[idx - 1] : null;
      const currentScore = item.compositeScore;
      const prevScore = prevItem?.compositeScore;
      const delta =
        currentScore != null && prevScore != null ? currentScore - prevScore : null;
      return {
        ...item,
        attemptNumber: idx + 1,
        isBaseline: idx === 0 && history.length > 1,
        delta,
      };
    });
    return sortOrder === "newest" ? items.reverse() : items;
  }, [history, sortOrder]);

  const isViewingWorksheet = !!selectedItemForView;

  // Restore scroll position and keyboard focus when returning from the worksheet photo viewer
  useEffect(() => {
    if (!isViewingWorksheet && scrollContainerRef.current && savedScrollTopRef.current > 0) {
      const scrollEl = scrollContainerRef.current;
      const targetScroll = savedScrollTopRef.current;
      requestAnimationFrame(() => {
        if (scrollEl) {
          scrollEl.scrollTop = targetScroll;
        }
        if (lastTriggeredButtonIdRef.current) {
          const btn = document.getElementById(lastTriggeredButtonIdRef.current);
          if (btn) {
            btn.focus();
          }
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
    lastTriggeredButtonIdRef.current = `inspect-btn-${item.submissionId}`;
    setInitialCriterionForView(criterion);
    setSelectedItemForView(item);
  };

  const handleBackFromWorksheetView = () => {
    setSelectedItemForView(null);
    setInitialCriterionForView(undefined);
  };

  const handleCloseAll = () => {
    setSelectedItemForView(null);
    setInitialCriterionForView(undefined);
    onOpenChange(false);
  };

  const toggleExpanded = (submissionId: string) => {
    setExpandedSubmissions((prev) => ({
      ...prev,
      [submissionId]: !prev[submissionId],
    }));
  };

  const allExpanded = useMemo(() => {
    return (
      processedHistory.length > 0 &&
      processedHistory.every((item) => !!expandedSubmissions[item.submissionId])
    );
  }, [processedHistory, expandedSubmissions]);

  const toggleAllExpanded = () => {
    if (allExpanded) {
      setExpandedSubmissions({});
    } else {
      const next: Record<string, boolean> = {};
      for (const item of processedHistory) {
        next[item.submissionId] = true;
      }
      setExpandedSubmissions(next);
    }
  };

  const scrollToTop = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  // Compute longitudinal trajectory from earliest to latest attempt
  const overallStats = useMemo(() => {
    if (history.length < 2) return null;
    const newestScore = history[history.length - 1]?.compositeScore;
    const oldestScore = history[0]?.compositeScore;
    if (newestScore == null || oldestScore == null) return null;
    const overallDelta = newestScore - oldestScore;
    return {
      newestScore,
      oldestScore,
      overallDelta,
    };
  }, [history]);

  return (
    <>
      <Dialog open={open && !isViewingWorksheet} onOpenChange={onOpenChange}>
        <DialogContent className="w-[calc(100%-1.5rem)] sm:max-w-3xl lg:max-w-4xl max-h-[min(90dvh,calc(100vh-2rem))] p-0 gap-0 overflow-hidden flex flex-col shadow-warm">
          {/* Header */}
          <DialogHeader className="p-5 sm:p-6 pb-4 border-b border-border bg-card/60">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <DialogTitle className="font-heading text-lg sm:text-xl font-semibold text-foreground">
                  Worksheet History &amp; Scores
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
                  {processedHistory.length > 0 ? (
                    <>
                      {processedHistory.length} scored{" "}
                      {processedHistory.length === 1 ? "worksheet" : "worksheets"}{" "}
                      for{" "}
                      <span className="font-medium text-foreground">
                        {childName}
                      </span>{" "}
                      ({sortOrder === "newest" ? "showing newest first" : "showing earliest first"})
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
                        "font-semibold font-sans tabular-nums inline-flex items-center px-2 py-0.5 rounded-md text-[11px] shadow-2xs",
                        overallStats.overallDelta > 0
                          ? "text-band-4-text dark:text-emerald-300 bg-band-4/15 dark:bg-band-4/25 border border-band-4/30 dark:border-band-4/40"
                          : overallStats.overallDelta < 0
                          ? "text-band-2-text dark:text-amber-200 bg-band-2/15 dark:bg-band-2/25 border border-band-2/30 dark:border-band-2/40"
                          : "text-muted-foreground bg-muted/40 border border-border/60"
                      )}
                    >
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

              {/* Action Buttons in Header */}
              <div className="flex flex-wrap items-center gap-2 self-start sm:self-center shrink-0">
                {onOpenRubric && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onOpenRubric}
                    className="h-10 sm:h-8 min-h-[40px] sm:min-h-[32px] px-2.5 text-xs font-medium gap-1.5 border-border/80 hover:bg-muted/50 cursor-pointer shadow-2xs"
                    title="Open 5-criterion rubric scoring reference"
                  >
                    <BookOpen className="size-3.5 text-brand-600 dark:text-brand-400 shrink-0" aria-hidden="true" />
                    <span>Scoring Rubric</span>
                  </Button>
                )}

                {processedHistory.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleAllExpanded}
                    className="text-xs font-medium text-brand-700 dark:text-brand-300 hover:text-brand-800 dark:hover:text-brand-200 cursor-pointer h-10 sm:h-8 min-h-[40px] sm:min-h-[32px] px-3 rounded-lg hover:bg-brand-50/60 dark:hover:bg-brand-950/40 border border-transparent hover:border-brand-200/60 dark:hover:border-brand-800/60 transition-colors inline-flex items-center touch-manipulation"
                  >
                    {allExpanded ? "Collapse All Details" : "Expand All Details"}
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>

          {/* Interactive Sub-Header Controls for Multi-Attempt Navigation */}
          {history.length > 2 && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-2 bg-muted/30 border-b border-border/60 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground font-medium">Order:</span>
                <button
                  type="button"
                  onClick={() => setSortOrder((prev) => (prev === "newest" ? "oldest" : "newest"))}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-card border border-border/80 hover:bg-muted/50 text-foreground font-medium transition-colors cursor-pointer shadow-2xs touch-manipulation"
                  title="Toggle chronological sorting"
                >
                  <ArrowUpDown className="size-3 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                  <span>{sortOrder === "newest" ? "Newest First" : "Earliest First"}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={scrollToTop}
                  className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer hover:underline touch-manipulation"
                >
                  Jump to {sortOrder === "newest" ? "Latest" : "Baseline"}
                </button>
                <span className="text-border" aria-hidden="true">&middot;</span>
                <button
                  type="button"
                  onClick={scrollToBottom}
                  className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer hover:underline touch-manipulation"
                >
                  Jump to {sortOrder === "newest" ? "Baseline" : "Latest"}
                </button>
              </div>
            </div>
          )}

          {/* List of submissions */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4"
          >
            {processedHistory.length === 0 ? (
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
              processedHistory.map((item) => {
                const formattedDate = new Date(
                  item.submissionDate
                ).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });

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
                            Attempt #{item.attemptNumber}
                          </span>

                          {item.delta != null && (
                            <span
                              className={cn(
                                "inline-flex items-center px-2 py-0.5 rounded-md tabular-nums shrink-0 text-[11px] font-semibold shadow-2xs",
                                item.delta > 0
                                  ? "text-band-4-text dark:text-emerald-300 bg-band-4/15 dark:bg-band-4/25 border border-band-4/30 dark:border-band-4/40"
                                  : item.delta < 0
                                  ? "text-band-2-text dark:text-amber-200 bg-band-2/15 dark:bg-band-2/25 border border-band-2/30 dark:border-band-2/40"
                                  : "text-muted-foreground bg-muted/40 border border-border/60"
                              )}
                              title={
                                item.delta > 0
                                  ? `Improvement of +${item.delta.toFixed(1)}% compared to Attempt #${item.attemptNumber - 1}`
                                  : item.delta < 0
                                  ? `Difference of ${item.delta.toFixed(1)}% compared to Attempt #${item.attemptNumber - 1}`
                                  : "No score change compared to previous attempt"
                              }
                            >
                              <span>
                                {item.delta > 0
                                  ? `+${item.delta.toFixed(1)}%`
                                  : `${item.delta.toFixed(1)}%`}
                              </span>
                            </span>
                          )}

                          {item.isBaseline && (
                            <span
                              className="inline-flex items-center text-[11px] font-medium text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-md border border-border/50 shrink-0"
                              title="Starting benchmark worksheet for this child"
                            >
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

                        <p className="text-xs text-muted-foreground">
                          Assessed on {formattedDate}
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
                            id={`inspect-btn-${item.submissionId}`}
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenWorksheetView(item)}
                            aria-haspopup="dialog"
                            aria-label={`View photo and guide lines for attempt #${item.attemptNumber}: "${item.targetText}"`}
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

                    {/* 5-Skill Overview & Expand Toggle */}
                    <div className="space-y-2 pt-1 border-t border-border/50">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                        {/* Organic non-truncating skill pills */}
                        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                          <span className="font-semibold text-muted-foreground mr-1 text-[11px] uppercase tracking-wider">
                            Skills:
                          </span>
                          {PARENT_CRITERIA.map((criterion) => {
                            const band = item.bands[criterion.criterionKey];
                            return (
                              <span
                                key={criterion.criterionKey}
                                className="inline-flex items-center gap-1.5 text-[11px] font-medium text-foreground/80 bg-muted/30 dark:bg-muted/20 border border-border/60 rounded-md px-2 py-0.5"
                              >
                                <span
                                  className={cn(
                                    "size-1.5 rounded-full shrink-0",
                                    band === "excellent" && "bg-band-4",
                                    band === "satisfactory" && "bg-band-3",
                                    band === "developing" && "bg-band-2",
                                    band === "needs_improvement" && "bg-band-1",
                                    !band && "bg-muted-foreground/40"
                                  )}
                                  aria-hidden="true"
                                />
                                <span>{criterion.label}</span>
                              </span>
                            );
                          })}
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleExpanded(item.submissionId)}
                          aria-expanded={isExpanded}
                          aria-controls={`details-${item.submissionId}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 dark:text-brand-300 hover:text-brand-800 dark:hover:text-brand-200 hover:underline cursor-pointer py-1 px-1.5 rounded-md hover:bg-brand-50/60 dark:hover:bg-brand-950/40 transition-colors shrink-0 self-start sm:self-auto"
                        >
                          <span>{isExpanded ? "Hide Details" : "View Feedback & Notes"}</span>
                          <ChevronDown
                            className={cn(
                              "size-3.5 transition-transform duration-200 motion-reduce:transition-none text-brand-600 dark:text-brand-400",
                              isExpanded && "rotate-180"
                            )}
                            aria-hidden="true"
                          />
                        </button>
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
              Showing {processedHistory.length}{" "}
              {processedHistory.length === 1 ? "worksheet" : "worksheets"}{" "}
              ({sortOrder === "newest" ? "newest first" : "earliest first"})
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
            if (!openNext) handleCloseAll();
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
