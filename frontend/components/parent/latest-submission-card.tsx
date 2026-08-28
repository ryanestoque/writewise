"use client";

import { useChildLatestScores } from "@/lib/hooks/use-parent-data";
import { BandPositionBar } from "@/components/shared/band-position-bar";
import { BandBadge } from "@/components/shared/band-badge";
import { ScoreSourceIndicator } from "@/components/shared/score-source-indicator";
import { CriterionFeedbackRow } from "./criterion-feedback-row";
import { RUBRIC_CRITERIA } from "@/lib/utils/scoring";
import { FileText, Loader2 } from "lucide-react";

interface LatestSubmissionCardProps {
  childId: string | null;
}

const PARENT_CRITERIA = RUBRIC_CRITERIA.map((c) => ({
  criterionKey: c.criterionKey,
  label: c.shortName,
}));

export function LatestSubmissionCard({ childId }: LatestSubmissionCardProps) {
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
    <div className="rounded-xl border border-border bg-card shadow-warm overflow-hidden transition-shadow hover:shadow-md">
      {/* Header & Composite Score */}
      <div className="px-5 pt-5 pb-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground truncate" title={latest.activityText}>
              {latest.activityText}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Assessed on {formattedDate}</p>
          </div>
          {latest.scoreSource !== "none" && (
            <ScoreSourceIndicator source={latest.scoreSource} compact />
          )}
        </div>

        {/* Overall Composite Score */}
        <div className="space-y-2 p-3.5 rounded-lg bg-muted/30 border border-border/50">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs sm:text-sm font-medium text-foreground">
              Overall Composite Score
            </span>
            <BandBadge score={latest.scores.composite} />
          </div>
          <BandPositionBar score={latest.scores.composite} showLabel />
        </div>
      </div>

      {/* Criterion Breakdown */}
      <div className="border-t border-border/60 px-5 pb-4 pt-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider py-2">
          Diagnostic Breakdown
        </h3>
        <div>
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
      </div>
    </div>
  );
}
