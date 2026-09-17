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
  DIAGNOSTIC_NOTES,
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
  Award,
  Target,
  ZoomIn,
  ArrowRight,
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
          {imageUrl && (
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
                sizes="(max-width: 768px) 100vw, 400px"
                className="object-cover object-center group-hover:scale-[1.02] transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent flex items-end justify-between p-3">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/50 backdrop-blur-sm border border-white/20 text-xs font-medium text-white shadow-xs">
                  <Eye className="size-3.5 text-white/90" aria-hidden="true" />
                  <span>View Worksheet &amp; Guidelines</span>
                </span>
                <span className="inline-flex items-center justify-center size-7 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 text-white group-hover:bg-brand-600 group-hover:border-brand-500 transition-all shadow-xs">
                  <ZoomIn className="size-4" aria-hidden="true" />
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
            <BandPositionBar score={latest.scores.composite} height="default" />
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
          {latest.imagePath && !imageUrl && (
            <div className="pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => openWorksheetForCriterion("all")}
                aria-haspopup="dialog"
                className="w-full h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] text-xs sm:text-sm font-medium gap-2 border-brand-200 dark:border-brand-900 bg-brand-50/50 dark:bg-brand-950/30 text-brand-800 dark:text-brand-200 hover:bg-brand-100/60 dark:hover:bg-brand-900/50 cursor-pointer shadow-xs"
              >
                <Eye className="size-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                <span>View Worksheet Photo &amp; Guide Lines</span>
              </Button>
            </div>
          )}
        </div>

        {/* Diagnostic Criterion Breakdown (DESIGN §7.6: Always visible, no accordion) */}
        <div className="border-t border-border/60 p-5 space-y-4 bg-muted/10">
          {/* Highlights: Top Strength & Practice Focus */}
          {(topStrength || practiceFocus) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-stretch">
              {/* Top Strength Card */}
              {topStrength && (
                <button
                  type="button"
                  onClick={() => openWorksheetForCriterion(topStrength.key as CriterionFilter)}
                  aria-label={`Top strength: ${topStrength.meta.label}${topStrength.band ? `, rated ${topStrength.band.replace('_', ' ')}` : ""}. Click to inspect guidelines on worksheet.`}
                  aria-haspopup="dialog"
                  className="group w-full h-full text-left rounded-xl border border-border/80 bg-card hover:bg-muted/40 hover:border-brand-400/60 dark:hover:border-brand-700/60 p-3.5 sm:p-4 flex flex-col justify-between gap-2.5 transition-all cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 shadow-2xs"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex size-6 items-center justify-center rounded-md bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 shrink-0">
                          <Award className="size-3.5" aria-hidden="true" />
                        </div>
                        <span className="text-xs font-semibold text-foreground truncate">
                          Top Strength: {topStrength.meta.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <BandBadge band={topStrength.band} score={topStrength.score} size="sm" />
                        <ArrowRight className="size-3.5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                      {topStrength.band
                        ? DIAGNOSTIC_NOTES[topStrength.key][topStrength.band]
                        : topStrength.meta.shortDescription}
                    </p>
                  </div>
                  <div className="pt-2 flex items-center justify-between text-xs border-t border-border/40">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 dark:text-brand-300 group-hover:underline">
                      <Eye className="size-3.5" aria-hidden="true" />
                      <span>See on worksheet guidelines</span>
                    </span>
                    <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                      Click to inspect
                    </span>
                  </div>
                </button>
              )}

              {/* Practice Focus Card */}
              {practiceFocus && (
                <button
                  type="button"
                  onClick={() => openWorksheetForCriterion(practiceFocus.key as CriterionFilter)}
                  aria-label={`Practice focus: ${practiceFocus.meta.label}${practiceFocus.band ? `, rated ${practiceFocus.band.replace('_', ' ')}` : ""}. Home tip: ${practiceFocus.meta.homeTip}. Click to inspect on worksheet guidelines dialog.`}
                  aria-haspopup="dialog"
                  className="group w-full h-full text-left rounded-xl border border-border/80 bg-card hover:bg-muted/40 hover:border-warning/60 dark:hover:border-warning/50 p-3.5 sm:p-4 flex flex-col justify-between gap-2.5 transition-all cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-600 dark:focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-card shadow-2xs"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex size-6 items-center justify-center rounded-md bg-warning/15 dark:bg-warning/25 text-warning-foreground shrink-0">
                          <Target className="size-3.5" aria-hidden="true" />
                        </div>
                        <span className="text-xs font-semibold text-foreground truncate">
                          Practice Focus: {practiceFocus.meta.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <BandBadge band={practiceFocus.band} score={practiceFocus.score} size="sm" />
                        <ArrowRight className="size-3.5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
                      </div>
                    </div>
                    <p
                      className="text-xs text-muted-foreground leading-relaxed line-clamp-2"
                      title={practiceFocus.meta.homeTip}
                    >
                      <strong className="font-semibold text-foreground">
                        Home practice tip:
                      </strong>{" "}
                      {practiceFocus.meta.homeTip}
                    </p>
                  </div>
                  <div className="pt-2 flex items-center justify-between text-xs border-t border-border/40">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-warning-foreground group-hover:underline">
                      <Eye className="size-3.5" aria-hidden="true" />
                      <span>See on worksheet guidelines</span>
                    </span>
                    <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                      Click to inspect
                    </span>
                  </div>
                </button>
              )}
            </div>
          )}

          {/* 5-Criterion Stacked List */}
          <div className="space-y-1 pt-1">
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <h4 className="text-xs sm:text-sm font-heading font-semibold text-foreground">
                5-Skill Diagnostic Breakdown
              </h4>
              <span className="text-xs text-muted-foreground font-medium">5 skills assessed</span>
            </div>

            <div id="criterion-breakdown-details" className="divide-y divide-border/50">
              {PARENT_CRITERIA_LIST.map((criterion) => (
                <CriterionFeedbackRow
                  key={criterion.key}
                  criterionKey={criterion.key}
                  label={criterion.label}
                  score={latest.scores[criterion.key]}
                  band={latest.bands[criterion.key]}
                  onInspect={() => openWorksheetForCriterion(criterion.key as CriterionFilter)}
                  showDiagnosticNote={true}
                />
              ))}
            </div>
          </div>
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
        initialCriterion={selectedCriterionForView}
        scores={latest.scores}
        bands={latest.bands}
        guideLines={latest.guideLines}
        overlay={latest.overlay}
      />
    </>
  );
}
