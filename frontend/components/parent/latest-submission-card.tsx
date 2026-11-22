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
  PARENT_BAND_EXPLANATIONS,
  DIAGNOSTIC_NOTES,
  getBandFromScore,
  getBandMeta,
  computeStrengthAndFocus,
} from "@/lib/utils/scoring";
import {
  formatScoreDifference,
  getScoreProgressLabel,
  getScoreProgressSupportNote,
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
  showScoreDetails = false,
  onToggleScoreDetails,
  onNavigateToWrite,
  onOpenRubric,
  onOpenCursiveGuide,
  hasPendingSubmission = false,
  hasNoAssignedPractice = false,
  scoreControls,
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
        supportNote: null,
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

    return {
      label: `${getScoreProgressLabel(diff, "first")} (${startDate})`,
      deltaText: formatScoreDifference(diff),
      supportNote: getScoreProgressSupportNote(diff),
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
          <h3 className="font-heading text-base font-semibold text-foreground">
            {hasPendingSubmission
              ? "Worksheet sent · Feedback pending"
              : "No worksheet feedback yet"}
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            {hasPendingSubmission
              ? `We received ${firstName}'s worksheet photo. Their handwriting feedback and home tips will appear here once their teacher shares them.`
              : hasNoAssignedPractice
                ? "Your child's teacher hasn't assigned a practice worksheet yet. Use the cursive guide to practice together at home."
                : `${childName}'s worksheet photo and handwriting feedback will appear here when their teacher shares it.`}
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
        className="overflow-hidden rounded-xl border border-border bg-card shadow-warm md:grid md:grid-cols-12"
      >
        <div className="md:col-span-7 md:col-start-6 md:row-start-1 flex min-w-0 flex-col justify-center gap-4 p-5 sm:p-7">
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 space-y-2">
                <h2
                  id="latest-worksheet-heading"
                  className="font-heading text-lg sm:text-xl font-semibold tracking-tight wrap-anywhere text-foreground"
                >
                  {latest.activityText}
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground tabular-nums">
                  Checked worksheet &middot; {formattedDate}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {showScoreDetails && latest.scores.composite != null && (
                  <span className="font-sans text-sm font-semibold tabular-nums text-foreground">
                    {Math.round(latest.scores.composite)}%
                  </span>
                )}
                <BandBadge band={compositeBand} score={latest.scores.composite} size="default" showDot />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-brand-200/70 dark:border-brand-800/60 bg-brand-50/60 dark:bg-brand-950/30 p-3.5 sm:p-4 space-y-2.5 max-w-prose">
            <div className="space-y-1 text-sm leading-relaxed">
              <p className="font-semibold text-primary">
                {practiceFocus
                  ? `Try together · ${practiceFocus.meta.label}`
                  : "Try together"}
              </p>
              <p className="text-base text-foreground sm:text-sm">
                {practiceFocus?.meta.homeTip ??
                  "Choose a word from this worksheet and write it together."}
              </p>
            </div>
            {(showPracticeLink || onOpenCursiveGuide) && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-xs">
                {showPracticeLink && (
                  <button
                    type="button"
                    onClick={navigateToTakeHome}
                    className="font-medium text-primary hover:underline cursor-pointer inline-flex items-center gap-1 min-h-10 sm:min-h-9 touch-manipulation"
                  >
                    <span>Practice worksheets &rarr;</span>
                  </button>
                )}
                {onOpenCursiveGuide && (
                  <button
                    type="button"
                    onClick={() => onOpenCursiveGuide()}
                    className="font-medium text-muted-foreground hover:text-foreground cursor-pointer inline-flex items-center gap-1 min-h-10 sm:min-h-9 touch-manipulation"
                  >
                    <PenTool className="size-3 text-muted-foreground" aria-hidden="true" />
                    <span>Open cursive guide</span>
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2.5">
            <div className="rounded-xl border border-border/70 bg-card overflow-hidden shadow-2xs">
              <div className="cursive-guidelines px-3.5 py-2 overflow-x-auto flex items-center min-h-[46px] bg-background/50">
                <span className="font-cursive text-xl sm:text-2xl text-foreground whitespace-nowrap tracking-wide select-none">
                  {latest.activityText}
                </span>
              </div>
            </div>

            {latest.scores.composite != null && (
              <BandPositionBar
                score={latest.scores.composite}
                height="sm"
                showThresholds={showScoreDetails}
                ariaLabel={
                  showScoreDetails
                    ? `Overall score: ${Math.round(latest.scores.composite)}%`
                    : compositeBandMeta
                      ? `Overall level: ${compositeBandMeta.label}`
                      : "Overall level"
                }
                ariaValueText={
                  showScoreDetails
                    ? `${Math.round(latest.scores.composite)}% overall`
                    : compositeBandMeta?.label
                }
              />
            )}

            {compositeBand && PARENT_BAND_EXPLANATIONS[compositeBand] && (
              <p className="max-w-prose text-sm text-muted-foreground leading-relaxed">
                {PARENT_BAND_EXPLANATIONS[compositeBand]}
              </p>
            )}

            {trendSummary && (
              <div className="space-y-0.5 text-xs sm:text-sm text-muted-foreground">
                <p className="tabular-nums">
                  {trendSummary.label}
                  {showScoreDetails && trendSummary.deltaText ? ` · ${trendSummary.deltaText}` : ""}
                </p>
                {trendSummary.supportNote && (
                  <p className="max-w-prose text-xs text-muted-foreground/90 leading-relaxed">
                    {trendSummary.supportNote}
                  </p>
                )}
              </div>
            )}
          </div>

          {topStrength && (
            <p className="max-w-prose text-sm leading-relaxed text-foreground">
              <strong>{topStrength.meta.label}</strong> is a standout strength on this worksheet.
            </p>
          )}
          {isBalanced && (
            <p className="max-w-prose text-sm leading-relaxed text-foreground">
              {firstName}&apos;s ratings are steady and balanced across all 5 skills.
            </p>
          )}

          {/* Worksheet and conversation actions */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button
              type="button"
              variant="default"
              size="sm"
              className="min-h-[40px] sm:min-h-[36px] text-xs sm:text-sm font-semibold cursor-pointer touch-manipulation shadow-warm gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={() => openWorksheetForCriterion("all", "details")}
              aria-haspopup="dialog"
            >
              <span>{hasWritingMarks ? "View worksheet & marks" : "View worksheet feedback"}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-[40px] sm:min-h-[36px] gap-1.5 text-xs sm:text-sm font-medium cursor-pointer touch-manipulation"
              onClick={() => openWorksheetForCriterion("all", "comments")}
              aria-haspopup="dialog"
            >
              <MessageSquare className="size-3.5 text-primary" aria-hidden="true" />
              <span>Teacher comments</span>
              {hasUnreadComments && (
                <>
                  <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
                  <span className="sr-only">Unread</span>
                </>
              )}
            </Button>
          </div>
        </div>
        <div className="md:col-span-5 md:col-start-1 md:row-start-1 flex min-h-44 items-center justify-center bg-secondary/60 p-4 sm:p-6">
          {imageUrl && imageUrl !== failedImageUrl ? (
            <button
              type="button"
              onClick={() => openWorksheetForCriterion()}
              aria-haspopup="dialog"
              aria-label={`Inspect worksheet photo for ${latest.activityText}`}
              className="group relative h-48 w-full cursor-pointer rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring md:h-full md:min-h-64"
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
                className="pointer-events-none absolute bottom-2 right-2 rounded-full border border-border/80 bg-background/90 px-2.5 py-1 text-xs font-medium text-foreground shadow-xs backdrop-blur-xs"
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
      </section>

      <section aria-labelledby="handwriting-skills" className="overflow-hidden rounded-xl border border-border bg-card shadow-warm px-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2 py-4">
          <div>
            <h2 id="handwriting-skills" className="font-heading text-lg font-semibold">Handwriting skills</h2>
            <p className="text-sm text-muted-foreground">
              {hasWritingMarks
                ? "Select a skill to see its feedback and any marks on the worksheet."
                : "Select a skill to read its feedback and home practice tip."}
            </p>
          </div>
          {scoreControls}
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
              className="grid w-[calc(100%+2rem)] sm:w-[calc(100%+3rem)] -mx-4 sm:-mx-6 px-4 sm:px-6 cursor-pointer grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 border-t py-3.5 text-left text-sm transition-colors hover:bg-muted/40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:grid-cols-[minmax(11rem,14rem)_minmax(0,1fr)_auto]"
            >
              <span className="flex flex-col gap-0.5 min-w-0">
                <span className="font-semibold text-foreground">{label}</span>
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
              <span className="col-span-2 row-start-2 max-w-prose leading-relaxed text-muted-foreground md:col-span-1 md:col-start-2 md:row-start-1">
                {band ? DIAGNOSTIC_NOTES[key][band] : "Feedback is unavailable for this skill."}
              </span>
              <span className="col-start-2 row-start-1 flex items-center gap-1.5 md:col-start-3">
                {showScoreDetails && score != null && (
                  <span className="font-sans tabular-nums text-xs sm:text-sm font-semibold text-foreground">
                    {Math.round(score)}%
                  </span>
                )}
                <BandBadge band={band} score={score} size="sm" />
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
              </span>
            </button>
          );
        })}
        {onOpenRubric && (
          <div className="flex items-center justify-between gap-2 border-t py-2.5 text-sm text-muted-foreground">
            <span className="text-xs sm:text-sm">
              Want to see how each skill level is evaluated?
            </span>
            <Button
              type="button"
              variant="link"
              className="px-0 min-h-[40px] sm:min-h-[36px] cursor-pointer touch-manipulation"
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
