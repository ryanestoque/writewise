"use client";

import { useState, useMemo, useCallback, type ReactNode } from "react";
import Image from "next/image";
import { useChildLatestScores } from "@/lib/hooks/use-parent-data";
import { useSubmissionImageUrl } from "@/lib/hooks/use-submissions";
import type { StudentScoreHistoryItem } from "@/lib/hooks/use-dashboard";
import { BandBadge } from "@/components/shared/band-badge";
import { QueryRecovery } from "@/components/shared/query-recovery";
import { WorksheetViewDialog } from "./worksheet-view-dialog";
import {
  PARENT_CRITERIA_LIST,
  DIAGNOSTIC_NOTES,
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
  Loader2,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export interface LatestSubmissionCardProps {
  childId: string | null;
  childName?: string;
  scoreControls?: ReactNode;
  onOpenRubric?: () => void;
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
  onToggleScoreDetails,
  onNavigateToWrite,
  onOpenRubric,
  scoreControls,
}: LatestSubmissionCardProps) {
  const [viewImageOpen, setViewImageOpen] = useState(false);
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const [selectedCriterionForView, setSelectedCriterionForView] =
    useState<CriterionFilter>("all");

  const { data: latest, isLoading, isError, isFetching, refetch } = useChildLatestScores(childId);
  const { data: imageUrl, isLoading: imageLoading } = useSubmissionImageUrl(latest?.imagePath ?? null);

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
            View practice worksheets
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

      <section aria-labelledby="latest-worksheet-heading" className="overflow-hidden rounded-xl border border-border bg-card shadow-warm md:grid md:grid-cols-2">
        <div className="flex min-h-32 items-center justify-center bg-secondary/70 p-4 sm:p-6">
          {imageUrl && imageUrl !== failedImageUrl ? (
            <button type="button" onClick={() => openWorksheetForCriterion()} aria-haspopup="dialog"
              aria-label="View worksheet" className="group relative h-40 w-full cursor-pointer rounded-md focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring md:h-64">
              <Image src={imageUrl} alt={`Handwriting for ${latest.activityText}`} fill
                sizes="(min-width: 768px) 50vw, 100vw" className="object-contain transition-transform duration-200 ease-out group-hover:scale-[1.01] motion-reduce:transition-none"
                onError={() => setFailedImageUrl(imageUrl)} />
            </button>
          ) : <span className="text-sm text-muted-foreground">{imageLoading && latest.imagePath ? "Loading worksheet photo..." : "Worksheet preview unavailable"}</span>}
        </div>
        <div className="flex min-w-0 flex-col items-start justify-center gap-3 p-5 sm:p-7">
          <p className="text-sm text-muted-foreground tabular-nums">Latest worksheet &middot; {formattedDate}</p>
          <h2 id="latest-worksheet-heading" className="font-heading text-xl font-semibold tracking-tight wrap-anywhere sm:text-2xl">
            {latest.activityText}
          </h2>
          {topStrength && <p className="max-w-prose text-sm leading-relaxed">
            <strong>{topStrength.meta.label}</strong> is a strength on this worksheet.
          </p>}
          {isBalanced && <p className="text-sm">The ratings on this worksheet are similar across skills.</p>}
          <div className="max-w-prose text-sm leading-relaxed">
            <strong className="text-primary">Try together</strong>
            <p>{practiceFocus?.meta.homeTip ?? "Choose a word from this worksheet and write it together."}</p>
          </div>
          <div className="flex flex-wrap gap-x-5">
            <Button variant="link" className="px-0 cursor-pointer" onClick={() => openWorksheetForCriterion()} aria-haspopup="dialog">View worksheet</Button>
          </div>
        </div>
      </section>

      <section aria-labelledby="handwriting-skills" className="rounded-xl border border-border bg-card shadow-warm px-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2 py-4">
          <div>
            <h2 id="handwriting-skills" className="font-heading text-lg font-semibold">Handwriting skills</h2>
            <p className="text-sm text-muted-foreground">Select a skill to see it on the worksheet.</p>
          </div>
          {scoreControls}
        </div>
        {PARENT_CRITERIA_LIST.map(({ key, label }) => {
          const score = latest.scores[key];
          const band = latest.bands[key] ?? (score == null ? null : getBandFromScore(score));
          return (
            <button key={key} type="button" onClick={() => openWorksheetForCriterion(key)} aria-haspopup="dialog"
              className="grid w-full cursor-pointer grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 border-t py-3 text-left text-sm transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring md:grid-cols-[minmax(10rem,1fr)_3fr_auto]">
              <span className="font-semibold">{label}</span>
              <span className="col-span-2 row-start-2 leading-relaxed text-muted-foreground md:col-span-1 md:col-start-2 md:row-start-1">
                {band ? DIAGNOSTIC_NOTES[key][band] : "Feedback is unavailable for this skill."}
              </span>
              <span className="col-start-2 row-start-1 flex items-center gap-1.5 md:col-start-3">
                {showScoreDetails && score != null && <span className="tabular-nums">{Math.round(score)}%</span>}
                <BandBadge band={band} score={score} size="sm" />
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
              </span>
            </button>
          );
        })}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t py-2.5 text-sm text-muted-foreground">
          <span>Overall</span>
          <BandBadge band={latest.bands.composite} score={latest.scores.composite} size="sm" />
          {showScoreDetails && latest.scores.composite != null && (
            <span className="tabular-nums">{Math.round(latest.scores.composite)}%</span>
          )}
          {trendSummary && <span>{trendSummary.label} {showScoreDetails && trendSummary.deltaText}</span>}
          {onOpenRubric && <Button variant="link" className="px-0 sm:ml-auto" onClick={onOpenRubric}>How scores work</Button>}
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
        showScoreDetails={showScoreDetails}
        onToggleScoreDetails={onToggleScoreDetails}
        scores={latest.scores}
        bands={latest.bands}
        guideLines={latest.guideLines}
        overlay={latest.overlay}
        onPracticeNow={navigateToTakeHome}
      />
    </>
  );
}
