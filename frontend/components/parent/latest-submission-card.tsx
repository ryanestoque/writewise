"use client";

import { useState } from "react";
import { useChildLatestScores } from "@/lib/hooks/use-parent-data";
import { BandPositionBar } from "@/components/shared/band-position-bar";
import { BandBadge } from "@/components/shared/band-badge";
import { ScoreSourceIndicator } from "@/components/shared/score-source-indicator";
import { CriterionFeedbackRow } from "./criterion-feedback-row";
import { WorksheetViewDialog } from "./worksheet-view-dialog";
import { RUBRIC_CRITERIA } from "@/lib/utils/scoring";
import { FileText, Loader2, History, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LatestSubmissionCardProps {
  childId: string | null;
  childName?: string;
  onViewHistoryClick?: () => void;
  historyCount?: number;
}

const PARENT_CRITERIA = RUBRIC_CRITERIA.map((c) => ({
  criterionKey: c.criterionKey,
  label: c.shortName,
}));

export function LatestSubmissionCard({
  childId,
  childName = "Your child",
  onViewHistoryClick,
  historyCount,
}: LatestSubmissionCardProps) {
  const [viewImageOpen, setViewImageOpen] = useState(false);
  const { data: latest, isLoading } = useChildLatestScores(childId);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card shadow-warm p-8 flex flex-col items-center justify-center min-h-[220px] gap-2.5">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Loading latest assessment...</span>
      </div>
    );
  }

  if (!latest) {
    return (
      <div className="rounded-xl border border-border bg-card shadow-warm p-8 text-center space-y-3">
        <div className="flex justify-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300">
            <FileText className="size-6" />
          </div>
        </div>
        <h3 className="font-heading text-base font-semibold text-foreground">
          No assessment results yet
        </h3>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
          Once a worksheet is uploaded and scored, your child&apos;s progress and diagnostic feedback will appear here.
        </p>
      </div>
    );
  }

  const formattedDate = new Date(latest.submissionDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <>
      <div className="rounded-xl border border-border bg-card shadow-warm overflow-hidden transition-shadow hover:shadow-md">
        {/* Header & Composite Score */}
        <div className="px-5 pt-5 pb-5 space-y-4 bg-card">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-foreground truncate" title={latest.activityText}>
                &ldquo;{latest.activityText}&rdquo;
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Assessed on {formattedDate}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {latest.scoreSource !== "none" && (
                <ScoreSourceIndicator source={latest.scoreSource} compact />
              )}
            </div>
          </div>

          {/* Overall Composite Score Stat & Bar */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-baseline justify-between gap-2">
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Overall Composite Score
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-bold font-sans tabular-nums text-foreground">
                    {latest.scores.composite != null
                      ? `${latest.scores.composite.toFixed(1)}%`
                      : "—"}
                  </span>
                  <span className="text-xs text-muted-foreground font-normal">composite mastery</span>
                </div>
              </div>
              <BandBadge score={latest.scores.composite} size="default" />
            </div>
            <BandPositionBar score={latest.scores.composite} height="default" />
          </div>

          {/* Action Trigger: View Worksheet Photo */}
          {latest.imagePath && (
            <div className="pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewImageOpen(true)}
                aria-haspopup="dialog"
                className="w-full h-9 text-xs sm:text-sm font-medium gap-2 border-brand-200 dark:border-brand-900 bg-brand-50/50 dark:bg-brand-950/30 text-brand-800 dark:text-brand-200 hover:bg-brand-100/60 dark:hover:bg-brand-900/50 cursor-pointer shadow-xs"
              >
                <Eye className="size-4 text-brand-600 dark:text-brand-400" />
                <span>View Scored Worksheet Photo</span>
              </Button>
            </div>
          )}
        </div>

        {/* Criterion Breakdown */}
        <div className="border-t border-border/70 px-5 pb-4 pt-3 bg-muted/10">
          <div className="flex items-center justify-between pb-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Diagnostic Breakdown
            </h4>
            <span className="text-[11px] text-muted-foreground">5 penmanship criteria</span>
          </div>
          <div className="divide-y divide-border/50">
            {PARENT_CRITERIA.map((criterion) => (
              <CriterionFeedbackRow
                key={criterion.criterionKey}
                criterionKey={criterion.criterionKey}
                label={criterion.label}
                score={latest.scores[criterion.criterionKey]}
                band={latest.bands[criterion.criterionKey]}
              />
            ))}
          </div>

          {onViewHistoryClick && historyCount != null && historyCount > 1 && (
            <div className="pt-3 mt-1 border-t border-border/50 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={onViewHistoryClick}
                className="h-8 text-xs font-medium gap-1.5 border-border/80 hover:bg-muted/60 cursor-pointer"
              >
                <History className="size-3.5 text-brand-600 dark:text-brand-400" />
                <span>View Past Worksheets ({historyCount})</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Worksheet Photo Viewer Modal */}
      <WorksheetViewDialog
        open={viewImageOpen}
        onOpenChange={setViewImageOpen}
        imagePath={latest.imagePath}
        targetText={latest.activityText}
        submissionDate={latest.submissionDate}
        childName={childName}
        compositeScore={latest.scores.composite}
        scoreSource={latest.scoreSource}
        scores={latest.scores}
        bands={latest.bands}
      />
    </>
  );
}
