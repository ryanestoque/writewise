"use client";

import { useState, useMemo, useCallback, type ReactNode } from "react";
import Image from "next/image";
import { useChildLatestScores } from "@/lib/hooks/use-parent-data";
import { useSubmissionImageUrl } from "@/lib/hooks/use-submissions";
import { useUnreadCommentThreads } from "@/lib/hooks/use-comments";
import type { StudentScoreHistoryItem } from "@/lib/hooks/use-dashboard";
import { BandBadge } from "@/components/shared/band-badge";
import { BandPositionBar } from "@/components/shared/band-position-bar";
import { QueryRecovery } from "@/components/shared/query-recovery";
import { WorksheetViewDialog } from "./worksheet-view-dialog";
import {
  PARENT_CRITERIA_LIST,
  getBandFromScore,
  computeStrengthAndFocus,
} from "@/lib/utils/scoring";
import {
  formatScoreDifference,
  getScoreProgressLabel,
} from "@/lib/utils/score-progress";
import type { CriterionFilter } from "@/components/shared/diagnostic-overlay";
import {
  FileText,
  Clock,
  Loader2,
  ChevronRight,
  MessageSquare,
  PenTool,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export interface LatestSubmissionCardProps {
  userId: string;
  childId: string | null;
  childName?: string;
  scoreControls?: ReactNode;
  onOpenRubric?: () => void;
  onOpenCursiveGuide?: () => void;
  hasPendingSubmission?: boolean;
  hasNoAssignedPractice?: boolean;
  history?: StudentScoreHistoryItem[];
  showScoreDetails?: boolean;
  onToggleScoreDetails?: () => void;
  onNavigateToWrite?: () => void;
}

export function LatestSubmissionCard({
  userId,
  childId,
  childName = "Your child",
  history = [],
  showScoreDetails = true,
  onToggleScoreDetails,
  onNavigateToWrite,
  onOpenRubric,
  onOpenCursiveGuide,
  hasPendingSubmission = false,
  hasNoAssignedPractice = false,
}: LatestSubmissionCardProps) {
  const [viewImageOpen, setViewImageOpen] = useState(false);
  const [initialDialogView, setInitialDialogView] = useState<"details" | "comments">("details");
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const [selectedCriterionForView, setSelectedCriterionForView] =
    useState<CriterionFilter>("all");

  const { data: latest, isLoading, isError, isFetching, refetch } = useChildLatestScores(childId);
  const { data: imageUrl, isLoading: imageLoading } = useSubmissionImageUrl(latest?.imagePath ?? null);
  const unreadComments = useUnreadCommentThreads(userId, Boolean(latest?.submissionId));
  const hasUnreadComments = Boolean(
    latest?.submissionId && unreadComments.data?.has(latest.submissionId)
  );
  const showPracticeLink = Boolean(onNavigateToWrite) && !hasNoAssignedPractice;

  const firstName = childName.trim().split(/\s+/)[0] || childName;

  const { topStrength, practiceFocus } = useMemo(() => {
    return computeStrengthAndFocus(latest?.scores, latest?.bands);
  }, [latest]);

  const trendSummary = useMemo(() => {
    if (!history || history.length < 2) return null;
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

    return {
      label: `${getScoreProgressLabel(diff, "first")} (${startDate})`,
      deltaText: formatScoreDifference(diff),
    };
  }, [history]);

  const openWorksheetForCriterion = useCallback(
    (criterion: CriterionFilter = "all", view: "details" | "comments" = "details") => {
      setSelectedCriterionForView(criterion);
      setInitialDialogView(view);
      setViewImageOpen(true);
    },
    []
  );

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
        <Loader2 className="size-6 animate-spin text-brand-600 dark:text-brand-400" aria-hidden="true" />
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
    const emptyAction = hasNoAssignedPractice ? onOpenCursiveGuide : navigateToTakeHome;
    return (
      <div className="rounded-xl border border-border bg-card shadow-warm p-6 sm:p-8 text-center space-y-4">
        <div className="flex justify-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300">
            {hasPendingSubmission ? (
              <Clock className="size-6" aria-hidden="true" />
            ) : (
              <FileText className="size-6" aria-hidden="true" />
            )}
          </div>
        </div>
        <div className="space-y-1">
          <h2 className="font-heading text-base font-semibold text-foreground">
            {hasPendingSubmission
              ? "Worksheet received · pending review"
              : "No feedback yet"}
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
            {hasPendingSubmission
              ? `${firstName}'s feedback will appear here once their teacher shares it.`
              : hasNoAssignedPractice
                ? "No practice assigned yet. Use the cursive guide to practice at home."
                : `${firstName}'s latest worksheet and feedback will appear here once shared.`}
          </p>
        </div>
        {emptyAction && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => emptyAction()}
            className="min-h-[40px] sm:min-h-[36px] text-xs sm:text-sm font-medium cursor-pointer touch-manipulation focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            {hasNoAssignedPractice ? "Open cursive guide" : "View practice worksheets"}
          </Button>
        )}
      </div>
    );
  }

  const formattedDate = new Date(latest.submissionDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const hasWritingMarks = Boolean(latest.overlay);
  const compositeBand =
    latest.bands.composite ??
    (latest.scores.composite != null ? getBandFromScore(latest.scores.composite) : null);

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
        className="overflow-hidden rounded-xl border border-border bg-card shadow-warm md:grid md:grid-cols-12"
      >
        {/* Photo first in DOM: leads on phones, sits on left column on desktop */}
        <div className="md:col-span-5 flex min-h-48 items-center justify-center bg-secondary/60 p-4 sm:p-6">
          {imageUrl && imageUrl !== failedImageUrl ? (
            <button
              type="button"
              onClick={() => openWorksheetForCriterion()}
              aria-haspopup="dialog"
              aria-label={`Inspect worksheet photo for ${latest.activityText}`}
              className="group relative h-52 w-full cursor-pointer rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring md:h-full md:min-h-64"
            >
              <Image
                src={imageUrl}
                alt={`Handwriting for ${latest.activityText}`}
                fill
                sizes="(min-width: 768px) 42vw, 100vw"
                className="object-contain transition-transform duration-200 ease-out group-hover:scale-[1.01] motion-reduce:transition-none"
                onError={() => setFailedImageUrl(imageUrl)}
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-foreground/90 px-3 py-1 text-xs font-medium text-background shadow-warm-sm transition-colors group-hover:bg-foreground dark:border dark:border-border/80 dark:bg-card/95 dark:text-foreground"
              >
                Inspect worksheet
              </span>
            </button>
          ) : (
            <span className="text-sm text-muted-foreground">
              {imageLoading && latest.imagePath
                ? "Loading worksheet photo..."
                : "Worksheet preview unavailable"}
            </span>
          )}
        </div>

        <div className="md:col-span-7 flex min-w-0 flex-col justify-center gap-5 p-5 sm:p-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <h2
                  id="latest-worksheet-heading"
                  className="font-heading text-lg sm:text-xl font-semibold tracking-tight wrap-anywhere text-foreground"
                >
                  {latest.activityText}
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground tabular-nums">
                  {formattedDate}
                  {trendSummary ? (
                    <>
                      {" · "}
                      {trendSummary.label}
                      {trendSummary.deltaText ? ` (${trendSummary.deltaText})` : ""}
                    </>
                  ) : null}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {latest.scores.composite != null && (
                  <span className="font-sans text-sm font-semibold tabular-nums text-foreground">
                    {Math.round(latest.scores.composite)}%
                  </span>
                )}
                <BandBadge band={compositeBand} score={latest.scores.composite} size="default" showDot />
              </div>
            </div>

            {latest.scores.composite != null && (
              <BandPositionBar
                score={latest.scores.composite}
                height="sm"
                showThresholds={true}
                ariaLabel={`Overall score: ${Math.round(latest.scores.composite)}%`}
                ariaValueText={`${Math.round(latest.scores.composite)}% overall`}
              />
            )}
          </div>

          <div className="rounded-xl border border-brand-200/70 dark:border-brand-800/60 bg-brand-50/60 dark:bg-brand-950/30 p-4 space-y-2.5">
            <div className="space-y-1 text-sm leading-relaxed">
              <p className="font-semibold text-primary">
                {practiceFocus
                  ? `Try together · ${practiceFocus.meta.label}`
                  : "Try together"}
              </p>
              <p className="text-foreground max-w-prose">
                {practiceFocus?.meta.homeTip ??
                  "Pick one word from this worksheet and trace it together."}
              </p>
            </div>
            {(showPracticeLink || onOpenCursiveGuide) && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                {showPracticeLink && (
                  <button
                    type="button"
                    onClick={navigateToTakeHome}
                    className="font-medium text-primary hover:underline cursor-pointer inline-flex items-center gap-1 min-h-10 sm:min-h-9 rounded-md focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring touch-manipulation"
                  >
                    <span>Practice worksheets &rarr;</span>
                  </button>
                )}
                {onOpenCursiveGuide && (
                  <button
                    type="button"
                    onClick={() => onOpenCursiveGuide()}
                    className="font-medium text-muted-foreground hover:text-foreground cursor-pointer inline-flex items-center gap-1 min-h-10 sm:min-h-9 rounded-md focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring touch-manipulation"
                  >
                    <PenTool className="size-3 text-muted-foreground" aria-hidden="true" />
                    <span>Cursive guide</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Worksheet and conversation actions */}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="default"
              size="sm"
              className="min-h-10 sm:min-h-9 h-10 sm:h-9 px-4 text-xs sm:text-sm font-semibold cursor-pointer touch-manipulation shadow-warm-sm gap-2"
              onClick={() => openWorksheetForCriterion("all", "details")}
              aria-haspopup="dialog"
            >
              <span>{hasWritingMarks ? "View worksheet & marks" : "View worksheet"}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-10 sm:min-h-9 h-10 sm:h-9 px-3 gap-2 text-xs sm:text-sm font-medium cursor-pointer touch-manipulation"
              onClick={() => openWorksheetForCriterion("all", "comments")}
              aria-haspopup="dialog"
            >
              <MessageSquare className="size-3.5 text-primary" aria-hidden="true" />
              <span>Teacher comments</span>
              {hasUnreadComments && (
                <span className="inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                  Unread
                </span>
              )}
            </Button>
          </div>
        </div>
      </section>

      <section aria-labelledby="handwriting-skills" className="overflow-hidden rounded-xl border border-border bg-card shadow-warm px-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2 py-4">
          <h2 id="handwriting-skills" className="font-heading text-lg font-semibold">Handwriting skills</h2>
        </div>
        {PARENT_CRITERIA_LIST.map(({ key, label }) => {
          const score = latest.scores[key];
          const band = latest.bands[key] ?? (score == null ? null : getBandFromScore(score));
          const isTop = topStrength?.key === key;
          const isFocus = practiceFocus?.key === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => openWorksheetForCriterion(key, "details")}
              aria-haspopup="dialog"
              className="group grid w-[calc(100%+2rem)] sm:w-[calc(100%+3rem)] -mx-4 sm:-mx-6 px-4 sm:px-6 cursor-pointer grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_7.5rem_minmax(10rem,auto)] items-center gap-3 sm:gap-4 border-t py-3.5 text-left text-sm transition-colors hover:bg-muted/40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring min-h-12"
            >
              <span className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 min-w-0">
                <span className="font-semibold text-foreground group-hover:text-primary transition-colors">{label}</span>
                {isTop && (
                  <span className="text-xs font-medium text-band-4-text">
                    Top strength
                  </span>
                )}
                {!isTop && isFocus && (
                  <span className="text-xs font-medium text-primary">
                    Practice focus
                  </span>
                )}
              </span>
              <span className="hidden sm:flex items-center">
                {score != null && (
                  <BandPositionBar
                    score={score}
                    height="sm"
                    showBandLabels={false}
                    className="w-full"
                    ariaLabel={`${label} level`}
                  />
                )}
              </span>
              <span className="flex items-center justify-end gap-2.5 shrink-0">
                {score != null && (
                  <span className="font-sans tabular-nums text-xs sm:text-sm font-semibold text-foreground min-w-[2.5rem] text-right">
                    {Math.round(score)}%
                  </span>
                )}
                <BandBadge band={band} score={score} size="sm" showDot />
                <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
              </span>
            </button>
          );
        })}
        {onOpenRubric && (
          <div className="flex items-center justify-end border-t py-2 text-sm">
            <Button
              type="button"
              variant="link"
              className="px-0 min-h-10 sm:min-h-9 text-xs sm:text-sm text-muted-foreground hover:text-foreground cursor-pointer touch-manipulation"
              onClick={onOpenRubric}
            >
              How scores work
            </Button>
          </div>
        )}
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
        initialView={initialDialogView}
        initialShowScoreDetails={showScoreDetails}
        showScoreDetails={showScoreDetails}
        onToggleScoreDetails={onToggleScoreDetails}
        scores={latest.scores}
        bands={latest.bands}
        guideLines={latest.guideLines}
        overlay={latest.overlay}
        onPracticeNow={showPracticeLink ? navigateToTakeHome : undefined}
      />
    </>
  );
}
