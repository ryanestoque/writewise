"use client";

import { useState, useMemo, useCallback } from "react";
import Image from "next/image";
import { useChildLatestScores } from "@/lib/hooks/use-parent-data";
import { useSubmissionImageUrl } from "@/lib/hooks/use-submissions";
import type { StudentScoreHistoryItem } from "@/lib/hooks/use-dashboard";
import { BandPositionBar } from "@/components/shared/band-position-bar";
import { QueryRecovery } from "@/components/shared/query-recovery";
import { WorksheetViewDialog } from "./worksheet-view-dialog";
import { CriterionFeedbackRow } from "./criterion-feedback-row";
import { cn } from "@/lib/utils";
import {
  PARENT_CRITERIA_LIST,
  PARENT_BAND_EXPLANATIONS,
  getBandMeta,
  getBandFromScore,
  computeStrengthAndFocus,
} from "@/lib/utils/scoring";
import {
  formatScoreDifference,
  getScoreProgressDirection,
  getScoreProgressLabel,
} from "@/lib/utils/score-progress";
import type { CriterionFilter } from "@/components/shared/diagnostic-overlay";
import {
  FileText,
  Loader2,
  Eye,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  PenLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export interface LatestSubmissionCardProps {
  childId: string | null;
  childName?: string;
  section?: string;
  history?: StudentScoreHistoryItem[];
  showScoreDetails?: boolean;
  onToggleScoreDetails?: () => void;
  onNavigateToWrite?: () => void;
}

export function LatestSubmissionCard({
  childId,
  childName = "Your child",
  history = [],
  showScoreDetails = false,
  onNavigateToWrite,
}: LatestSubmissionCardProps) {
  const [viewImageOpen, setViewImageOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [selectedCriterionForView, setSelectedCriterionForView] =
    useState<CriterionFilter>("all");

  const { data: latest, isLoading, isError, isFetching, refetch } = useChildLatestScores(childId);
  const { data: imageUrl } = useSubmissionImageUrl(latest?.imagePath ?? null);

  const firstName = childName.trim().split(/\s+/)[0] || childName;

  const [showAllMobileSkills, setShowAllMobileSkills] = useState(false);

  const { topStrength, practiceFocus, isBalanced } = useMemo(() => {
    return computeStrengthAndFocus(latest?.scores, latest?.bands);
  }, [latest]);

  const prioritySkillKeys = useMemo(() => {
    const keys = new Set<string>();
    if (practiceFocus?.key) keys.add(practiceFocus.key);
    if (topStrength?.key) keys.add(topStrength.key);
    if (keys.size < 2) {
      for (const c of PARENT_CRITERIA_LIST) {
        keys.add(c.key);
        if (keys.size >= 2) break;
      }
    }
    return keys;
  }, [practiceFocus, topStrength]);

  const trendSummary = useMemo(() => {
    if (!history || history.length === 0) return null;
    if (history.length === 1) {
      const onlyDate = new Date(history[0].submissionDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      return {
        label: `First worksheet (${onlyDate})`,
        deltaText: null,
        tone: "neutral" as const,
      };
    }
    const oldest = history[0];
    const newest = history[history.length - 1];
    const startDate = new Date(oldest.submissionDate).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    const diff =
      newest.compositeScore != null && oldest.compositeScore != null
        ? newest.compositeScore - oldest.compositeScore
        : 0;

    const direction = getScoreProgressDirection(diff);
    return {
      label: `${getScoreProgressLabel(diff, "first")} (${startDate})`,
      deltaText: formatScoreDifference(diff),
      tone:
        direction === "improving"
          ? ("positive" as const)
          : direction === "lower"
            ? ("warm" as const)
            : ("neutral" as const),
    };
  }, [history]);

  const openWorksheetForCriterion = useCallback((criterion: CriterionFilter = "all") => {
    setSelectedCriterionForView(criterion);
    setViewImageOpen(true);
  }, []);

  const navigateToTakeHome = useCallback(() => {
    if (onNavigateToWrite) {
      onNavigateToWrite();
      return;
    }
    const el = document.getElementById("assigned-take-home-section");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  }, [onNavigateToWrite]);

  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-xl border border-border bg-card shadow-warm p-8 flex flex-col items-center justify-center min-h-[220px] gap-3"
      >
        <Loader2 className="size-6 animate-spin motion-reduce:animate-none text-brand-600 dark:text-brand-400" aria-hidden="true" />
        <span className="text-sm text-muted-foreground">Loading {firstName}&apos;s latest worksheet overview...</span>
      </div>
    );
  }

  if (!latest) {
    if (isError) {
      return (
        <QueryRecovery
          title="Couldn't load the latest worksheet"
          description="Try again to see the worksheet photo and handwriting feedback."
          onRetry={() => { void refetch(); }}
          isRetrying={isFetching}
        />
      );
    }
    return (
      <div className="rounded-xl border border-border bg-card shadow-warm p-6 sm:p-8 text-center space-y-4">
        <div className="flex justify-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300">
            <FileText className="size-6" aria-hidden="true" />
          </div>
        </div>
        <div className="space-y-1">
          <h3 className="font-heading text-base font-semibold text-foreground">
            No scored worksheet yet
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
            Once a worksheet is checked, {childName}&apos;s handwriting photo and 5-skill diagnostic feedback will appear here.
          </p>
        </div>
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={navigateToTakeHome}
            className="min-h-[40px] text-xs sm:text-sm font-medium cursor-pointer touch-manipulation focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            View Practice Worksheets
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
      {isError && (
        <QueryRecovery
          title="Latest worksheet couldn't refresh"
          description="Your saved worksheet is still shown below. Try again to check for updates."
          onRetry={() => { void refetch(); }}
          isRetrying={isFetching}
        />
      )}

      <section
        aria-labelledby="latest-worksheet-heading"
        className="rounded-xl border border-border bg-card shadow-warm overflow-hidden"
      >
        {/* 1. Practical Coaching Guidance Leads ("Practice together" & "Top strength") */}
        <div className="border-b border-border bg-secondary/40 p-4 sm:p-5 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-semibold text-brand-700 dark:text-brand-300 uppercase tracking-wider">
              Practice together
            </p>
            <h2 id="latest-worksheet-heading" className="text-lg sm:text-xl font-heading font-semibold tracking-tight text-foreground">
              {practiceFocus
                ? `Focus on ${practiceFocus.meta.label.toLowerCase()}`
                : isBalanced
                  ? "Keep building steady handwriting habits"
                  : `${firstName}'s next step`}
            </h2>
            <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed">
              {practiceFocus
                ? practiceFocus.meta.homeTip
                : "Keep practice brief and relaxed. Use the latest worksheet below to see which habits to practise together."}
            </p>
          </div>
          {topStrength ? (
            <div className="flex items-start gap-2 border-t border-border/70 pt-3">
              <CheckCircle2 className="size-4 shrink-0 text-primary mt-0.5" aria-hidden="true" />
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">A strength to build on: {topStrength.meta.label.toLowerCase()}.</span>{" "}
                {topStrength.meta.shortDescription}.
              </p>
            </div>
          ) : isBalanced ? (
            <div className="flex items-start gap-2 border-t border-border/70 pt-3">
              <CheckCircle2 className="size-4 shrink-0 text-primary mt-0.5" aria-hidden="true" />
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">Steady, balanced development:</span>{" "}
                {firstName}&apos;s handwriting shows consistent quality across all 5 skills with no single deficit.
              </p>
            </div>
          ) : null}

          <div className="pt-1 flex flex-wrap items-center gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={navigateToTakeHome}
              className="h-10 min-h-[40px] px-3.5 text-xs sm:text-sm font-semibold gap-1.5 cursor-pointer shadow-2xs touch-manipulation border-brand-300 dark:border-brand-700 bg-brand-50/80 dark:bg-brand-950/40 text-brand-800 dark:text-brand-200 hover:bg-brand-100 dark:hover:bg-brand-900/60 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <PenLine className="size-3.5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
              <span>{practiceFocus ? `Practice ${practiceFocus.meta.label.toLowerCase()} now` : "Open practice worksheets"}</span>
            </Button>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              Opens assigned take-home practice
            </span>
          </div>
        </div>

        {/* 2. Latest Scored Assessment Summary & Thumbnail */}
        <div className="p-4 sm:p-5 space-y-4 bg-card">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-muted-foreground font-sans tabular-nums">
                  Latest assessment · {formattedDate}
                </span>
                {trendSummary && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border",
                      trendSummary.tone === "positive" &&
                        "bg-band-4/15 dark:bg-band-4/25 text-band-4-text border-band-4/30 dark:border-band-4/40",
                      trendSummary.tone === "warm" &&
                        "bg-band-2/15 dark:bg-band-2/25 text-band-2-text border-band-2/30 dark:border-band-2/40",
                      trendSummary.tone === "neutral" &&
                        "bg-muted/60 text-foreground/90 border-border/70"
                    )}
                  >
                    {trendSummary.tone === "positive" ? (
                      <TrendingUp className="size-3.5 shrink-0 text-band-4-text" aria-hidden="true" />
                    ) : trendSummary.tone === "warm" ? (
                      <TrendingDown className="size-3.5 shrink-0 text-band-2-text" aria-hidden="true" />
                    ) : (
                      <Minus className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    )}
                    <span>{trendSummary.label}</span>
                    {showScoreDetails && trendSummary.deltaText && (
                      <span className="font-sans tabular-nums font-semibold">({trendSummary.deltaText})</span>
                    )}
                  </span>
                )}
              </div>

              <div className="pt-0.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                  Assigned writing prompt
                </span>
                <h3 className="text-base sm:text-lg font-heading font-semibold text-foreground truncate" title={latest.activityText}>
                  &ldquo;{latest.activityText}&rdquo;
                </h3>
              </div>
            </div>

              {/* Fallback inspect button if image thumbnail fails to load */}
              {latest.imagePath && (!imageUrl || imageError) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openWorksheetForCriterion("all")}
                  aria-haspopup="dialog"
                  className="h-10 min-h-[40px] sm:h-9 sm:min-h-[36px] gap-1.5 shrink-0 cursor-pointer shadow-2xs w-full sm:w-auto"
                >
                  <Eye className="size-3.5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                  <span>Inspect Full Worksheet</span>
                </Button>
              )}
            </div>

            {/* Overall Composite Level & Bar */}
            <div className="space-y-2 rounded-xl bg-muted/30 dark:bg-muted/15 p-3.5 sm:p-4 border border-border/70">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  {latest.scores.composite != null && compositeBandMeta ? (
                    <>
                      <span className="text-sm font-semibold text-foreground inline-flex items-center gap-2">
                        <span
                          className={cn("size-2.5 rounded-full shrink-0", compositeBandMeta.dotColor)}
                          aria-hidden="true"
                        />
                        <span>Overall: {compositeBandMeta.label}</span>
                      </span>
                      {showScoreDetails && (
                        <span className="text-xs font-semibold font-sans tabular-nums text-foreground/80 bg-muted/60 px-2 py-0.5 rounded-md border border-border/60">
                          {Math.round(latest.scores.composite)}%
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-sm font-medium text-muted-foreground">
                      Awaiting teacher review
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground font-sans tabular-nums">
                  5 Cursive Skills Evaluated
                </span>
              </div>

              <BandPositionBar
                score={latest.scores.composite}
                height="default"
                showThresholds={showScoreDetails}
                ariaLabel={
                  showScoreDetails && latest.scores.composite != null
                    ? `Overall handwriting score: ${Math.round(latest.scores.composite)}%`
                    : compositeBandMeta
                      ? `Overall handwriting level: ${compositeBandMeta.label}`
                      : "Overall handwriting level not yet available"
                }
                ariaValueText={
                  showScoreDetails && latest.scores.composite != null
                    ? `${Math.round(latest.scores.composite)}% overall`
                    : compositeBandMeta
                      ? compositeBandMeta.label
                      : undefined
                }
              />

              {compositeBand && PARENT_BAND_EXPLANATIONS[compositeBand] && (
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed pt-0.5">
                  {PARENT_BAND_EXPLANATIONS[compositeBand]}
                </p>
              )}
            </div>

            {/* Clickable Worksheet Thumbnail */}
            {imageUrl && !imageError && (
              <button
                type="button"
                onClick={() => openWorksheetForCriterion("all")}
                aria-label={`Inspect ${childName}'s full worksheet with writing lines, slant, and spacing feedback`}
                aria-haspopup="dialog"
                className="group relative w-full h-48 sm:h-56 rounded-xl overflow-hidden border border-border/80 bg-muted/20 dark:bg-muted/10 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 block text-left transition-all hover:border-brand-500/60 p-2 touch-manipulation shadow-2xs hover:shadow-warm"
              >
                <div className="relative w-full h-full rounded-lg overflow-hidden bg-background/50">
                  <Image
                    src={imageUrl}
                    alt={`Handwriting worksheet sample for ${latest.activityText}`}
                    fill
                    sizes="(max-width: 768px) 100vw, 800px"
                    onError={() => setImageError(true)}
                    className="object-contain object-center transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-background/95 via-background/60 to-transparent p-3 pt-8 flex items-center justify-between gap-2 pointer-events-none">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground bg-card/95 backdrop-blur-xs px-3 py-1.5 rounded-lg border border-border/80 shadow-xs">
                      <Eye className="size-3.5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                      <span>Inspect Full Worksheet (Lines &amp; Feedback)</span>
                    </span>
                    <span className="text-xs text-muted-foreground hidden sm:inline font-medium">
                      Tap to view overlays
                    </span>
                  </div>
                </div>
              </button>
            )}
          </div>

          {/* 3. 5-Skill Criteria Breakdown with Diagnostic Sentences (Hybrid View) */}
          <div className="border-t border-border/70">
            <div className="px-4 py-3 sm:px-5 bg-muted/30 border-b border-border/60 flex items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-heading font-semibold text-foreground">
                  5 Handwriting Skills Breakdown
                </h4>
                <p className="text-xs text-muted-foreground">
                  Plain-language diagnostic feedback for each penmanship criterion
                </p>
              </div>
              <span className="text-xs text-muted-foreground hidden sm:inline font-sans tabular-nums">
                Tap any skill to inspect strokes
              </span>
            </div>

            <div id="mobile-criteria-list" className="divide-y divide-border/60">
              {PARENT_CRITERIA_LIST.map((criterion) => {
                const score = latest.scores[criterion.key];
                const band = latest.bands[criterion.key];
                const isTop = topStrength?.key === criterion.key;
                const isFocus = practiceFocus?.key === criterion.key;
                const isPriority = prioritySkillKeys.has(criterion.key);
                const highlightBadge = isTop
                  ? "top_strength"
                  : isFocus
                    ? "practice_focus"
                    : null;

                return (
                  <div
                    key={criterion.key}
                    className={cn(
                      !isPriority && !showAllMobileSkills && "hidden sm:block"
                    )}
                  >
                    <CriterionFeedbackRow
                      criterionKey={criterion.key}
                      label={criterion.label}
                      score={score}
                      band={band}
                      showScoreDetails={showScoreDetails}
                      showDiagnosticNote={true}
                      highlightBadge={highlightBadge}
                      inspectLabel="Inspect strokes"
                      onInspect={() => openWorksheetForCriterion(criterion.key)}
                    />
                  </div>
                );
              })}
            </div>

            {/* Mobile progressive disclosure toggle for non-priority skills */}
            <div className="sm:hidden p-2.5 bg-muted/15 border-t border-border/60 text-center">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowAllMobileSkills((prev) => !prev)}
                aria-expanded={showAllMobileSkills}
                aria-controls="mobile-criteria-list"
                className="w-full min-h-[44px] text-xs font-semibold text-brand-700 dark:text-brand-300 hover:text-brand-800 dark:hover:text-brand-200 hover:bg-brand-50/60 dark:hover:bg-brand-950/40 gap-1.5 cursor-pointer touch-manipulation justify-center"
              >
                <span>
                  {showAllMobileSkills
                    ? "Show priority skills only"
                    : `View all 5 skills breakdown (+${5 - prioritySkillKeys.size})`}
                </span>
                {showAllMobileSkills ? (
                  <ChevronUp className="size-4 shrink-0" aria-hidden="true" />
                ) : (
                  <ChevronDown className="size-4 shrink-0" aria-hidden="true" />
                )}
              </Button>
            </div>
          </div>
      </section>

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
        initialShowScoreDetails={showScoreDetails}
        scores={latest.scores}
        bands={latest.bands}
        guideLines={latest.guideLines}
        overlay={latest.overlay}
        onPracticeNow={navigateToTakeHome}
      />
    </>
  );
}

/**
 * Backwards compatibility alias for ParentStatusHero.
 * Streamlined to render the consolidated LatestSubmissionCard directly.
 */
export function ParentStatusHero(props: LatestSubmissionCardProps) {
  return <LatestSubmissionCard {...props} />;
}
