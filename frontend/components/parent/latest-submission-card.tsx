"use client";

import { useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useChildLatestScores } from "@/lib/hooks/use-parent-data";
import { useSubmissionImageUrl } from "@/lib/hooks/use-submissions";
import { useUnreadCommentThreads } from "@/lib/hooks/use-comments";
import type { StudentScoreHistoryItem } from "@/lib/hooks/use-dashboard";
import { normalizeActivityPrompt } from "@/lib/utils/formatters";
import { BandBadge } from "@/components/shared/band-badge";
import { BandPositionBar } from "@/components/shared/band-position-bar";
import { QueryRecovery } from "@/components/shared/query-recovery";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemTitle,
} from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { LatestSubmissionSkeleton } from "@/components/parent/parent-portal-skeletons";

const WorksheetViewDialog = dynamic(
  () => import("./worksheet-view-dialog").then((m) => m.WorksheetViewDialog),
  { ssr: false }
);
import {
  PARENT_CRITERIA_LIST,
  getBandFromScore,
  computeStrengthAndFocus,
} from "@/lib/utils/scoring";
import {
  getScoreProgressLabel,
} from "@/lib/utils/score-progress";
import type { CriterionFilter } from "@/components/shared/diagnostic-overlay";
import {
  FileText,
  Clock,
  ChevronRight,
  MessageSquare,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export interface LatestSubmissionCardProps {
  userId: string;
  childId: string | null;
  childName?: string;
  onOpenRubric?: () => void;
  onOpenCursiveGuide?: () => void;
  hasPendingSubmission?: boolean;
  hasNoAssignedPractice?: boolean;
  history?: StudentScoreHistoryItem[];
  onNavigateToWrite?: () => void;
}

export function LatestSubmissionCard({
  userId,
  childId,
  childName = "Your child",
  history = [],
  onNavigateToWrite,
  onOpenRubric,
  onOpenCursiveGuide,
  hasPendingSubmission = false,
  hasNoAssignedPractice = false,
}: LatestSubmissionCardProps) {
  const [viewImageOpen, setViewImageOpen] = useState(false);
  const [viewDialogMounted, setViewDialogMounted] = useState(false);
  const [initialDialogView, setInitialDialogView] = useState<"details" | "comments">("details");
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const [selectedCriterionForView, setSelectedCriterionForView] =
    useState<CriterionFilter>("all");

  const { data: latest, isLoading, isError, isFetching, refetch } = useChildLatestScores(childId, {
    hasPendingSubmission,
  });
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
    };
  }, [history]);

  const openWorksheetForCriterion = useCallback(
    (criterion: CriterionFilter = "all", view: "details" | "comments" = "details") => {
      setSelectedCriterionForView(criterion);
      setInitialDialogView(view);
      setViewDialogMounted(true);
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
      const prefersReduced =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth" });
    }
  }, [onNavigateToWrite]);

  if (isLoading) {
    return <LatestSubmissionSkeleton childFirstName={firstName} />;
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
      <Empty className="border border-solid border-border rounded-xl bg-card shadow-warm p-6 sm:p-8 gap-4">
        <EmptyHeader className="gap-1.5">
          <EmptyMedia variant="icon" className="size-12 rounded-2xl bg-secondary text-secondary-foreground [&_svg:not([class*='size-'])]:size-6">
            {hasPendingSubmission ? (
              <Clock aria-hidden="true" />
            ) : (
              <FileText aria-hidden="true" />
            )}
          </EmptyMedia>
          <EmptyTitle className="text-base font-semibold text-foreground">
            {hasPendingSubmission
              ? "Worksheet received · pending review"
              : "No feedback yet"}
          </EmptyTitle>
          <EmptyDescription className="max-w-sm leading-relaxed">
            {hasPendingSubmission
              ? `${firstName}'s feedback will appear here once their teacher shares it.`
              : hasNoAssignedPractice
                ? "No practice assigned yet. Use the cursive guide to practice at home."
                : `${firstName}'s latest worksheet and feedback will appear here once shared.`}
          </EmptyDescription>
        </EmptyHeader>
        {emptyAction && (
          <EmptyContent>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => emptyAction()}
              className="h-11 sm:h-9 text-xs sm:text-sm font-medium cursor-pointer touch-manipulation"
            >
              {hasNoAssignedPractice ? "Open cursive guide" : "View practice worksheets"}
            </Button>
          </EmptyContent>
        )}
      </Empty>
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
  const displayActivityText = normalizeActivityPrompt(latest.activityText);

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

      <Card
        role="region"
        aria-labelledby="latest-worksheet-heading"
        className="p-0 gap-0 md:grid md:grid-cols-12"
      >
        {/* Photo first in DOM: leads on phones, sits on left column on desktop */}
        <div className="md:col-span-5 flex items-center justify-center bg-secondary/45 p-4 sm:p-6">
          {imageUrl && imageUrl !== failedImageUrl ? (
            <AspectRatio ratio={4 / 3} className="w-full max-w-md">
              <Button
                type="button"
                variant="outline"
                onClick={() => openWorksheetForCriterion()}
                aria-haspopup="dialog"
                aria-label={`Inspect worksheet photo for ${displayActivityText}`}
                className="group relative size-full cursor-pointer overflow-hidden rounded-lg border-border/70 bg-background p-0 shadow-warm-sm transition-shadow hover:border-primary/40 hover:bg-background hover:shadow-warm focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Image
                  src={imageUrl}
                  alt={`Handwriting for ${displayActivityText}`}
                  fill
                  sizes="(min-width: 768px) 42vw, 100vw"
                  className="object-contain p-1.5 transition-transform duration-200 ease-out group-hover:scale-[1.015] motion-reduce:transition-none"
                  onError={() => setFailedImageUrl(imageUrl)}
                />
              </Button>
            </AspectRatio>
          ) : imageLoading && latest.imagePath ? (
            <AspectRatio
              ratio={4 / 3}
              role="status"
              aria-live="polite"
              aria-label="Loading worksheet photo"
              className="w-full max-w-md overflow-hidden rounded-lg border border-border/70 bg-background p-4 shadow-warm-sm flex flex-col justify-center gap-3"
            >
              <span className="sr-only">Loading worksheet photo</span>
              <Skeleton aria-hidden="true" className="h-3.5 w-2/3 rounded-md" />
              <Skeleton aria-hidden="true" className="h-3.5 w-5/6 rounded-md" />
              <Skeleton aria-hidden="true" className="h-3.5 w-3/4 rounded-md" />
              <Skeleton aria-hidden="true" className="h-3.5 w-1/2 rounded-md" />
            </AspectRatio>
          ) : (
            <AspectRatio
              ratio={4 / 3}
              className="flex w-full max-w-md items-center justify-center rounded-lg border border-dashed border-border/70 bg-background/70 px-4 text-center"
            >
              <span className="text-sm text-muted-foreground">
                Worksheet preview unavailable
              </span>
            </AspectRatio>
          )}
        </div>

        <CardContent className="md:col-span-7 flex min-w-0 flex-col justify-center gap-4 p-5 sm:p-6">
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex flex-col gap-1">
                <h2
                  id="latest-worksheet-heading"
                  className="font-heading text-lg sm:text-xl font-semibold tracking-tight wrap-anywhere text-foreground"
                >
                  {displayActivityText}
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground tabular-nums">
                  {formattedDate}
                  {trendSummary ? ` · ${trendSummary.label}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <BandBadge band={compositeBand} score={latest.scores.composite} size="default" showDot />
                {latest.scores.composite != null && (
                  <span className="font-sans text-sm font-semibold tabular-nums text-foreground">
                    {Math.round(latest.scores.composite)}%
                  </span>
                )}
              </div>
            </div>

            {latest.scores.composite != null && (
              <BandPositionBar
                score={latest.scores.composite}
                band={compositeBand}
                height="sm"
                showThresholds={false}
                ariaLabel={`Overall score: ${Math.round(latest.scores.composite)}%`}
                ariaValueText={`${Math.round(latest.scores.composite)}% overall`}
              />
            )}
          </div>

          {/* Worksheet and conversation actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3">
            <Button
              type="button"
              variant="default"
              size="sm"
              className="w-full sm:w-auto h-11 sm:h-9 px-4 text-xs sm:text-sm font-semibold cursor-pointer touch-manipulation shadow-warm-sm justify-center"
              onClick={() => openWorksheetForCriterion("all", "details")}
              aria-haspopup="dialog"
            >
              <span>{hasWritingMarks ? "View worksheet & marks" : "View worksheet"}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full sm:w-auto h-11 sm:h-9 px-3 gap-2 text-xs sm:text-sm font-medium cursor-pointer touch-manipulation justify-center"
              onClick={() => openWorksheetForCriterion("all", "comments")}
              aria-haspopup="dialog"
            >
              <MessageSquare data-icon="inline-start" className="text-primary" aria-hidden="true" />
              <span>Comments</span>
              {hasUnreadComments && (
                <Badge variant="secondary" className="rounded-full text-primary font-semibold">
                  Unread
                </Badge>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card role="region" aria-labelledby="skill-breakdown" className="p-0 gap-0">
        <CardHeader className="items-center px-4 sm:px-6 py-4 gap-0">
          <CardTitle id="skill-breakdown" className="text-lg font-semibold">
            Skill breakdown
          </CardTitle>
          {onOpenRubric && (
            <CardAction className="row-span-1 self-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-haspopup="dialog"
                className="h-11 sm:h-8 px-3 rounded-full text-xs font-medium text-foreground border-border/80 bg-background hover:text-primary hover:border-primary/40 hover:bg-primary/5 active:bg-primary/10 cursor-pointer touch-manipulation transition-colors shadow-2xs"
                onClick={onOpenRubric}
              >
                <HelpCircle data-icon="inline-start" className="text-primary" aria-hidden="true" />
                <span>Score Guide</span>
              </Button>
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="p-0 border-t border-border divide-y divide-border">
          {PARENT_CRITERIA_LIST.map(({ key, label }) => {
            const score = latest.scores[key];
            const band = latest.bands[key] ?? (score == null ? null : getBandFromScore(score));
            const isTop = topStrength?.key === key;
            const isFocus = practiceFocus?.key === key;
            return (
              <Item
                key={key}
                size="sm"
                className="group h-auto flex-nowrap rounded-none border-0 px-4 sm:px-6 py-3.5 min-h-12 w-full justify-between text-left font-normal whitespace-normal cursor-pointer transition-colors hover:bg-muted/40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring last:rounded-b-xl"
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => openWorksheetForCriterion(key, "details")}
                    aria-haspopup="dialog"
                  />
                }
              >
                <ItemContent className="flex-row flex-wrap items-center gap-x-2.5 gap-y-0.5 min-w-0">
                  <ItemTitle className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    {label}
                  </ItemTitle>
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
                </ItemContent>
                <ItemActions className="gap-2.5 shrink-0">
                  <BandBadge band={band} score={score} size="sm" showDot />
                  {score != null && (
                    <span className="font-sans tabular-nums text-xs sm:text-sm font-semibold text-foreground min-w-[2.5rem] text-right">
                      {Math.round(score)}%
                    </span>
                  )}
                  <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
                </ItemActions>
              </Item>
            );
          })}
        </CardContent>
      </Card>

      {viewDialogMounted && (
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
          scores={latest.scores}
          bands={latest.bands}
          guideLines={latest.guideLines}
          overlay={latest.overlay}
          onPracticeNow={showPracticeLink ? navigateToTakeHome : undefined}
        />
      )}
    </>
  );
}
