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
  DIAGNOSTIC_NOTES,
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
  onToggleScoreDetails: () => void;
}

export function ParentStatusHero({
  childId,
  childName,
  section,
  history = [],
  showScoreDetails,
  onToggleScoreDetails,
}: ParentStatusHeroProps) {
  const { data: latest, isLoading } = useChildLatestScores(childId);
  const firstName = childName.trim().split(/\s+/)[0] || childName;

  const trendSummary = useMemo(() => {
    if (!history || history.length === 0) return null;
    if (history.length === 1) {
      const onlyDate = new Date(history[0].submissionDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      return {
        label: `First scored worksheet (${onlyDate})`,
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
        <span className="text-sm text-muted-foreground">Loading {firstName}&apos;s latest progress...</span>
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
      className="rounded-xl border border-border bg-card shadow-warm p-5 sm:p-6 space-y-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-0.5 min-w-0">
          <h1
            id="parent-status-hero-heading"
            className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-foreground"
          >
            How {firstName} is doing
          </h1>
          <p className="text-sm text-muted-foreground">
            {section ? `Section ${section} · ` : ""}Last checked {formattedDate}
          </p>
        </div>

        {latest.scores.composite != null && (
          <button
            type="button"
            onClick={onToggleScoreDetails}
            aria-pressed={showScoreDetails}
            className="text-xs font-medium text-brand-700 dark:text-brand-300 hover:text-brand-800 dark:hover:text-brand-200 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 rounded-lg px-3 py-1.5 min-h-[40px] sm:min-h-[36px] inline-flex items-center justify-center border border-brand-200/70 dark:border-brand-800/70 bg-brand-50/50 dark:bg-brand-950/30 transition-colors touch-manipulation shrink-0"
          >
            {showScoreDetails ? "Hide details" : "Show details"}
          </button>
        )}
      </div>

      <div className="space-y-3 pt-1">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 flex-wrap">
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
                  <span className="text-sm font-semibold font-sans tabular-nums text-muted-foreground bg-muted/60 px-2.5 py-0.5 rounded-md border border-border/60">
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
  );
}

interface ParentPracticeAtHomeCardProps {
  childId: string | null;
  childName: string;
  onPracticeAction?: () => void;
}

export function ParentPracticeAtHomeCard({
  childId,
  childName,
  onPracticeAction,
}: ParentPracticeAtHomeCardProps) {
  const { data: latest } = useChildLatestScores(childId);
  const firstName = childName.trim().split(/\s+/)[0] || childName;

  const { topStrength, practiceFocus, isBalanced } = useMemo(() => {
    return computeStrengthAndFocus(latest?.scores, latest?.bands);
  }, [latest]);

  const scrollToTasks = useCallback(() => {
    if (onPracticeAction) {
      onPracticeAction();
      return;
    }
    const el = document.getElementById("assigned-take-home-section");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  }, [onPracticeAction]);

  if (!latest || (!topStrength && !practiceFocus && !isBalanced)) {
    return null;
  }

  return (
    <section
      aria-labelledby="practice-at-home-heading"
      className="space-y-3"
    >
      <h2
        id="practice-at-home-heading"
        className="font-heading text-base sm:text-lg font-semibold text-foreground"
      >
        What to Practice at Home
      </h2>

      {isBalanced ? (
        <div className="flex items-start gap-3 p-4 sm:p-5 rounded-xl bg-brand-50/60 dark:bg-brand-950/40 border border-brand-200/70 dark:border-brand-800/60 shadow-warm">
          <CheckCircle2 className="size-5 text-brand-600 dark:text-brand-400 mt-0.5 shrink-0" aria-hidden="true" />
          <div className="min-w-0 space-y-1">
            <h3 className="text-sm sm:text-base font-semibold text-brand-900 dark:text-brand-100">
              Steady Across All 5 Skills
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {firstName} is showing balanced cursive habits across all 5 skills. Keep up brief, relaxed practice sessions to build smooth muscle memory.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {practiceFocus && (
            <div className="flex flex-col justify-between gap-3 p-4 rounded-xl bg-band-2/15 dark:bg-band-2/25 border border-band-2/30 dark:border-band-2/40 shadow-2xs">
              <div className="space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <span className="size-2.5 rounded-full bg-band-2 mt-1.5 shrink-0" aria-hidden="true" />
                  <div className="min-w-0 space-y-0.5">
                    <h3 className="text-sm font-semibold text-band-2-text dark:text-amber-200">
                      Focus This Week: {practiceFocus.meta.label}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-snug">
                      {practiceFocus.meta.shortDescription}
                    </p>
                  </div>
                </div>

                {practiceFocus.meta.homeTip && (
                  <div className="pt-2.5 border-t border-band-2/25 flex items-start gap-2 text-band-2-text dark:text-amber-200">
                    <Lightbulb className="size-4 shrink-0 text-band-2-text dark:text-amber-200 mt-0.5" aria-hidden="true" />
                    <p className="leading-relaxed text-sm">
                      <span className="font-semibold text-band-2-text dark:text-amber-200">Home tip: </span>
                      {practiceFocus.meta.homeTip}
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-band-2/20 flex items-center justify-between">
                <button
                  type="button"
                  onClick={scrollToTasks}
                  className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-band-2-text dark:text-amber-200 hover:text-amber-900 dark:hover:text-amber-100 hover:underline cursor-pointer group focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 rounded px-1.5 py-1 min-h-[40px] sm:min-h-[36px] touch-manipulation"
                >
                  <span>Go to take-home practice</span>
                  <ChevronRight className="size-4 text-band-2-text dark:text-amber-200 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}

          {topStrength && (
            <div className="flex flex-col justify-between gap-3 p-4 rounded-xl bg-band-4/15 dark:bg-band-4/25 border border-band-4/30 dark:border-band-4/40 shadow-2xs">
              <div className="flex items-start gap-2.5">
                <span className="size-2.5 rounded-full bg-band-4 mt-1.5 shrink-0" aria-hidden="true" />
                <div className="min-w-0 space-y-0.5">
                  <h3 className="text-sm font-semibold text-band-4-text dark:text-emerald-300">
                    Top Strength: {topStrength.meta.label}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-snug">
                    {topStrength.meta.shortDescription}
                  </p>
                </div>
              </div>

              <div className="pt-2.5 border-t border-band-4/25 flex items-start gap-2 text-band-4-text dark:text-emerald-300">
                <CheckCircle2 className="size-4 shrink-0 text-band-4 mt-0.5" aria-hidden="true" />
                <p className="leading-relaxed text-sm">
                  <span className="font-semibold text-band-4-text dark:text-emerald-300">Praise: </span>
                  Celebrate this steady skill with {firstName} to build confidence before practicing new letters.
                </p>
              </div>
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
  showScoreDetails: controlledShowDetails,
  onToggleScoreDetails,
}: LatestSubmissionCardProps) {
  const [viewImageOpen, setViewImageOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [internalShowDetails, setInternalShowDetails] = useState(false);
  const showScoreDetails =
    controlledShowDetails !== undefined ? controlledShowDetails : internalShowDetails;
  const toggleScoreDetails =
    onToggleScoreDetails || (() => setInternalShowDetails((prev) => !prev));

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
        <div className="p-5 sm:p-6 space-y-4 bg-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-base sm:text-lg font-heading font-semibold text-foreground truncate" title={latest.activityText}>
                &ldquo;{latest.activityText}&rdquo;
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Checked on {formattedDate}
              </p>
            </div>
            {latest.scores.composite != null && (
              <button
                type="button"
                onClick={toggleScoreDetails}
                aria-pressed={showScoreDetails}
                className="text-xs font-medium text-brand-700 dark:text-brand-300 hover:text-brand-800 dark:hover:text-brand-200 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 rounded-lg px-3 py-1.5 min-h-[40px] sm:min-h-[36px] inline-flex items-center justify-center border border-brand-200/70 dark:border-brand-800/70 bg-brand-50/50 dark:bg-brand-950/30 transition-colors touch-manipulation shrink-0"
              >
                {showScoreDetails ? "Hide details" : "Show details"}
              </button>
            )}
          </div>

          {imageUrl && !imageError && (
            <button
              type="button"
              onClick={() => openWorksheetForCriterion("all")}
              aria-label={`See ${childName}'s worksheet photo with guide lines`}
              aria-haspopup="dialog"
              className="group relative w-full h-44 sm:h-52 rounded-xl overflow-hidden border border-border/80 bg-muted/20 dark:bg-muted/10 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 shadow-xs block text-left transition-colors hover:border-brand-500/50 hover:shadow-warm p-2.5 sm:p-3 touch-manipulation"
            >
              <div className="relative w-full h-full rounded-lg overflow-hidden bg-background/50 shadow-inner">
                <Image
                  src={imageUrl}
                  alt={`Handwriting worksheet sample for ${latest.activityText}`}
                  fill
                  sizes="(max-width: 768px) 100vw, 600px"
                  onError={() => setImageError(true)}
                  className="object-contain object-center transition-opacity"
                />
              </div>
              <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex items-center gap-1.5 z-10">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-950/85 hover:bg-brand-900 text-brand-50 border border-brand-400/30 text-xs font-medium shadow-xs transition-colors group-hover:bg-brand-900 group-hover:border-brand-400/60">
                  <Eye className="size-3.5 text-brand-200" aria-hidden="true" />
                  <span>See on worksheet</span>
                </span>
              </div>
            </button>
          )}

          {latest.imagePath && (!imageUrl || imageError) && (
            <div className="pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => openWorksheetForCriterion("all")}
                aria-haspopup="dialog"
                className="w-full h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] text-xs sm:text-sm font-medium gap-2 border-brand-200 dark:border-brand-900 bg-brand-50/50 dark:bg-brand-950/30 text-brand-800 dark:text-brand-200 hover:bg-brand-100/60 dark:hover:bg-brand-900/50 cursor-pointer shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 touch-manipulation"
              >
                <Eye className="size-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                <span>See on worksheet</span>
              </Button>
            </div>
          )}
        </div>

        {/* All 5 Handwriting Skills */}
        <div className="border-t border-border/70 p-5 sm:p-6 space-y-3.5">
          <div className="flex items-center justify-between pb-1 border-b border-border/60">
            <div>
              <h4 className="text-sm sm:text-base font-heading font-semibold text-foreground">
                5 Handwriting Skills
              </h4>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Tap any skill to see its guide lines on the worksheet photo
              </p>
            </div>
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
                  aria-label={`See ${criterion.label} on worksheet. Level: ${bandMeta?.label ?? "Pending"}`}
                  aria-haspopup="dialog"
                  className="w-full text-left p-4 space-y-2.5 hover:bg-muted/30 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 transition-colors group cursor-pointer block touch-manipulation"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      <span className="text-sm font-semibold text-foreground group-hover:text-brand-700 dark:group-hover:text-brand-300 transition-colors">
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
                        <span className="font-sans text-xs sm:text-sm font-semibold tabular-nums text-muted-foreground">
                          {Math.round(score)}%
                        </span>
                      )}
                      <BandBadge band={band} score={score} size="sm" showDot />
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors ml-0.5 bg-muted/40 group-hover:bg-brand-50 dark:group-hover:bg-brand-950/40 px-2 py-0.5 rounded-md border border-border/50 group-hover:border-brand-200/60 dark:group-hover:border-brand-800/60 shrink-0">
                        <Eye className="size-3 text-muted-foreground group-hover:text-brand-600 dark:group-hover:text-brand-400" aria-hidden="true" />
                        <span>See on worksheet</span>
                      </span>
                    </div>
                  </div>

                  {score != null && (
                    <BandPositionBar
                      score={score}
                      height="sm"
                      showThresholds={showScoreDetails}
                    />
                  )}

                  {diagnosticNote && (
                    <p className="text-sm text-muted-foreground leading-relaxed pr-2">
                      {diagnosticNote}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
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
