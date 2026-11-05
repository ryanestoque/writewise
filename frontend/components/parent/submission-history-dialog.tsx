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
import { WorksheetViewDialog } from "./worksheet-view-dialog";
import { PendingWorksheetDialog } from "./pending-worksheet-dialog";
import { Badge } from "@/components/ui/badge";
import type { StudentScoreHistoryItem } from "@/lib/hooks/use-dashboard";
import type { CriterionFilter } from "@/components/shared/diagnostic-overlay";
import { cn } from "@/lib/utils";
import {
  formatScoreDifference,
  getScoreProgressDirection,
  getScoreProgressLabel,
} from "@/lib/utils/score-progress";
import {
  FileText,
  Eye,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
} from "lucide-react";

interface ProcessedHistoryItem extends StudentScoreHistoryItem {
  attemptNumber: number;
  isBaseline: boolean;
  delta: number | null;
}

function buildProcessedHistory(
  history: StudentScoreHistoryItem[],
  sortOrder: "newest" | "oldest" = "newest"
): ProcessedHistoryItem[] {
  let previousActiveScore: number | null = null;
  const countedItems = history.filter(
    (item) => item.isActiveAttempt && !!item.releasedAt && item.compositeScore != null
  );
  const items = history.map((item, idx) => {
    const counted = !!item.isActiveAttempt && !!item.releasedAt && item.compositeScore != null;
    const currentScore = item.compositeScore;
    const prevScore = previousActiveScore;
    const delta =
      counted && currentScore != null && prevScore != null ? currentScore - prevScore : null;
    const isBaseline = counted && prevScore == null && countedItems.length > 1;
    if (counted) previousActiveScore = currentScore;
    return {
      ...item,
      attemptNumber: idx + 1,
      isBaseline,
      delta,
    };
  });
  return sortOrder === "newest" ? items.reverse() : items;
}

function getDeltaChangeLabel(delta: number, showScoreDetails: boolean): string {
  const label = getScoreProgressLabel(delta, "previous");
  return showScoreDetails ? `${label} (${formatScoreDifference(delta)})` : label;
}

function HistoryItemRow({
  item,
  onOpenWorksheetView,
  showScoreDetails,
}: {
  item: ProcessedHistoryItem;
  onOpenWorksheetView: (item: StudentScoreHistoryItem, criterion?: CriterionFilter) => void;
  showScoreDetails: boolean;
}) {
  const formattedDate = new Date(item.submissionDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const statusLabel =
    item.status === "returned"
      ? "New photo requested"
      : item.status === "rejected"
        ? "Clearer photo needed"
        : item.status === "processing"
          ? "Checking handwriting"
          : item.compositeScore != null
            ? "Scored"
            : "Turned in";

  return (
    <div className="px-4 py-3.5 sm:px-5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/25 transition-colors">
      <div className="space-y-1 min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3
            className="text-sm sm:text-base font-semibold text-foreground truncate"
            title={item.targetText}
          >
            &ldquo;{item.targetText}&rdquo;
          </h3>

          {item.delta != null && (
            <span
              className={cn(
                "inline-flex max-w-full items-center px-2 py-0.5 rounded-md tabular-nums text-xs font-medium",
                getScoreProgressDirection(item.delta) === "improving"
                  ? "text-band-4-text dark:text-emerald-300 bg-band-4/15 dark:bg-band-4/25 border border-band-4/30 dark:border-band-4/40"
                  : getScoreProgressDirection(item.delta) === "lower"
                    ? "text-band-2-text dark:text-amber-200 bg-band-2/15 dark:bg-band-2/25 border border-band-2/30 dark:border-band-2/40"
                    : "text-muted-foreground bg-muted/40 border border-border/60"
              )}
            >
              {getDeltaChangeLabel(item.delta, showScoreDetails)}
            </span>
          )}

          {item.isBaseline && (
            <span className="inline-flex items-center text-xs font-medium text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-md border border-border/50 shrink-0">
              First worksheet
            </span>
          )}

          {!item.isActiveAttempt && item.compositeScore != null && (
            <Badge variant="outline" className="text-xs">
              Earlier upload
            </Badge>
          )}
        </div>

        <p className="text-xs text-muted-foreground font-sans tabular-nums">
          {formattedDate}
          {showScoreDetails ? ` · Worksheet #${item.attemptNumber}` : ""}
          {item.status === "completed" && item.compositeScore == null
            ? " · Awaiting teacher review"
            : ""}
          {item.returnedAt
            ? ` · Teacher requested another photo${item.returnReason ? ` (${item.returnReason.replaceAll("_", " ")})` : ""
            }`
            : ""}
        </p>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0">
        <div className="flex items-center gap-2">
          {showScoreDetails && item.compositeScore != null && (
            <span className="text-sm font-semibold font-sans tabular-nums text-foreground">
              {Math.round(item.compositeScore)}%
            </span>
          )}
          {item.compositeScore != null ? (
            <BandBadge score={item.compositeScore} size="sm" showDot />
          ) : (
            <Badge variant="secondary">{statusLabel}</Badge>
          )}
        </div>

        {item.imagePath && (
          <Button
            id={`inspect-btn-${item.submissionId}`}
            variant="outline"
            size="sm"
            onClick={() => onOpenWorksheetView(item)}
            aria-haspopup="dialog"
            aria-label={`See worksheet photo and guide lines for "${item.targetText}"`}
            className="h-10 min-h-10 sm:h-9 sm:min-h-9 text-xs font-medium gap-1.5 cursor-pointer"
          >
            <Eye className="size-3.5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
            <span>View</span>
          </Button>
        )}
      </div>
    </div>
  );
}

interface PastWorksheetsSectionProps {
  history: StudentScoreHistoryItem[];
  childName: string;
  showScoreDetails: boolean;
  onToggleScoreDetails?: () => void;
  onUploadActivity?: (activityId: string) => void;
}

export function PastWorksheetsSection({
  history,
  childName,
  showScoreDetails,
  onUploadActivity,
}: PastWorksheetsSectionProps) {
  const [showAllInline, setShowAllInline] = useState(false);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [selectedItemForView, setSelectedItemForView] =
    useState<StudentScoreHistoryItem | null>(null);
  const [initialCriterionForView, setInitialCriterionForView] =
    useState<CriterionFilter | undefined>(undefined);

  const processedHistory = useMemo(
    () => buildProcessedHistory(history, sortOrder),
    [history, sortOrder]
  );

  if (processedHistory.length === 0) {
    return null;
  }

  const visibleItems = showAllInline
    ? processedHistory
    : processedHistory.slice(0, 5);

  const handleOpenWorksheetView = (
    item: StudentScoreHistoryItem,
    criterion?: CriterionFilter
  ) => {
    setInitialCriterionForView(criterion);
    setSelectedItemForView(item);
  };

  return (
    <section aria-labelledby="past-worksheets-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h2
            id="past-worksheets-heading"
            className="font-heading text-base sm:text-lg font-semibold text-foreground"
          >
            Past Worksheets
          </h2>
          <span className="text-xs sm:text-sm text-muted-foreground font-sans tabular-nums">
            ({processedHistory.length})
          </span>
        </div>

        {processedHistory.length > 1 && (
          <button
            type="button"
            onClick={() => setSortOrder((prev) => (prev === "newest" ? "oldest" : "newest"))}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-10 sm:min-h-9 rounded-lg bg-card border border-border/80 hover:bg-muted/50 text-xs font-medium text-foreground transition-colors cursor-pointer touch-manipulation"
          >
            <ArrowUpDown className="size-3.5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
            <span>{sortOrder === "newest" ? "Newest first" : "Oldest first"}</span>
          </button>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card divide-y divide-border/70 overflow-hidden">
        {visibleItems.map((item) => (
          <HistoryItemRow
            key={item.submissionId}
            item={item}
            onOpenWorksheetView={handleOpenWorksheetView}
            showScoreDetails={showScoreDetails}
          />
        ))}
      </div>

      {processedHistory.length > 5 && (
        <div className="flex justify-center pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowAllInline((prev) => !prev)}
            className="h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] px-4 text-xs sm:text-sm font-medium gap-1.5 cursor-pointer"
          >
            {showAllInline ? (
              <>
                <ChevronUp className="size-4" aria-hidden="true" />
                <span>Show latest 5 only</span>
              </>
            ) : (
              <>
                <ChevronDown className="size-4" aria-hidden="true" />
                <span>See all worksheets ({processedHistory.length})</span>
              </>
            )}
          </Button>
        </div>
      )}

      {selectedItemForView && selectedItemForView.compositeScore == null && (
        <PendingWorksheetDialog
          item={selectedItemForView}
          childName={childName}
          onBack={() => setSelectedItemForView(null)}
          backLabel="Back to worksheets"
          onUploadActivity={onUploadActivity}
        />
      )}

      {selectedItemForView && selectedItemForView.compositeScore != null && (
        <WorksheetViewDialog
          open={!!selectedItemForView}
          onOpenChange={(openNext) => {
            if (!openNext) {
              setSelectedItemForView(null);
              setInitialCriterionForView(undefined);
            }
          }}
          initialCriterion={initialCriterionForView}
          initialShowScoreDetails={showScoreDetails}
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
    </section>
  );
}

interface SubmissionHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  history: StudentScoreHistoryItem[];
  childName: string;
  onOpenRubric?: () => void;
  initialShowScoreDetails?: boolean;
  onUploadActivity?: (activityId: string) => void;
}

export function SubmissionHistoryDialog({
  open,
  onOpenChange,
  history,
  childName,
  initialShowScoreDetails = false,
  onUploadActivity,
}: SubmissionHistoryDialogProps) {
  const [selectedItemForView, setSelectedItemForView] =
    useState<StudentScoreHistoryItem | null>(null);
  const [initialCriterionForView, setInitialCriterionForView] =
    useState<CriterionFilter | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [showScoreDetails, setShowScoreDetails] = useState(initialShowScoreDetails);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const savedScrollTopRef = useRef<number>(0);
  const lastTriggeredButtonIdRef = useRef<string | null>(null);

  const processedHistory = useMemo(
    () => buildProcessedHistory(history, sortOrder),
    [history, sortOrder]
  );

  const isViewingWorksheet = !!selectedItemForView;

  useEffect(() => {
    if (!isViewingWorksheet && scrollContainerRef.current) {
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

  return (
    <>
      <Dialog open={open && !isViewingWorksheet} onOpenChange={onOpenChange}>
        <DialogContent className="w-[calc(100%-1.5rem)] sm:max-w-3xl lg:max-w-4xl max-h-[min(90dvh,calc(100vh-2rem))] p-0 gap-0 overflow-hidden flex flex-col shadow-warm">
          <DialogHeader className="p-5 sm:p-6 pb-4 border-b border-border bg-card/60">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pr-8">
              <div className="space-y-1 min-w-0">
                <DialogTitle className="font-heading text-lg sm:text-xl font-semibold text-foreground">
                  Past Worksheets ({processedHistory.length})
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  All worksheets uploaded for {childName}
                </DialogDescription>
              </div>

              <div className="flex flex-wrap items-center gap-2 self-start sm:self-center shrink-0">
                {processedHistory.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setSortOrder((prev) => (prev === "newest" ? "oldest" : "newest"))}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-10 sm:min-h-9 rounded-lg bg-card border border-border/80 hover:bg-muted/50 text-xs font-medium text-foreground transition-colors cursor-pointer"
                  >
                    <ArrowUpDown className="size-3.5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                    <span>{sortOrder === "newest" ? "Newest first" : "Oldest first"}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowScoreDetails((prev) => !prev)}
                  aria-pressed={showScoreDetails}
                  className="text-xs font-medium text-brand-700 dark:text-brand-300 hover:text-brand-800 dark:hover:text-brand-200 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 rounded-lg px-3 py-1.5 min-h-10 sm:min-h-9 inline-flex items-center justify-center border border-brand-200/70 dark:border-brand-800/70 bg-brand-50/50 dark:bg-brand-950/30 transition-colors"
                >
                  {showScoreDetails ? "Hide details" : "Show details"}
                </button>
              </div>
            </div>
          </DialogHeader>

          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto p-4 sm:p-6"
          >
            {processedHistory.length === 0 ? (
              <div className="p-8 text-center space-y-2 rounded-xl border border-dashed border-border bg-muted/20">
                <FileText
                  className="size-8 text-muted-foreground/60 mx-auto"
                  aria-hidden="true"
                />
                <p className="text-sm font-medium text-foreground">
                  No past worksheets yet
                </p>
                <p className="text-sm text-muted-foreground">
                  Completed worksheets will appear here.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card divide-y divide-border/70 overflow-hidden">
                {processedHistory.map((item) => (
                  <HistoryItemRow
                    key={item.submissionId}
                    item={item}
                    onOpenWorksheetView={handleOpenWorksheetView}
                    showScoreDetails={showScoreDetails}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="py-3 px-4 sm:px-6 border-t border-border bg-card/60 flex items-center justify-end">
            <Button
              variant="outline"
              size="sm"
              className="h-10 min-h-10 sm:h-9 sm:min-h-9 px-4 text-xs sm:text-sm font-medium cursor-pointer"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {selectedItemForView && selectedItemForView.compositeScore == null && (
        <PendingWorksheetDialog
          item={selectedItemForView}
          childName={childName}
          onBack={handleBackFromWorksheetView}
          onUploadActivity={onUploadActivity}
        />
      )}
      {selectedItemForView && selectedItemForView.compositeScore != null && (
        <WorksheetViewDialog
          open={!!selectedItemForView}
          onOpenChange={(openNext) => {
            if (!openNext) handleCloseAll();
          }}
          onBack={handleBackFromWorksheetView}
          backLabel="Back to Past Worksheets"
          initialCriterion={initialCriterionForView}
          initialShowScoreDetails={showScoreDetails}
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
