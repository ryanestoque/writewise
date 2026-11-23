"use client";

import { humanizeReason } from "@/lib/utils/humanize-reason";

import { useState, useMemo } from "react";
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
  return showScoreDetails ? `${label} ${formatScoreDifference(delta)}` : label;
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
    <div className="px-4 py-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/25 transition-colors">
      <div className="space-y-1 min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3
            className="text-sm sm:text-base font-sans font-semibold text-foreground truncate"
            title={item.targetText}
          >
            &ldquo;{item.targetText}&rdquo;
          </h3>

          {item.delta != null && (
            <span
              className={cn(
                "inline-flex max-w-full items-center px-2 py-0.5 rounded-md tabular-nums text-xs font-medium",
                getScoreProgressDirection(item.delta) === "improving"
                  ? "text-band-4-text bg-band-4/15 dark:bg-band-4/25 border border-band-4/30 dark:border-band-4/40"
                  : getScoreProgressDirection(item.delta) === "lower"
                    ? "text-band-2-text bg-band-2/15 dark:bg-band-2/25 border border-band-2/30 dark:border-band-2/40"
                    : "text-muted-foreground bg-muted/40 border border-border/60"
              )}
            >
              {getDeltaChangeLabel(item.delta, showScoreDetails)}
            </span>
          )}
        </div>

        <p className="text-xs text-muted-foreground font-sans tabular-nums">
          {formattedDate}
          {item.isBaseline ? " · First" : ""}
          {!item.isActiveAttempt && item.compositeScore != null ? " · Earlier upload" : ""}
          {item.status === "completed" && item.compositeScore == null
            ? " · Pending review"
            : ""}
          {item.returnedAt
            ? ` · New photo requested${item.returnReason ? ` (${humanizeReason(item.returnReason)})` : ""}`
            : ""}
        </p>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
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
            className="h-10 min-h-10 sm:h-9 sm:min-h-9 text-xs font-medium cursor-pointer"
          >
            View
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
  onToggleScoreDetails,
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
            Past worksheets
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
                <span>Show fewer</span>
              </>
            ) : (
              <>
                <ChevronDown className="size-4" aria-hidden="true" />
                <span>See all ({processedHistory.length})</span>
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
          showScoreDetails={showScoreDetails}
          onToggleScoreDetails={onToggleScoreDetails}
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
