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
  type CriterionKey,
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
  const [userExpandedOverrides, setUserExpandedOverrides] = useState<Record<string, boolean>>({});
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

  const isCriterionExpanded = useCallback(
    (key: string, isFocus: boolean) => {
      if (userExpandedOverrides[key] !== undefined) {
        return userExpandedOverrides[key];
      }
      return isFocus;
    },
    [userExpandedOverrides]
  );

  const allNotesExpanded = useMemo(() => {
    return PARENT_CRITERIA_LIST.every((c) =>
      isCriterionExpanded(c.key, practiceFocus?.key === c.key)
    );
  }, [isCriterionExpanded, practiceFocus?.key]);

  const toggleAllDiagnosticNotes = useCallback(() => {
    const nextState = !allNotesExpanded;
    const next: Record<string, boolean> = {};
    PARENT_CRITERIA_LIST.forEach((c) => {
      next[c.key] = nextState;
    });
    setUserExpandedOverrides(next);
  }, [allNotesExpanded]);

  const toggleCriterionNote = useCallback(
    (key: CriterionKey, currentlyExpanded: boolean) => {
      setUserExpandedOverrides((prev) => ({
        ...prev,
        [key]: !currentlyExpanded,
      }));
    },
    []
  );

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
              <p className="text-xs text-muted-foreground/80 mt-0.5">Assessed on {formattedDate}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {latest.scoreSource !== "none" && (
                <ScoreSourceIndicator source={latest.scoreSource} compact />
              )}
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
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-900/80 hover:bg-neutral-900/95 text-white backdrop-blur-md border border-white/25 text-[11px] font-medium shadow-xs transition-colors group-hover:bg-brand-700/95 group-hover:border-brand-400/60">
                  <Eye className="size-3 text-white/90" aria-hidden="true" />
                  <span>Inspect Guidelines</span>
                  <ZoomIn className="size-3 text-white/75 ml-0.5" aria-hidden="true" />
                </span>
              </div>
              {/* Bottom guidance strip for clear click affordance */}
              <div className="absolute inset-x-0 bottom-0 py-1.5 px-3 bg-gradient-to-t from-black/70 via-black/35 to-transparent flex items-center justify-between text-[11px] text-white/95 font-medium pointer-events-none transition-opacity">
                <span className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-brand-400" aria-hidden="true" />
                  Inspect 5-skill geometric overlays
                </span>
                <span className="text-[10px] text-white/80 hidden sm:inline">Diagnostic Guidelines</span>
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
                <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-850/60">
                  <span className="size-2 rounded-full bg-emerald-600 dark:bg-emerald-400 mt-1 shrink-0" aria-hidden="true" />
                  <div className="min-w-0 space-y-0.5">
                    <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 block">
                      Top Strength: {topStrength.meta.label}
                    </span>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      {topStrength.meta.shortDescription}
                    </p>
                  </div>
                </div>
              )}
              {practiceFocus && (
                <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-850/60">
                  <span className="size-2 rounded-full bg-amber-600 dark:bg-amber-400 mt-1 shrink-0" aria-hidden="true" />
                  <div className="min-w-0 space-y-0.5">
                    <span className="text-xs font-semibold text-amber-900 dark:text-amber-200 block">
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
              <button
                type="button"
                onClick={toggleAllDiagnosticNotes}
                aria-expanded={allNotesExpanded}
                aria-controls="criterion-breakdown-details"
                className="h-9 sm:h-7 min-h-[36px] sm:min-h-[28px] px-2.5 inline-flex items-center rounded-lg border border-border/80 hover:border-brand-500/50 bg-card hover:bg-brand-50/60 dark:hover:bg-brand-950/40 text-xs font-medium text-brand-700 dark:text-brand-300 hover:text-brand-800 dark:hover:text-brand-200 transition-colors cursor-pointer shadow-2xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                {allNotesExpanded ? "Collapse All Notes" : "Expand All Notes"}
              </button>
            </div>

            <div id="criterion-breakdown-details" className="divide-y divide-border/50">
              {PARENT_CRITERIA_LIST.map((criterion) => {
                const isTop = topStrength?.key === criterion.key;
                const isFocus = practiceFocus?.key === criterion.key;
                const isExpanded = isCriterionExpanded(criterion.key, isFocus);
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
                    showDiagnosticNote={isExpanded}
                    onToggleDiagnosticNote={() => toggleCriterionNote(criterion.key as CriterionKey, isExpanded)}
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
