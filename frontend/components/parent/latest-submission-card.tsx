"use client";

import { useState, useMemo, useCallback } from "react";
import Image from "next/image";
import { useChildLatestScores } from "@/lib/hooks/use-parent-data";
import { useSubmissionImageUrl } from "@/lib/hooks/use-submissions";
import { BandPositionBar } from "@/components/shared/band-position-bar";
import { BandBadge } from "@/components/shared/band-badge";
import { ScoreSourceIndicator } from "@/components/shared/score-source-indicator";
import { CriterionFeedbackRow } from "./criterion-feedback-row";
import { WorksheetViewDialog } from "./worksheet-view-dialog";
import {
  PARENT_CRITERIA_LIST,
  getBandMeta,
  getBandFromScore,
  computeStrengthAndFocus,
} from "@/lib/utils/scoring";

const PARENT_BAND_EXPLANATIONS: Record<string, string> = {
  excellent: "Fluent, highly consistent handwriting meeting grade-level goals.",
  satisfactory: "Solid cursive foundation with minor areas to refine.",
  developing: "Actively learning and building muscle memory — a normal, key stage in cursive.",
  needs_improvement: "Working on basic letter strokes and pencil control with guided practice.",
};
import type { CriterionFilter } from "@/components/shared/diagnostic-overlay";
import {
  FileText,
  Loader2,
  Eye,
  ZoomIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface LatestSubmissionCardProps {
  childId: string | null;
  childName?: string;
}

export function LatestSubmissionCard({
  childId,
  childName = "Your child",
}: LatestSubmissionCardProps) {
  const [viewImageOpen, setViewImageOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [selectedCriterionForView, setSelectedCriterionForView] =
    useState<CriterionFilter>("all");
  const { data: latest, isLoading } = useChildLatestScores(childId);
  const { data: imageUrl } = useSubmissionImageUrl(latest?.imagePath ?? null);

  const openWorksheetForCriterion = useCallback((criterion: CriterionFilter = "all") => {
    setSelectedCriterionForView(criterion);
    setViewImageOpen(true);
  }, []);

  // Compute Top Strength and Primary Practice Focus based on criterion scores
  const { topStrength, practiceFocus } = useMemo(() => {
    return computeStrengthAndFocus(latest?.scores, latest?.bands);
  }, [latest]);

  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-xl border border-border bg-card shadow-warm p-8 flex flex-col items-center justify-center min-h-[220px] gap-2.5"
      >
        <Loader2 className="size-6 animate-spin motion-reduce:animate-none text-muted-foreground" aria-hidden="true" />
        <span className="text-xs text-muted-foreground">Loading latest assessment...</span>
      </div>
    );
  }

  if (!latest) {
    return (
      <div className="rounded-xl border border-border bg-card shadow-warm p-8 text-center space-y-3">
        <div className="flex justify-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300">
            <FileText className="size-6" aria-hidden="true" />
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
        {/* Header & Overall Score Section */}
        <div className="p-5 sm:p-6 space-y-5 bg-card">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-base sm:text-lg font-semibold text-foreground truncate" title={latest.activityText}>
                &ldquo;{latest.activityText}&rdquo;
              </h3>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <p className="text-xs text-muted-foreground">Assessed on {formattedDate}</p>
                {latest.scoreSource !== "none" && (
                  <>
                    <span className="text-muted-foreground/60 text-xs hidden sm:inline">&middot;</span>
                    <ScoreSourceIndicator source={latest.scoreSource} />
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Worksheet Handwriting Preview Card */}
          {imageUrl && !imageError && (
            <button
              type="button"
              onClick={() => openWorksheetForCriterion("all")}
              aria-label="View scored worksheet with interactive guide lines"
              aria-haspopup="dialog"
              className="group relative w-full h-44 sm:h-52 rounded-xl overflow-hidden border border-border/80 bg-muted/30 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 shadow-xs block text-left transition-all hover:border-brand-500/50 hover:shadow-warm"
            >
              <Image
                src={imageUrl}
                alt={`Handwriting worksheet sample for ${latest.activityText}`}
                fill
                priority
                sizes="(max-width: 768px) 100vw, 600px"
                onError={() => setImageError(true)}
                className="object-cover object-center group-hover:scale-[1.01] transition-transform duration-300 motion-reduce:transform-none motion-reduce:transition-none"
              />
              {/* Sleek top-right glass chip */}
              <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-10">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-950/85 hover:bg-brand-900/95 text-brand-50 backdrop-blur-md border border-brand-400/30 text-[11px] font-medium shadow-xs transition-colors group-hover:bg-brand-900/95 group-hover:border-brand-400/60">
                  <Eye className="size-3 text-brand-200" aria-hidden="true" />
                  <span>Inspect Guidelines</span>
                  <ZoomIn className="size-3 text-brand-300 ml-0.5" aria-hidden="true" />
                </span>
              </div>
            </button>
          )}

          {/* Overall Penmanship Metric */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-baseline justify-between gap-2">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                  Overall Penmanship
                </h4>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-bold font-sans tabular-nums text-foreground">
                    {latest.scores.composite != null
                      ? `${latest.scores.composite.toFixed(1)}%`
                      : "—"}
                  </span>
                </div>
              </div>
              <BandBadge score={latest.scores.composite} size="default" />
            </div>
            <BandPositionBar score={latest.scores.composite} height="default" showThresholds />
            {latest.scores.composite != null && (() => {
              const compositeBand =
                latest.bands.composite ?? getBandFromScore(latest.scores.composite);
              const bandMeta = getBandMeta(compositeBand);
              const explanation = compositeBand ? PARENT_BAND_EXPLANATIONS[compositeBand] : null;
              if (!explanation) return null;
              return (
                <p className="text-xs text-muted-foreground leading-relaxed pt-0.5">
                  <span className="font-semibold text-foreground">{bandMeta.label}:</span>{" "}
                  {explanation}
                </p>
              );
            })()}
          </div>

          {/* Consolidated Key Insights (Top Strength & Practice Focus) */}
          {(topStrength || practiceFocus) && (
            <div className="rounded-xl border border-border/70 bg-muted/20 p-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              {topStrength && (
                <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-band-4/15 dark:bg-band-4/25 border border-band-4/30 dark:border-band-4/40">
                  <span className="size-2 rounded-full bg-band-4 mt-1 shrink-0" aria-hidden="true" />
                  <div className="min-w-0 space-y-0.5">
                    <span className="text-xs font-semibold text-band-4-text dark:text-emerald-300 block">
                      Top Strength: {topStrength.meta.label}
                    </span>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      {topStrength.meta.shortDescription}
                    </p>
                  </div>
                </div>
              )}
              {practiceFocus && (
                <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-band-2/15 dark:bg-band-2/25 border border-band-2/30 dark:border-band-2/40">
                  <span className="size-2 rounded-full bg-band-2 mt-1 shrink-0" aria-hidden="true" />
                  <div className="min-w-0 space-y-0.5">
                    <span className="text-xs font-semibold text-band-2-text dark:text-amber-200 block">
                      Practice Focus: {practiceFocus.meta.label}
                    </span>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      {practiceFocus.meta.shortDescription}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Trigger Button */}
          {latest.imagePath && (!imageUrl || imageError) && (
            <div className="pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => openWorksheetForCriterion("all")}
                aria-haspopup="dialog"
                className="w-full h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] text-xs sm:text-sm font-medium gap-2 border-brand-200 dark:border-brand-900 bg-brand-50/50 dark:bg-brand-950/30 text-brand-800 dark:text-brand-200 hover:bg-brand-100/60 dark:hover:bg-brand-900/50 cursor-pointer shadow-xs"
              >
                <Eye className="size-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                <span>View Worksheet &amp; Guidelines</span>
              </Button>
            </div>
          )}
        </div>

        {/* Diagnostic Criterion Breakdown */}
        <div className="border-t border-border/60 p-5 space-y-3.5 bg-muted/10">
          {/* 5-Criterion Stacked List */}
          <div className="space-y-1">
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <div className="flex items-center gap-2">
                <h4 className="text-xs sm:text-sm font-heading font-semibold text-foreground">
                  5-Skill Diagnostic Breakdown
                </h4>
                <span className="text-[11px] text-muted-foreground font-medium hidden sm:inline">5 skills</span>
              </div>
            </div>

            <div id="criterion-breakdown-details" className="divide-y divide-border/50">
              {PARENT_CRITERIA_LIST.map((criterion) => {
                const isTop = topStrength?.key === criterion.key;
                const isFocus = practiceFocus?.key === criterion.key;
                const highlightBadge = isTop ? "top_strength" : isFocus ? "practice_focus" : null;
                const homePracticeTip = isFocus ? practiceFocus?.meta.homeTip : null;

                return (
                  <CriterionFeedbackRow
                    key={criterion.key}
                    criterionKey={criterion.key}
                    label={criterion.label}
                    score={latest.scores[criterion.key]}
                    band={latest.bands[criterion.key]}
                    onInspect={() => openWorksheetForCriterion(criterion.key as CriterionFilter)}
                    showDiagnosticNote={true}
                    showPositionBar={true}
                    highlightBadge={highlightBadge}
                    homePracticeTip={homePracticeTip}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Worksheet Photo Viewer Modal */}
      <WorksheetViewDialog
        open={viewImageOpen}
        onOpenChange={setViewImageOpen}
        submissionId={latest.submissionId}
        canDelete={latest.canDelete}
        imagePath={latest.imagePath}
        targetText={latest.activityText}
        submissionDate={latest.submissionDate}
        childName={childName}
        compositeScore={latest.scores.composite}
        scoreSource={latest.scoreSource}
        initialCriterion={selectedCriterionForView}
        scores={latest.scores}
        bands={latest.bands}
        guideLines={latest.guideLines}
        overlay={latest.overlay}
      />
    </>
  );
}
