"use client";

import { useState, useMemo, useCallback } from "react";
import Image from "next/image";
import { useChildLatestScores } from "@/lib/hooks/use-parent-data";
import { useSubmissionImageUrl } from "@/lib/hooks/use-submissions";
import type { StudentScoreHistoryItem } from "@/lib/hooks/use-dashboard";
import { BandPositionBar } from "@/components/shared/band-position-bar";
import { BandBadge } from "@/components/shared/band-badge";
import { WorksheetViewDialog } from "./worksheet-view-dialog";
import { cn } from "@/lib/utils";
import {
  PARENT_CRITERIA_LIST,
  getBandMeta,
  getBandFromScore,
  computeStrengthAndFocus,
} from "@/lib/utils/scoring";
import type { CriterionFilter } from "@/components/shared/diagnostic-overlay";
import {
  FileText,
  Loader2,
  Eye,
  Lightbulb,
  CheckCircle2,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const PARENT_BAND_EXPLANATIONS: Record<string, string> = {
  excellent: "Fluent, consistent cursive handwriting that meets grade-level goals.",
  satisfactory: "Solid cursive foundation with small areas to refine during practice.",
  developing: "Actively learning and building muscle memory — a normal, healthy stage in cursive.",
  needs_improvement: "Working on basic letter shapes and pencil control with guided practice.",
};

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
  const { data: latest, isLoading } = useChildLatestScores(childId);
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

    if (diff >= 1.5) {
      return {
        label: `Improving since ${startDate}`,
        deltaText: `+${diff.toFixed(1)}%`,
        tone: "positive" as const,
      };
    }
    if (diff <= -1.5) {
      return {
        label: `Building consistency since ${startDate}`,
        deltaText: `${diff.toFixed(1)}%`,
        tone: "warm" as const,
      };
    }
    return {
      label: `Steady since ${startDate}`,
      deltaText: `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%`,
      tone: "neutral" as const,
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

  if (!latest) return null;

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
    <section
      aria-labelledby="parent-status-hero-heading"
      className="rounded-xl border border-border bg-card shadow-warm overflow-hidden"
    >
      {/* Top: Overall Status & Band Bar */}
      <div className="p-5 sm:p-6 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 id="parent-status-hero-heading" className="sr-only">
              How {firstName} is doing
            </h2>
            {latest.scores.composite != null && compositeBandMeta ? (
              <>
                <span className="text-xl sm:text-2xl font-heading font-bold text-foreground inline-flex items-center gap-2">
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
              <span className="text-lg sm:text-xl font-heading font-semibold text-muted-foreground">
                Awaiting teacher review
              </span>
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
                <TrendingUp className="size-3.5 shrink-0" aria-hidden="true" />
                <span>{trendSummary.label}</span>
                {showScoreDetails && trendSummary.deltaText && (
                  <span className="font-sans tabular-nums">({trendSummary.deltaText})</span>
                )}
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              Checked {formattedDate}
            </span>
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

      {/* Bottom: Unified Practice Focus & Top Strength Strip */}
      {(topStrength || practiceFocus || isBalanced) && (
        <div className="border-t border-border/70 bg-muted/20 px-5 py-4 sm:px-6">
          {isBalanced ? (
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="size-4 text-brand-600 dark:text-brand-400 mt-0.5 shrink-0" aria-hidden="true" />
              <p className="text-sm text-foreground/90 leading-relaxed">
                <span className="font-semibold text-foreground">Steady across all 5 skills: </span>
                {firstName} is showing balanced cursive habits. Keep up brief, relaxed practice sessions.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:divide-x sm:divide-border/60">
              {practiceFocus && (
                <div className="space-y-1.5 sm:pr-4">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-band-2 shrink-0" aria-hidden="true" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-band-2-text dark:text-amber-300">
                      Focus This Week
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    {practiceFocus.meta.label}
                  </p>
                  {practiceFocus.meta.homeTip && (
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed flex items-start gap-1.5">
                      <Lightbulb className="size-3.5 shrink-0 text-band-2-text dark:text-amber-300 mt-0.5" aria-hidden="true" />
                      <span>{practiceFocus.meta.homeTip}</span>
                    </p>
                  )}
                </div>
              )}

              {topStrength && (
                <div className={cn("space-y-1.5", practiceFocus && "pt-3 sm:pt-0 border-t sm:border-t-0 border-border/60 sm:pl-4")}>
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-band-4 shrink-0" aria-hidden="true" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-band-4-text dark:text-emerald-300">
                      Top Strength
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    {topStrength.meta.label}
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    {topStrength.meta.shortDescription}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

interface LatestSubmissionCardProps {
  childId: string | null;
  childName?: string;
  showScoreDetails?: boolean;
  onToggleScoreDetails?: () => void;
}

export function LatestSubmissionCard({
  childId,
  childName = "Your child",
  showScoreDetails = false,
}: LatestSubmissionCardProps) {
  const [viewImageOpen, setViewImageOpen] = useState(false);
  const [imageError, setImageError] = useState(false);

  const [selectedCriterionForView, setSelectedCriterionForView] =
    useState<CriterionFilter>("all");
  const { data: latest, isLoading } = useChildLatestScores(childId);
  const { data: imageUrl } = useSubmissionImageUrl(latest?.imagePath ?? null);

  const openWorksheetForCriterion = useCallback((criterion: CriterionFilter = "all") => {
    setSelectedCriterionForView(criterion);
    setViewImageOpen(true);
  }, []);

  const navigateToTakeHome = useCallback(() => {
    const el = document.getElementById("assigned-take-home-section");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  const { topStrength, practiceFocus } = useMemo(() => {
    return computeStrengthAndFocus(latest?.scores, latest?.bands);
  }, [latest]);

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
            Go to Take-Home Practice
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
      <div className="rounded-xl border border-border bg-card shadow-warm overflow-hidden">
        {/* Worksheet Header & Thumbnail Preview */}
        <div className="p-4 sm:p-5 space-y-3.5 bg-card">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-heading font-semibold text-foreground truncate" title={latest.activityText}>
                &ldquo;{latest.activityText}&rdquo;
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Checked {formattedDate} · Tap any skill below to see guide lines
              </p>
            </div>
            {latest.imagePath && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => openWorksheetForCriterion("all")}
                aria-haspopup="dialog"
                className="h-9 min-h-[36px] text-xs font-medium gap-1.5 shrink-0 cursor-pointer"
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
              aria-label={`See ${childName}'s worksheet photo with guide lines`}
              aria-haspopup="dialog"
              className="group relative w-full h-36 sm:h-40 rounded-lg overflow-hidden border border-border/80 bg-muted/20 dark:bg-muted/10 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 block text-left transition-colors hover:border-brand-500/50 p-2 touch-manipulation"
            >
              <div className="relative w-full h-full rounded overflow-hidden bg-background/50">
                <Image
                  src={imageUrl}
                  alt={`Handwriting worksheet sample for ${latest.activityText}`}
                  fill
                  sizes="(max-width: 768px) 100vw, 600px"
                  onError={() => setImageError(true)}
                  className="object-contain object-center transition-opacity"
                />
              </div>
            </button>
          )}
        </div>

        {/* Concise 5-Skill Rows (No nested card, no paragraph wall) */}
        <div className="border-t border-border/70 divide-y divide-border/60">
          {PARENT_CRITERIA_LIST.map((criterion) => {
            const isTop = topStrength?.key === criterion.key;
            const isFocus = practiceFocus?.key === criterion.key;
            const score = latest.scores[criterion.key];
            const band = latest.bands[criterion.key];
            const bandMeta = band ? getBandMeta(band) : null;

            return (
              <button
                type="button"
                key={criterion.key}
                onClick={() => openWorksheetForCriterion(criterion.key)}
                aria-label={`See ${criterion.label} on worksheet. Level: ${bandMeta?.label ?? "Pending"}`}
                aria-haspopup="dialog"
                className="w-full text-left px-4 py-3 sm:px-5 flex items-center justify-between gap-3 hover:bg-muted/30 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 transition-colors group cursor-pointer touch-manipulation"
              >
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <span className="text-sm font-medium text-foreground group-hover:text-brand-700 dark:group-hover:text-brand-300 transition-colors">
                    {criterion.label}
                  </span>
                  {isTop && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-band-4-text dark:text-emerald-300 bg-band-4/15 dark:bg-band-4/25 px-2 py-0.5 rounded-md border border-band-4/30 dark:border-band-4/40 shrink-0">
                      Strength
                    </span>
                  )}
                  {isFocus && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-band-2-text dark:text-amber-200 bg-band-2/15 dark:bg-band-2/25 px-2 py-0.5 rounded-md border border-band-2/30 dark:border-band-2/40 shrink-0">
                      Focus
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {showScoreDetails && score != null && (
                    <span className="font-sans text-xs sm:text-sm font-semibold tabular-nums text-muted-foreground">
                      {Math.round(score)}%
                    </span>
                  )}
                  <BandBadge band={band} score={score} size="sm" showDot />
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
