"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BandBadge } from "@/components/shared/band-badge";
import { ScoreSourceIndicator } from "@/components/shared/score-source-indicator";
import { CriterionFeedbackRow } from "./criterion-feedback-row";
import { WorksheetViewDialog } from "./worksheet-view-dialog";
import { RUBRIC_CRITERIA } from "@/lib/utils/scoring";
import type { StudentScoreHistoryItem } from "@/lib/hooks/use-dashboard";
import { History, Calendar, FileText, Eye } from "lucide-react";

interface SubmissionHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  history: StudentScoreHistoryItem[];
  childName: string;
}

const PARENT_CRITERIA = RUBRIC_CRITERIA.map((c) => ({
  criterionKey: c.criterionKey,
  label: c.shortName,
}));

export function SubmissionHistoryDialog({
  open,
  onOpenChange,
  history,
  childName,
}: SubmissionHistoryDialogProps) {
  const [selectedItemForView, setSelectedItemForView] =
    useState<StudentScoreHistoryItem | null>(null);

  // Sort reverse-chronologically (newest first)
  const sortedHistory = [...history].reverse();

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-2xl max-h-[min(90dvh,calc(100vh-2rem))] p-0 gap-0 overflow-hidden flex flex-col shadow-warm">
          {/* Header */}
          <DialogHeader className="p-5 sm:p-6 pb-4 border-b border-border bg-card/60">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300">
                <History className="size-4.5" />
              </div>
              <div>
                <DialogTitle className="font-heading text-lg sm:text-xl font-semibold text-foreground">
                  Worksheet Assessment History
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Past graded worksheets and criterion feedback for {childName}.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* List of submissions */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {sortedHistory.length === 0 ? (
              <div className="p-8 text-center space-y-2 rounded-xl border border-dashed border-border bg-muted/20">
                <FileText className="size-8 text-muted-foreground/60 mx-auto" />
                <p className="text-sm font-medium text-foreground">No past submissions recorded</p>
                <p className="text-xs text-muted-foreground">
                  Completed worksheets will appear here in chronological order.
                </p>
              </div>
            ) : (
              sortedHistory.map((item, index) => {
                const formattedDate = new Date(item.submissionDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });

                return (
                  <div
                    key={item.submissionId}
                    className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-warm space-y-3.5 transition-shadow hover:shadow-md"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/60 pb-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Attempt #{sortedHistory.length - index}
                          </span>
                          {item.scoreSource && (
                            <ScoreSourceIndicator source={item.scoreSource} compact />
                          )}
                        </div>
                        <h4 className="text-sm sm:text-base font-semibold text-foreground truncate" title={item.targetText}>
                          &ldquo;{item.targetText}&rdquo;
                        </h4>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Calendar className="size-3.5" />
                          <span>Assessed on {formattedDate}</span>
                        </p>
                      </div>

                      <div className="flex items-center sm:flex-col sm:items-end justify-between sm:justify-start gap-2 shrink-0 pt-1 sm:pt-0">
                        <div className="flex items-center gap-2">
                          <span className="text-lg sm:text-xl font-bold font-sans tabular-nums text-foreground">
                            {item.compositeScore != null ? `${item.compositeScore.toFixed(1)}%` : "—"}
                          </span>
                          <BandBadge score={item.compositeScore} size="sm" />
                        </div>

                        {item.imagePath && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedItemForView(item)}
                            className="h-8 text-xs font-medium gap-1.5 border-brand-200 dark:border-brand-900 bg-brand-50/40 dark:bg-brand-950/30 text-brand-800 dark:text-brand-200 hover:bg-brand-100/60 dark:hover:bg-brand-900/50 cursor-pointer shadow-2xs"
                          >
                            <Eye className="size-3.5 text-brand-600 dark:text-brand-400" />
                            <span>View Photo</span>
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Criterion Breakdown */}
                    <div className="pt-1">
                      <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Criterion Diagnostics
                      </h5>
                      <div className="divide-y divide-border/50 bg-muted/10 rounded-lg p-3 border border-border/40">
                        {PARENT_CRITERIA.map((criterion) => (
                          <CriterionFeedbackRow
                            key={criterion.criterionKey}
                            criterionKey={criterion.criterionKey}
                            label={criterion.label}
                            score={item.scores[criterion.criterionKey]}
                            band={item.bands[criterion.criterionKey]}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-4 sm:p-5 border-t border-border bg-card/60 flex justify-end">
            <Button
              variant="default"
              size="sm"
              className="h-9 px-4 font-medium cursor-pointer"
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
            if (!openNext) setSelectedItemForView(null);
          }}
          imagePath={selectedItemForView.imagePath ?? null}
          targetText={selectedItemForView.targetText}
          submissionDate={selectedItemForView.submissionDate}
          childName={childName}
          compositeScore={selectedItemForView.compositeScore}
          scoreSource={selectedItemForView.scoreSource}
          scores={selectedItemForView.scores}
          bands={selectedItemForView.bands}
        />
      )}
    </>
  );
}
