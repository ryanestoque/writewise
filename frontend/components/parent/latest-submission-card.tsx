"use client";

import { useState, useMemo, useCallback } from "react";
import Image from "next/image";
import { useChildLatestScores } from "@/lib/hooks/use-parent-data";
import { useSubmissionImageUrl } from "@/lib/hooks/use-submissions";
import type { StudentScoreHistoryItem } from "@/lib/hooks/use-dashboard";
import { BandPositionBar } from "@/components/shared/band-position-bar";
import { BandBadge } from "@/components/shared/band-badge";
import { QueryRecovery } from "@/components/shared/query-recovery";
import { WorksheetViewDialog } from "./worksheet-view-dialog";
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
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ParentStatusHeroProps {
  childId: string | null;
  childName: string;
  section?: string;
  history?: StudentScoreHistoryItem[];
  showScoreDetails: boolean;
  onToggleScoreDetails?: () => void;
}

export function ParentStatusHero({
  childId,
  childName,
  history = [],
  showScoreDetails,
}: ParentStatusHeroProps) {
  const { data: latest, isLoading, isError, isFetching, refetch } = useChildLatestScores(childId);
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
      tone: direction === "improving" ? "positive" as const : direction === "lower" ? "warm" as const : "neutral" as const,
    };
  }, [history]);

  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-xl border border-border bg-card shadow-warm p-5 sm:p-6 flex items-center gap-3"
      >
        <Loader2 className="size-5 animate-spin motion-reduce:animate-none text-brand-600 dark:text-brand-400" aria-hidden="true" />
        <span className="text-sm text-muted-foreground">Loading {firstName}&apos;s overview...</span>
      </div>
    );
  }

  const recovery = isError ? (
    <QueryRecovery
      title={latest ? "Overview couldn't refresh" : "Couldn't load the overview"}
      description={latest ? "Your saved assessment is still shown below. Try again to check for updates." : "Try again to see the latest assessment and home practice tip."}
      onRetry={() => { void refetch(); }}
      isRetrying={isFetching}
    />
  ) : null;

  if (!latest) return recovery;

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
    <div className="space-y-3">
      {recovery}
      <section
        aria-labelledby="parent-status-hero-heading"
        className="rounded-xl border border-border bg-card shadow-warm overflow-hidden"
      >
        {/* Practical guidance leads; the assessment supports it below. */}
        <div className="border-b border-border bg-secondary/40 p-5 sm:p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground">Practice together</p>
            <h2 id="parent-status-hero-heading" className="text-xl sm:text-2xl font-heading font-semibold tracking-tight text-foreground">
              {practiceFocus
                ? `Focus on ${practiceFocus.meta.label.toLowerCase()}`
                : isBalanced
                  ? "Keep building steady handwriting habits"
                  : `${firstName}'s next step`}
            </h2>
            <p className="text-sm sm:text-base text-foreground leading-relaxed">
              {practiceFocus
                ? practiceFocus.meta.homeTip
                : "Keep practice brief and relaxed. Use the latest worksheet below to see which habits to practise together."}
            </p>
          </div>
          {topStrength && (
            <div className="flex items-start gap-2 border-t border-border/70 pt-4">
              <CheckCircle2 className="size-4 shrink-0 text-primary mt-0.5" aria-hidden="true" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">A strength to build on: {topStrength.meta.label.toLowerCase()}.</span>{" "}
                {topStrength.meta.shortDescription}.
              </p>
            </div>
          )}
        </div>

        <div className="p-5 sm:p-6 flex flex-col gap-3">
          <p className="text-xs font-medium text-muted-foreground font-sans tabular-nums">Latest assessment · Worksheet from {formattedDate}</p>
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              {latest.scores.composite != null && compositeBandMeta ? (
                <>
                  <span className="text-sm font-semibold text-foreground inline-flex items-center gap-2">
                    <span
                      className={cn("size-3 rounded-full shrink-0", compositeBandMeta.dotColor)}
                      aria-hidden="true"
                    />
                    <span>{compositeBandMeta.label}</span>
                  </span>
                  {showScoreDetails && (
                    <span className="text-sm font-semibold font-sans tabular-nums text-foreground/80 bg-muted/60 px-2.5 py-0.5 rounded-md border border-border/60">
                      {Math.round(latest.scores.composite)}% overall
                    </span>
                  )}
                </>
              ) : (
                <div className="flex flex-col gap-0.5">
                  <span className="text-lg sm:text-xl font-heading font-semibold text-muted-foreground">
                    Awaiting teacher review
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Worksheet submitted · Typically reviewed within 1–2 school days
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {trendSummary && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border",
                    trendSummary.tone === "positive" &&
                    "bg-band-4/15 dark:bg-band-4/25 text-band-4-text dark:text-emerald-300 border-band-4/30 dark:border-band-4/40",
                    trendSummary.tone === "warm" &&
                    "bg-band-2/15 dark:bg-band-2/25 text-band-2-text dark:text-amber-200 border-band-2/30 dark:border-band-2/40",
                    trendSummary.tone === "neutral" &&
                    "bg-muted/60 text-foreground/90 border-border/70"
                  )}
                >
                  {trendSummary.tone === "positive" ? (
                    <TrendingUp className="size-3.5 shrink-0" aria-hidden="true" />
                  ) : trendSummary.tone === "warm" ? (
                    <TrendingDown className="size-3.5 shrink-0" aria-hidden="true" />
                  ) : (
                    <Minus className="size-3.5 shrink-0" aria-hidden="true" />
                  )}
                  <span>{trendSummary.label}</span>
                  {showScoreDetails && trendSummary.deltaText && (
                    <span className="font-sans tabular-nums">({trendSummary.deltaText})</span>
                  )}
                </span>
              )}
            </div>
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
            <p className="text-sm text-muted-foreground leading-relaxed">
              {PARENT_BAND_EXPLANATIONS[compositeBand]}
            </p>
          )}
        </div>

      </section>
    </div>
  );
}

interface LatestSubmissionCardProps {
  childId: string | null;
  childName?: string;
  showScoreDetails?: boolean;
  onToggleScoreDetails?: () => void;
  onNavigateToWrite?: () => void;
}

export function LatestSubmissionCard({
  childId,
  childName = "Your child",
  showScoreDetails = false,
  onNavigateToWrite,
}: LatestSubmissionCardProps) {
  const [viewImageOpen, setViewImageOpen] = useState(false);
  const [imageError, setImageError] = useState(false);

  const [selectedCriterionForView, setSelectedCriterionForView] =
    useState<CriterionFilter>("all");
  const { data: latest, isLoading, isError, isFetching, refetch } = useChildLatestScores(childId);
  const { data: imageUrl } = useSubmissionImageUrl(latest?.imagePath ?? null);

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
        className="rounded-xl border border-border bg-card shadow-warm p-8 flex flex-col items-center justify-center min-h-[200px] gap-2.5"
      >
        <Loader2 className="size-6 animate-spin motion-reduce:animate-none text-muted-foreground" aria-hidden="true" />
        <span className="text-sm text-muted-foreground">Loading latest worksheet...</span>
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
            Once a worksheet is checked, {childName}&apos;s handwriting photo and 5-skill feedback will appear here.
          </p>
        </div>
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={navigateToTakeHome}
            className="min-h-[40px] sm:min-h-[36px] text-xs sm:text-sm font-medium cursor-pointer touch-manipulation focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500"
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
      <div className="rounded-xl border border-border bg-card shadow-warm overflow-hidden">
        {/* Worksheet Header & Thumbnail Preview */}
        <div className="p-4 sm:p-5 space-y-3.5 bg-card">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-heading font-semibold text-foreground truncate" title={latest.activityText}>
                &ldquo;{latest.activityText}&rdquo;
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5 font-sans tabular-nums">
                Worksheet from {formattedDate} · Tap photo or any skill below to inspect writing lines
              </p>
            </div>
            {latest.imagePath && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => openWorksheetForCriterion("all")}
                aria-haspopup="dialog"
                className="min-h-11 sm:min-h-9 gap-1.5 shrink-0 cursor-pointer shadow-2xs"
              >
                <Eye className="size-3.5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                <span>Inspect</span>
              </Button>
            )}
          </div>

          {imageUrl && !imageError && (
            <button
              type="button"
              onClick={() => openWorksheetForCriterion("all")}
              aria-label={`Inspect ${childName}'s worksheet photo and writing lines`}
              aria-haspopup="dialog"
              className="group relative w-full h-40 sm:h-44 rounded-lg overflow-hidden border border-border/80 bg-muted/20 dark:bg-muted/10 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 block text-left transition-colors hover:border-brand-500/50 p-2 touch-manipulation shadow-2xs"
            >
              <div className="relative w-full h-full rounded overflow-hidden bg-background/50">
                <Image
                  src={imageUrl}
                  alt={`Handwriting worksheet sample for ${latest.activityText}`}
                  fill
                  sizes="(max-width: 768px) 100vw, 600px"
                  onError={() => setImageError(true)}
                  className="object-contain object-center transition-transform duration-300 group-hover:scale-[1.02]"
                />
                <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-background/90 via-background/40 to-transparent p-2.5 pt-6 flex items-center justify-between pointer-events-none">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground bg-card/90 backdrop-blur-xs px-2.5 py-1 rounded-md border border-border/80 shadow-2xs">
                    <Eye className="size-3 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                    <span>Tap to view writing lines &amp; guides</span>
                  </span>
                </div>
              </div>
            </button>
          )}
        </div>

        {/* Streamlined 5-Skill Quick Index */}
        <div className="border-t border-border/70 divide-y divide-border/60">
          {PARENT_CRITERIA_LIST.map((criterion) => {
            const score = latest.scores[criterion.key];
            const band = latest.bands[criterion.key];
            const bandMeta = band ? getBandMeta(band) : null;

            return (
              <button
                type="button"
                key={criterion.key}
                onClick={() => openWorksheetForCriterion(criterion.key)}
                aria-label={`Inspect ${criterion.label} on worksheet. Level: ${bandMeta?.label ?? "Pending"}`}
                aria-haspopup="dialog"
                className="w-full text-left px-4 py-3 sm:px-5 hover:bg-muted/30 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 transition-colors group cursor-pointer touch-manipulation min-h-[44px] flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium text-foreground group-hover:text-brand-700 dark:group-hover:text-brand-300 transition-colors truncate">
                    {criterion.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {showScoreDetails && score != null && (
                    <span className="font-sans text-xs sm:text-sm font-semibold tabular-nums text-muted-foreground">
                      {Math.round(score)}%
                    </span>
                  )}
                  <BandBadge band={band} score={score} size="sm" showDot />
                  <span className="text-xs text-brand-700 dark:text-brand-300 font-medium group-hover:underline hidden sm:inline-flex items-center gap-0.5">
                    <span>Inspect</span>
                  </span>
                  <ChevronRight
                    className="size-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0"
                    aria-hidden="true"
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

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
      />
    </>
  );
}
