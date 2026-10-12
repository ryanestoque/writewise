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
  const [expandedCriteria, setExpandedCriteria] = useState<Record<string, boolean>>({});
  const [imageError, setImageError] = useState(false);
  const [selectedCriterionForView, setSelectedCriterionForView] =
    useState<CriterionFilter>("all");
  const { data: latest, isLoading } = useChildLatestScores(childId);
  const { data: imageUrl } = useSubmissionImageUrl(latest?.imagePath ?? null);

  const openWorksheetForCriterion = useCallback((criterion: CriterionFilter = "all") => {
    setSelectedCriterionForView(criterion);
    setViewImageOpen(true);
  }, []);

  const allNotesExpanded = useMemo(() => {
    return PARENT_CRITERIA_LIST.every((c) => !!expandedCriteria[c.key]);
  }, [expandedCriteria]);

  const toggleAllDiagnosticNotes = useCallback(() => {
    if (allNotesExpanded) {
      setExpandedCriteria({});
    } else {
      const next: Record<string, boolean> = {};
      PARENT_CRITERIA_LIST.forEach((c) => {
        next[c.key] = true;
      });
      setExpandedCriteria(next);
    }
  }, [allNotesExpanded]);

  const toggleCriterionNote = useCallback((key: CriterionKey) => {
    setExpandedCriteria((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  // Compute Top Strength and Primary Practice Focus based on criterion scores
  const { topStrength, practiceFocus } = useMemo(() => {
    if (!latest?.scores) return { topStrength: null, practiceFocus: null };

    const validCriteria = PARENT_CRITERIA_LIST.map((c) => {
      const score = latest.scores[c.key];
      const band = latest.bands[c.key];
      return {
        key: c.key as CriterionKey,
        score,
        band,
        meta: c,
      };
    }).filter((c) => c.score != null);

    if (validCriteria.length === 0) {
      return { topStrength: null, practiceFocus: null };
    }

    // Sort descending by score
    const sorted = [...validCriteria].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const top = sorted[0];
    const focus = sorted[sorted.length - 1];

    return {
      topStrength: top,
      practiceFocus: focus.key !== top.key ? focus : null,
    };
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
        <div className="p-5 space-y-4 bg-card">
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

          {/* Worksheet Handwriting Preview Card */}
          {imageUrl && !imageError && (
            <button
              type="button"
              onClick={() => openWorksheetForCriterion("all")}
              aria-label="View scored worksheet with guide lines"
              aria-haspopup="dialog"
              className="group relative w-full h-32 sm:h-36 rounded-xl overflow-hidden border border-border/70 bg-muted/30 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 shadow-xs block text-left"
            >
              <Image
                src={imageUrl}
                alt={`Handwriting worksheet sample for ${latest.activityText}`}
                fill
                priority
                sizes="(max-width: 768px) 100vw, 400px"
                onError={() => setImageError(true)}
                className="object-cover object-center group-hover:scale-[1.02] transition-transform duration-300 motion-reduce:transform-none motion-reduce:transition-none"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent flex items-end justify-between p-3">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/50 backdrop-blur-sm border border-white/20 text-xs font-medium text-white shadow-xs">
                  <Eye className="size-3.5 text-white/90" aria-hidden="true" />
                  <span>View Worksheet &amp; Guidelines</span>
                </span>
                <span className="inline-flex items-center justify-center size-8 sm:size-9 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 text-white group-hover:bg-brand-600 group-hover:border-brand-500 transition-all shadow-xs">
                  <ZoomIn className="size-4 sm:size-4.5" aria-hidden="true" />
                </span>
              </div>
            </button>
          )}

          {/* Overall Penmanship Metric */}
          <div className="space-y-2.5 pt-0.5">
            <div className="flex items-baseline justify-between gap-2">
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground block mb-1">
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
                <p className="text-xs text-muted-foreground leading-normal pt-0.5">
                  <span className="font-semibold text-foreground">{bandMeta.label}:</span>{" "}
                  {explanation}
                </p>
              );
            })()}
          </div>

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
                className="h-7 px-2.5 inline-flex items-center rounded-lg border border-border/70 hover:border-border bg-card/60 hover:bg-muted/60 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer shadow-2xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                {allNotesExpanded ? "Hide All Notes" : "Show All Notes"}
              </button>
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
                    showDiagnosticNote={!!expandedCriteria[criterion.key]}
                    onToggleDiagnosticNote={() => toggleCriterionNote(criterion.key as CriterionKey)}
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
