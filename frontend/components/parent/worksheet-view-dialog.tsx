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
import { BandPositionBar } from "@/components/shared/band-position-bar";
import { ScoreSourceIndicator } from "@/components/shared/score-source-indicator";
import { WorksheetImageInspector } from "@/components/shared/worksheet-image-inspector";
import { CriterionFeedbackRow } from "./criterion-feedback-row";
import { useSubmissionImageUrl } from "@/lib/hooks/use-submissions";
import { RUBRIC_CRITERIA, type ScoreBand } from "@/lib/utils/scoring";
import {
  FileImage,
  Calendar,
  User,
} from "lucide-react";

interface WorksheetViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imagePath: string | null;
  targetText: string;
  submissionDate: string;
  childName: string;
  compositeScore: number | null;
  scoreSource?: "manual" | "calibrated" | "none";
  scores?: {
    letter_formation: number | null;
    size_consistency: number | null;
    spacing: number | null;
    slant: number | null;
    baseline_alignment: number | null;
    composite?: number | null;
  };
  bands?: {
    letter_formation: ScoreBand | null;
    size_consistency: ScoreBand | null;
    spacing: ScoreBand | null;
    slant: ScoreBand | null;
    baseline_alignment: ScoreBand | null;
    composite?: ScoreBand | null;
  };
}

const PARENT_CRITERIA = RUBRIC_CRITERIA.map((c) => ({
  criterionKey: c.criterionKey,
  label: c.shortName,
}));

export function WorksheetViewDialog({
  open,
  onOpenChange,
  imagePath,
  targetText,
  submissionDate,
  childName,
  compositeScore,
  scoreSource = "none",
  scores,
  bands,
}: WorksheetViewDialogProps) {
  const [isZoomed, setIsZoomed] = useState(false);
  const { data: imageUrl, isLoading: isImageLoading } =
    useSubmissionImageUrl(imagePath);

  const formattedDate = new Date(submissionDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-4xl max-h-[min(94dvh,calc(100vh-2rem))] p-0 gap-0 overflow-hidden flex flex-col shadow-warm">
        {/* Header */}
        <DialogHeader className="p-4 sm:p-5 pb-3 border-b border-border bg-card/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pr-8">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex size-9 items-center justify-center rounded-xl bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 shrink-0">
                <FileImage className="size-4.5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="font-heading text-base sm:text-lg font-semibold text-foreground truncate">
                  Scored Worksheet Photo
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap truncate">
                  <span className="inline-flex items-center gap-1 font-medium text-foreground">
                    <User className="size-3 text-brand-600 dark:text-brand-400" />
                    {childName}
                  </span>
                  <span>&middot;</span>
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="size-3" />
                    {formattedDate}
                  </span>
                </DialogDescription>
              </div>
            </div>

            {scoreSource !== "none" && (
              <div className="self-start sm:self-auto">
                <ScoreSourceIndicator source={scoreSource} compact />
              </div>
            )}
          </div>
        </DialogHeader>

        {/* Content Body: Split View */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start lg:items-center">
            {/* Left: High-Resolution Worksheet Photo Inspector */}
            <div className="lg:col-span-7 flex flex-col justify-center w-full">
              <WorksheetImageInspector
                imageUrl={imageUrl}
                altText={`Handwriting worksheet submitted for ${childName}`}
                isLoading={isImageLoading}
                headerLabel="Handwritten Worksheet"
                isFrameExpanded={isZoomed}
                onToggleFrameExpanded={() => setIsZoomed((prev) => !prev)}
                allowFrameToggle={true}
              />
            </div>

            {/* Right: Worksheet Details & Criterion Feedback */}
            <div className="lg:col-span-5 space-y-4">
              {/* Activity Target Text */}
              <div className="p-3.5 rounded-xl border border-border/80 bg-card/60 space-y-1 shadow-xs">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Assigned Target Text
                </span>
                <p className="text-sm font-semibold text-foreground leading-snug">
                  &ldquo;{targetText}&rdquo;
                </p>
              </div>

              {/* Composite Score Card */}
              {compositeScore != null && (
                <div className="p-3.5 rounded-xl border border-border/80 bg-card space-y-2 shadow-xs">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Overall Composite Score
                    </span>
                    <BandBadge score={compositeScore} size="sm" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold font-sans tabular-nums text-foreground">
                      {compositeScore.toFixed(1)}%
                    </span>
                    <span className="text-xs text-muted-foreground">
                      composite penmanship mastery
                    </span>
                  </div>
                  <BandPositionBar score={compositeScore} height="sm" />
                </div>
              )}

              {/* Criteria Feedback Breakdown */}
              {scores && bands && (
                <div className="p-3.5 rounded-xl border border-border/80 bg-muted/10 space-y-2 shadow-xs">
                  <div className="flex items-center justify-between pb-1 border-b border-border/50">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Criterion Diagnostics
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      5 criteria
                    </span>
                  </div>
                  <div className="divide-y divide-border/50">
                    {PARENT_CRITERIA.map((criterion) => (
                      <CriterionFeedbackRow
                        key={criterion.criterionKey}
                        criterionKey={criterion.criterionKey}
                        label={criterion.label}
                        score={scores[criterion.criterionKey]}
                        band={bands[criterion.criterionKey]}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-border bg-card/80 flex justify-end">
          <Button
            variant="default"
            size="sm"
            className="h-9 px-5 font-medium cursor-pointer"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
