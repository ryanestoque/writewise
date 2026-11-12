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
  const [selectedCriterionForView, setSelectedCriterionForView] = useState<CriterionFilter>("all");

  const { data: latest, isLoading, isError, isFetching, refetch } = useChildLatestScores(childId);
  const { data: imageUrl } = useSubmissionImageUrl(latest?.imagePath ?? null);

  const firstName = childName.trim().split(/\s+/)[0] || childName;

  const { topStrength, practiceFocus, isBalanced } = useMemo(() => {
    return computeStrengthAndFocus(latest?.scores, latest?.bands);
  }, [latest]);

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
        className="border-border bg-card shadow-warm flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-xl border p-8"
      >
        <Loader2
          className="text-brand-600 dark:text-brand-400 size-6 animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
        <span className="text-muted-foreground text-sm">
          Loading {firstName}&apos;s latest worksheet overview...
        </span>
      </div>
    );
  }

  if (!latest) {
    if (isError) {
      return (
        <QueryRecovery
          title="Couldn't load the latest worksheet"
          description="Try again to see the worksheet photo and handwriting feedback."
          onRetry={() => {
            void refetch();
          }}
          isRetrying={isFetching}
        />
      );
    }
    return (
      <div className="border-border bg-card shadow-warm space-y-4 rounded-xl border p-6 text-center sm:p-8">
        <div className="flex justify-center">
          <div className="bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 flex size-12 items-center justify-center rounded-2xl">
            <FileText className="size-6" aria-hidden="true" />
          </div>
        </div>
        <div className="space-y-1">
          <h3 className="font-heading text-foreground text-base font-semibold">
            No scored worksheet yet
          </h3>
          <p className="text-muted-foreground mx-auto max-w-sm text-sm leading-relaxed">
            Once a worksheet is checked, {childName}&apos;s handwriting photo and 5-skill diagnostic
            feedback will appear here.
          </p>
        </div>
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={navigateToTakeHome}
            className="focus-visible:ring-brand-500 min-h-[40px] cursor-pointer touch-manipulation text-xs font-medium focus-visible:ring-2 focus-visible:outline-hidden sm:text-sm"
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
      ? (latest.bands.composite ?? getBandFromScore(latest.scores.composite))
      : null;
  const compositeBandMeta = compositeBand ? getBandMeta(compositeBand) : null;

  return (
    <>
      {isError && (
        <QueryRecovery
          title="Latest worksheet couldn't refresh"
          description="Your saved worksheet is still shown below. Try again to check for updates."
          onRetry={() => {
            void refetch();
          }}
          isRetrying={isFetching}
        />
      )}

      <section
        aria-labelledby="latest-worksheet-heading"
        className="border-border bg-card overflow-hidden rounded-xl border"
      >
        <div className="border-border flex flex-col gap-4 border-b p-4 min-[1100px]:flex-row min-[1100px]:items-center min-[1100px]:justify-between sm:p-5">
          <div className="flex max-w-prose min-w-0 flex-col gap-1.5">
            <h2
              id="latest-worksheet-heading"
              className="font-heading text-foreground text-lg font-semibold sm:text-xl"
            >
              {practiceFocus
                ? `Focus on ${practiceFocus.meta.label.toLowerCase()}`
                : isBalanced
                  ? "Keep building steady handwriting habits"
                  : `${firstName}'s next step`}
            </h2>
            <p className="text-foreground text-sm leading-relaxed">
              {practiceFocus
                ? practiceFocus.meta.homeTip
                : "Keep practice brief and relaxed. Try another worksheet together."}
            </p>
            {topStrength && (
              <p className="text-muted-foreground flex items-start gap-1.5 text-sm">
                <CheckCircle2 className="text-primary mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>Strength: {topStrength.meta.label.toLowerCase()}.</span>
              </p>
            )}
          </div>
          <Button
            type="button"
            size="sm"
            onClick={navigateToTakeHome}
            className="min-h-11 w-full self-start sm:w-auto"
          >
            <PenLine data-icon="inline-start" aria-hidden="true" />
            View practice worksheets
          </Button>
        </div>

        <div className="grid min-[1100px]:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="flex min-w-0 flex-col gap-4 p-4 sm:p-5">
            <div className="flex flex-col gap-1">
              <h3 className="font-heading text-foreground text-base font-semibold">
                Latest worksheet
              </h3>
              <p className="text-foreground text-sm [overflow-wrap:anywhere] break-words">
                &ldquo;{latest.activityText}&rdquo;
              </p>
              <p className="text-muted-foreground font-sans text-xs tabular-nums">
                {formattedDate}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {latest.scores.composite != null && compositeBandMeta ? (
                  <>
                    <span className="text-foreground inline-flex items-center gap-2 text-sm font-semibold">
                      <span
                        className={cn("size-2 shrink-0 rounded-full", compositeBandMeta.dotColor)}
                        aria-hidden="true"
                      />
                      Overall: {compositeBandMeta.label}
                    </span>
                    {showScoreDetails && (
                      <span className="text-muted-foreground font-sans text-sm tabular-nums">
                        {Math.round(latest.scores.composite)}%
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-muted-foreground text-sm">Awaiting teacher review</span>
                )}
              </div>
              <BandPositionBar
                score={latest.scores.composite}
                height="sm"
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
                    : compositeBandMeta?.label
                }
              />
              {trendSummary && (
                <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
                  {trendSummary.tone === "positive" ? (
                    <TrendingUp
                      className="text-band-4-text mt-0.5 size-3.5 shrink-0"
                      aria-hidden="true"
                    />
                  ) : trendSummary.tone === "warm" ? (
                    <TrendingDown
                      className="text-band-2-text mt-0.5 size-3.5 shrink-0"
                      aria-hidden="true"
                    />
                  ) : (
                    <Minus className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  )}
                  <span>
                    {trendSummary.label}
                    {showScoreDetails && trendSummary.deltaText && (
                      <span className="font-sans tabular-nums"> ({trendSummary.deltaText})</span>
                    )}
                  </span>
                </p>
              )}
            </div>

            {imageUrl && !imageError ? (
              <button
                type="button"
                onClick={() => openWorksheetForCriterion("all")}
                aria-label={`View worksheet for ${childName} with writing lines, slant, and spacing feedback`}
                aria-haspopup="dialog"
                className="group focus-visible:ring-ring flex cursor-pointer flex-col gap-2 rounded-lg text-left focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
              >
                <span className="bg-muted/30 relative block h-36 w-full overflow-hidden rounded-lg min-[1100px]:h-56 sm:h-48">
                  <Image
                    src={imageUrl}
                    alt={`Handwriting worksheet sample for ${latest.activityText}`}
                    fill
                    sizes="(min-width: 1100px) 40vw, 100vw"
                    onError={() => setImageError(true)}
                    className="object-contain object-center"
                  />
                </span>
                <span className="text-primary inline-flex min-h-11 items-center gap-1.5 text-sm font-medium group-hover:underline">
                  <Eye className="size-4" aria-hidden="true" />
                  View worksheet
                </span>
              </button>
            ) : latest.imagePath ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => openWorksheetForCriterion("all")}
                aria-haspopup="dialog"
                className="min-h-11 w-full sm:w-auto sm:self-start"
              >
                <Eye data-icon="inline-start" aria-hidden="true" />
                View worksheet
              </Button>
            ) : null}
          </div>

          <div className="border-border min-w-0 border-t p-4 min-[1100px]:border-t-0 min-[1100px]:border-l sm:p-5">
            <div className="flex flex-col gap-1 pb-3">
              <h3 className="font-heading text-foreground text-base font-semibold">
                Handwriting skills
              </h3>
              <p className="text-muted-foreground text-xs">
                Select a skill to see it on the worksheet.
              </p>
            </div>
            <div className="divide-border/60 divide-y">
              {PARENT_CRITERIA_LIST.map((criterion) => (
                <CriterionFeedbackRow
                  key={criterion.key}
                  criterionKey={criterion.key}
                  label={criterion.label}
                  score={latest.scores[criterion.key]}
                  band={latest.bands[criterion.key]}
                  showScoreDetails={showScoreDetails}
                  concise
                  inspectOpensDialog
                  onInspect={() => openWorksheetForCriterion(criterion.key)}
                />
              ))}
            </div>
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
