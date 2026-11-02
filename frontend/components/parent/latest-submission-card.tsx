"use client";

import { useState, useMemo, useCallback } from "react";
import Image from "next/image";
import { useChildLatestScores } from "@/lib/hooks/use-parent-data";
import { useSubmissionImageUrl } from "@/lib/hooks/use-submissions";
import { BandPositionBar } from "@/components/shared/band-position-bar";
import { BandBadge } from "@/components/shared/band-badge";
import { WorksheetViewDialog } from "./worksheet-view-dialog";
import { cn } from "@/lib/utils";
import {
  PARENT_CRITERIA_LIST,
  DIAGNOSTIC_NOTES,
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
  Lightbulb,
  CheckCircle2,
  ChevronRight,
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
  const [showScoreDetails, setShowScoreDetails] = useState(false);
  const [selectedCriterionForView, setSelectedCriterionForView] =
    useState<CriterionFilter>("all");
  const { data: latest, isLoading } = useChildLatestScores(childId);
  const { data: imageUrl } = useSubmissionImageUrl(latest?.imagePath ?? null);

  const openWorksheetForCriterion = useCallback((criterion: CriterionFilter = "all") => {
    setSelectedCriterionForView(criterion);
    setViewImageOpen(true);
  }, []);

  // Compute Top Strength and Primary Practice Focus based on criterion scores
  const { topStrength, practiceFocus, isBalanced } = useMemo(() => {
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
      <div className="rounded-xl border border-border bg-card shadow-warm p-8 text-center space-y-4">
        <div className="flex justify-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300">
            <FileText className="size-6" aria-hidden="true" />
          </div>
        </div>
        <div className="space-y-1">
          <h3 className="font-heading text-base font-semibold text-foreground">
            No assessment results yet
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
            Once a worksheet is uploaded and scored, {childName}&apos;s progress and diagnostic feedback will appear here.
          </p>
        </div>
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const el = document.getElementById("assigned-take-home-section");
              el?.scrollIntoView({ behavior: "smooth" });
            }}
            className="min-h-[40px] text-xs font-medium cursor-pointer"
          >
            View Assigned Take-Home Worksheets
          </Button>
        </div>
      </div>
    );
  }

  const formattedDate = new Date(latest.submissionDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const compositeBand =
    latest.scores.composite != null
      ? latest.bands.composite ?? getBandFromScore(latest.scores.composite)
      : null;
  const compositeBandMeta = compositeBand ? getBandMeta(compositeBand) : null;

  return (
    <>
      <div className="rounded-xl border border-border bg-card shadow-warm overflow-hidden transition-shadow hover:shadow-md">
        {/* Header & Overall Milestone Section */}
        <div className="p-5 sm:p-6 space-y-5 bg-card">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-base sm:text-lg font-heading font-semibold text-foreground truncate" title={latest.activityText}>
                &ldquo;{latest.activityText}&rdquo;
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {childName}&apos;s activity &bull; Assessed on {formattedDate}
              </p>
            </div>
          </div>

          {/* Worksheet Handwriting Preview Card with Uncropped Aspect Ratio */}
          {imageUrl && !imageError && (
            <button
              type="button"
              onClick={() => openWorksheetForCriterion("all")}
              aria-label={`View ${childName}'s scored worksheet with interactive guide lines`}
              aria-haspopup="dialog"
              className="group relative w-full h-48 sm:h-56 rounded-xl overflow-hidden border border-border/80 bg-muted/20 dark:bg-muted/10 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 shadow-xs block text-left transition-colors hover:border-brand-500/50 hover:shadow-warm p-2.5 sm:p-3"
            >
              <div className="relative w-full h-full rounded-lg overflow-hidden bg-background/50 shadow-inner">
                <Image
                  src={imageUrl}
                  alt={`Handwriting worksheet sample for ${latest.activityText}`}
                  fill
                  priority
                  sizes="(max-width: 768px) 100vw, 600px"
                  onError={() => setImageError(true)}
                  className="object-contain object-center transition-opacity"
                />
              </div>
              {/* Warm, legible top-right glass chip (compact on mobile) */}
              <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex items-center gap-1.5 z-10">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full bg-brand-950/85 hover:bg-brand-900 text-brand-50 backdrop-blur-md border border-brand-400/30 text-xs font-medium shadow-xs transition-colors group-hover:bg-brand-900 group-hover:border-brand-400/60">
                  <Eye className="size-3.5 text-brand-200" aria-hidden="true" />
                  <span className="hidden sm:inline">View Worksheet &amp; Feedback</span>
                  <span className="sm:hidden">Inspect Worksheet</span>
                  <ZoomIn className="size-3.5 text-brand-300 ml-0.5" aria-hidden="true" />
                </span>
              </div>
            </button>
          )}

          {/* Overall Developmental Milestone (De-escalating raw percent grade panic) */}
          <div className="space-y-3 pt-1">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-xs font-medium text-muted-foreground block">
                  Current Milestone
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  {latest.scores.composite != null && compositeBandMeta ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-lg sm:text-xl font-heading font-semibold text-foreground flex items-center gap-2">
                        <span
                          className={cn("size-2.5 rounded-full shrink-0", compositeBandMeta.dotColor)}
                          aria-hidden="true"
                        />
                        <span>{compositeBandMeta.label}</span>
                      </h4>
                      {showScoreDetails && (
                        <span className="text-xs font-semibold font-sans tabular-nums text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md border border-border/60">
                          {Math.round(latest.scores.composite)}% overall
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-lg sm:text-xl font-heading font-semibold text-muted-foreground">
                      Pending Assessment
                    </span>
                  )}
                </div>
              </div>

              {latest.scores.composite != null && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowScoreDetails((prev) => !prev)}
                    aria-pressed={showScoreDetails}
                    className="text-xs font-medium text-brand-700 dark:text-brand-300 hover:text-brand-800 dark:hover:text-brand-200 cursor-pointer focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-brand-500 rounded px-2.5 py-1 border border-brand-200/60 dark:border-brand-800/60 bg-brand-50/50 dark:bg-brand-950/30 transition-colors"
                  >
                    {showScoreDetails ? "Hide percentages" : "Show percentages"}
                  </button>
                </div>
              )}
            </div>

            <BandPositionBar
              score={latest.scores.composite}
              height="default"
              showThresholds
              ariaLabel={
                showScoreDetails && latest.scores.composite != null
                  ? `Diagnostic score position: ${Math.round(latest.scores.composite)}% overall`
                  : compositeBandMeta
                    ? `Developmental milestone: ${compositeBandMeta.label}`
                    : "Developmental milestone not yet available"
              }
            />

            {compositeBand && PARENT_BAND_EXPLANATIONS[compositeBand] && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                {PARENT_BAND_EXPLANATIONS[compositeBand]}
              </p>
            )}
          </div>

          {/* Key Insights (Top Strength & Consolidated Practice Focus with At-Home Tip) */}
          {(topStrength || practiceFocus || isBalanced) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
              {isBalanced ? (
                <div className="sm:col-span-2 flex items-start gap-3 p-3.5 rounded-lg bg-brand-50/60 dark:bg-brand-950/40 border border-brand-200/70 dark:border-brand-800/60">
                  <CheckCircle2 className="size-4 text-brand-600 dark:text-brand-400 mt-0.5 shrink-0" aria-hidden="true" />
                  <div className="min-w-0 space-y-0.5">
                    <span className="text-xs font-semibold text-brand-900 dark:text-brand-100 block">
                      All-Around Balanced Development
                    </span>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {childName} is demonstrating consistent cursive skills across all 5 criteria. Continue with steady practice to reinforce muscle memory.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {topStrength && (
                    <div className="flex flex-col justify-between gap-2 p-3.5 rounded-lg bg-band-4/15 dark:bg-band-4/25 border border-band-4/30 dark:border-band-4/40">
                      <div className="flex items-start gap-2.5">
                        <span className="size-2 rounded-full bg-band-4 mt-1 shrink-0" aria-hidden="true" />
                        <div className="min-w-0 space-y-0.5">
                          <span className="text-xs font-semibold text-band-4-text dark:text-emerald-300 block">
                            Top Strength: {topStrength.meta.label}
                          </span>
                          <p className="text-xs text-muted-foreground leading-snug">
                            {topStrength.meta.shortDescription}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {practiceFocus && (
                    <div className="flex flex-col gap-2.5 p-3.5 rounded-lg bg-band-2/15 dark:bg-band-2/25 border border-band-2/30 dark:border-band-2/40">
                      <div className="flex items-start gap-2.5">
                        <span className="size-2 rounded-full bg-band-2 mt-1 shrink-0" aria-hidden="true" />
                        <div className="min-w-0 space-y-0.5">
                          <span className="text-xs font-semibold text-band-2-text dark:text-amber-200 block">
                            Practice Focus: {practiceFocus.meta.label}
                          </span>
                          <p className="text-xs text-muted-foreground leading-snug">
                            {practiceFocus.meta.shortDescription}
                          </p>
                        </div>
                      </div>

                      {practiceFocus.meta.homeTip && (
                        <div className="pt-2 border-t border-band-2/25 flex items-start gap-2 text-band-2-text dark:text-amber-200">
                          <Lightbulb className="size-3.5 shrink-0 text-band-2 mt-0.5" aria-hidden="true" />
                          <p className="leading-relaxed">
                            <span className="font-semibold text-band-2-text dark:text-amber-200">At-Home Tip: </span>
                            {practiceFocus.meta.homeTip}
                          </p>
                        </div>
                      )}

                      {/* Action bridge linking diagnosis directly to take-home practice */}
                      <div className="pt-2 border-t border-band-2/20 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => {
                            const el = document.getElementById("assigned-take-home-section");
                            el?.scrollIntoView({ behavior: "smooth" });
                          }}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-band-2-text dark:text-amber-200 hover:text-amber-900 dark:hover:text-amber-100 hover:underline cursor-pointer group focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-brand-500 rounded py-0.5"
                        >
                          <span>Practice this skill with take-home sheets</span>
                          <ChevronRight className="size-3 text-band-2 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Action Trigger Button (if image missing or failed) */}
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
        <div className="border-t border-border/70 p-5 sm:p-6 space-y-3.5">
          <div className="flex items-center justify-between pb-1 border-b border-border/60">
            <div>
              <h4 className="text-xs sm:text-sm font-heading font-semibold text-foreground">
                5-Skill Diagnostic Breakdown
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Select any skill to inspect interactive guide lines on the worksheet photo
              </p>
            </div>
            <span className="text-xs text-muted-foreground hidden sm:inline">5-Skill Penmanship Guide</span>
          </div>

          <div className="divide-y divide-border/60 rounded-xl border border-border/70 bg-card overflow-hidden">
            {PARENT_CRITERIA_LIST.map((criterion) => {
              const isTop = topStrength?.key === criterion.key;
              const isFocus = practiceFocus?.key === criterion.key;
              const highlightBadge = isTop ? "top_strength" : isFocus ? "practice_focus" : null;
              const score = latest.scores[criterion.key];
              const band = latest.bands[criterion.key];
              const bandMeta = band ? getBandMeta(band) : null;
              const diagnosticNote = band ? DIAGNOSTIC_NOTES[criterion.key][band] : null;

              return (
                <button
                  type="button"
                  key={criterion.key}
                  onClick={() => openWorksheetForCriterion(criterion.key)}
                  aria-label={`Inspect ${criterion.label} feedback and worksheet guide lines. Rating: ${bandMeta?.label ?? "Pending"}`}
                  aria-haspopup="dialog"
                  className="w-full text-left p-3.5 sm:p-4 space-y-2 hover:bg-muted/30 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 transition-colors group cursor-pointer block"
                >
                  {/* Header Row: Title, Badges, Score, and Inspect Affordance */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      <span className="text-xs sm:text-sm font-semibold text-foreground group-hover:text-brand-700 dark:group-hover:text-brand-300 transition-colors">
                        {criterion.label}
                      </span>
                      {highlightBadge === "top_strength" && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-band-4-text dark:text-emerald-300 bg-band-4/15 dark:bg-band-4/25 px-2 py-0.5 rounded-md border border-band-4/30 dark:border-band-4/40 shrink-0">
                          <span className="size-1.5 rounded-full bg-band-4 shrink-0" aria-hidden="true" />
                          Top Strength
                        </span>
                      )}
                      {highlightBadge === "practice_focus" && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-band-2-text dark:text-amber-200 bg-band-2/15 dark:bg-band-2/25 px-2 py-0.5 rounded-md border border-band-2/30 dark:border-band-2/40 shrink-0">
                          <span className="size-1.5 rounded-full bg-band-2 shrink-0" aria-hidden="true" />
                          Practice Focus
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-2 shrink-0 text-right">
                      {showScoreDetails && score != null && (
                        <span className="font-sans text-xs font-semibold tabular-nums text-muted-foreground">
                          {Math.round(score)}%
                        </span>
                      )}
                      <BandBadge band={band} score={score} size="sm" showDot />
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors ml-1 bg-muted/40 group-hover:bg-brand-50 dark:group-hover:bg-brand-950/40 px-2 py-0.5 rounded border border-border/50 group-hover:border-brand-200/60 dark:group-hover:border-brand-800/60 shrink-0">
                        <Eye className="size-3 text-muted-foreground group-hover:text-brand-600 dark:group-hover:text-brand-400" aria-hidden="true" />
                        <span className="hidden sm:inline">Inspect</span>
                      </span>
                    </div>
                  </div>

                  {/* Direct Diagnostic Note */}
                  {diagnosticNote && (
                    <p className="text-xs text-muted-foreground leading-relaxed pr-2">
                      {diagnosticNote}
                    </p>
                  )}
                </button>
              );
            })}
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
