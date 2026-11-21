"use client";

import type { ClassAverages } from "@/lib/hooks/use-dashboard";
import { BandBadge } from "@/components/shared/band-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface SummaryCardsProps {
  averages?: ClassAverages;
  needsSupportCount?: number;
  isLoading?: boolean;
  className?: string;
}

interface CriterionCardItem {
  key: keyof Omit<
    ClassAverages,
    "composite" | "scoredStudentsCount" | "totalStudentsCount" | "scoreSource"
  >;
  title: string;
}

const CRITERIA_CARDS: CriterionCardItem[] = [
  { key: "letter_formation", title: "Letter Formation" },
  { key: "size_consistency", title: "Size Consistency" },
  { key: "spacing", title: "Spacing" },
  { key: "slant", title: "Slant Angle" },
  { key: "baseline_alignment", title: "Baseline" },
];

export function SummaryCards({
  averages,
  needsSupportCount = 0,
  isLoading = false,
  className,
}: SummaryCardsProps) {
  if (isLoading) {
    return (
      <div className={cn("grid grid-cols-1 xl:grid-cols-12 gap-3 sm:gap-4", className)}>
        <div className="xl:col-span-4 p-4 sm:p-5 rounded-xl border border-border bg-card shadow-warm space-y-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="xl:col-span-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="p-3.5 sm:p-4 rounded-xl border border-border bg-card shadow-warm space-y-3"
            >
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const compositeScore = averages?.composite ?? null;
  const scoredCount = averages?.scoredStudentsCount ?? 0;

  // Identify the class's lowest-scoring criterion for immediate pedagogical triage
  const lowestCriterion = CRITERIA_CARDS.map((c) => ({
    key: c.key,
    title: c.title,
    score: averages?.[c.key] ?? null,
  }))
    .filter((c): c is { key: CriterionCardItem["key"]; title: string; score: number } => c.score !== null)
    .sort((a, b) => a.score - b.score)[0] ?? null;

  return (
    <div className={cn("grid grid-cols-1 xl:grid-cols-12 gap-3 sm:gap-4", className)}>
      {/* Lead Classroom Triage Anchor Card */}
      <div className="xl:col-span-4 p-4 sm:p-5 rounded-xl border border-brand-200/80 dark:border-brand-800 bg-gradient-to-b from-brand-50/40 via-card to-card dark:from-brand-950/30 dark:via-card dark:to-card shadow-warm ring-1 ring-brand-500/20 flex flex-col justify-between gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground block">
              Class Average
            </span>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-sans text-2xl sm:text-3xl font-bold tracking-tight text-foreground tabular-nums">
                {compositeScore !== null ? `${compositeScore.toFixed(1)}%` : "—"}
              </span>
              <BandBadge score={compositeScore} size="sm" />
            </div>
          </div>
        </div>

        {/* Single-line Pedagogical Focus Summary */}
        <div className="pt-2.5 border-t border-border/60 text-xs text-muted-foreground leading-relaxed">
          {scoredCount === 0 ? (
            <span>Upload and grade a worksheet to see class-wide focus areas.</span>
          ) : lowestCriterion ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>
                Priority focus:{" "}
                <strong className="text-foreground font-semibold">{lowestCriterion.title}</strong>{" "}
                <span className="tabular-nums">({lowestCriterion.score.toFixed(1)}%)</span>
              </span>
              {needsSupportCount > 0 && (
                <>
                  <span aria-hidden="true">•</span>
                  <span className="text-band-1-text dark:text-amber-300 font-medium tabular-nums">
                    {needsSupportCount} {needsSupportCount === 1 ? "student needs" : "students need"} support
                  </span>
                </>
              )}
            </div>
          ) : (
            <span>All assessed criteria are currently on track.</span>
          )}
        </div>
      </div>

      {/* 5 Penmanship Criteria Strip */}
      <div className="xl:col-span-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {CRITERIA_CARDS.map((card) => {
          const score = averages?.[card.key] ?? null;
          const isFocus =
            lowestCriterion !== null &&
            lowestCriterion.key === card.key &&
            lowestCriterion.score < 75;

          return (
            <div
              key={card.key}
              className={cn(
                "p-3.5 sm:p-4 rounded-xl border bg-card shadow-warm flex flex-col justify-between gap-2 transition-colors hover:border-brand-300/60 dark:hover:border-brand-800",
                isFocus
                  ? "border-band-1/40 dark:border-band-1/50"
                  : "border-border"
              )}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-semibold text-muted-foreground truncate">
                  {card.title}
                </span>
                {isFocus && (
                  <span className="text-[11px] font-semibold text-band-1-text dark:text-amber-300 shrink-0">
                    Focus
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                <span className="font-sans text-xl sm:text-2xl font-bold tracking-tight text-foreground tabular-nums block">
                  {score !== null ? `${score.toFixed(1)}%` : "—"}
                </span>
                <div>
                  <BandBadge score={score} size="sm" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
