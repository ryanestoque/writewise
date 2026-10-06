"use client";


import type { ClassAverages } from "@/lib/hooks/use-dashboard";
import { BandBadge } from "@/components/shared/band-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface SummaryCardsProps {
  averages?: ClassAverages;
  isLoading?: boolean;
  className?: string;
}

interface SummaryCardItem {
  key: keyof Omit<ClassAverages, "scoredStudentsCount" | "totalStudentsCount" | "scoreSource">;
  title: string;
  isHeadline?: boolean;
}

const CARDS_CONFIG: SummaryCardItem[] = [
  {
    key: "composite",
    title: "Overall Composite",
    isHeadline: true,
  },
  {
    key: "letter_formation",
    title: "Letter Formation",
  },
  {
    key: "size_consistency",
    title: "Size Consistency",
  },
  {
    key: "spacing",
    title: "Spacing Regularity",
  },
  {
    key: "slant",
    title: "Slant Angle",
  },
  {
    key: "baseline_alignment",
    title: "Baseline Alignment",
  },
];

export function SummaryCards({
  averages,
  isLoading = false,
  className,
}: SummaryCardsProps) {
  if (isLoading) {
    return (
      <div
        className={cn(
          "grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4",
          className
        )}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="p-4 rounded-xl border border-border bg-card shadow-warm space-y-3"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="size-6 rounded-lg" />
            </div>
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  const scoredCount = averages?.scoredStudentsCount ?? 0;
  const totalCount = averages?.totalStudentsCount ?? 0;

  return (
    <div
      className={cn(
        "grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4",
        className
      )}
    >
      {CARDS_CONFIG.map((card) => {
        const score = averages?.[card.key] ?? null;

        return (
          <div
            key={card.key}
            className={cn(
              "p-3.5 sm:p-4 rounded-xl border border-border bg-card shadow-warm flex flex-col justify-between transition-all hover:border-brand-300/60 dark:hover:border-brand-800",
              card.isHeadline &&
                "ring-1 ring-brand-500/30 bg-gradient-to-b from-brand-50/40 via-card to-card dark:from-brand-950/30 dark:via-card dark:to-card border-brand-200/80 dark:border-brand-800"
            )}
          >
            {/* Header: Title + Icon */}
            <div className="flex items-start justify-between gap-1.5 mb-2">
              <span className="text-xs font-semibold text-muted-foreground line-clamp-1">
                {card.title}
              </span>
            </div>

            {/* Score Metric */}
            <div className="space-y-1.5 my-1">
              <div className="flex items-baseline gap-1">
                <span className="font-sans text-xl sm:text-2xl font-bold tracking-tight text-foreground tabular-nums">
                  {score !== null ? `${score.toFixed(1)}%` : "—"}
                </span>
              </div>

              <div>
                <BandBadge score={score} size="sm" />
              </div>
            </div>

            {/* Footer: Metadata */}
            <div className="pt-2 mt-1 border-t border-border/50 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>
                {scoredCount > 0
                  ? `${scoredCount}/${totalCount} scored`
                  : "No submissions"}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
