"use client";

import type { ClassAverages } from "@/lib/hooks/use-dashboard";
import { BandBadge } from "@/components/shared/band-badge";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SummaryCardsSkeleton } from "@/components/teacher/teacher-portal-skeletons";
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
    return <SummaryCardsSkeleton className={className} />;
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
      <Card
        size="sm"
        className="xl:col-span-4 border-primary/25 bg-linear-to-b from-secondary/35 via-card to-card shadow-warm ring-1 ring-primary/15 justify-between gap-3"
      >
        <CardHeader>
          <CardTitle as="h3" className="font-sans text-xs font-semibold text-muted-foreground">
            Class Average
          </CardTitle>
          <CardAction>
            <BandBadge score={compositeScore} size="sm" />
          </CardAction>
        </CardHeader>

        <CardContent>
          <span className="font-sans text-2xl sm:text-3xl font-bold tracking-tight text-foreground tabular-nums">
            {compositeScore !== null ? `${compositeScore.toFixed(1)}%` : "—"}
          </span>
        </CardContent>

        {/* Single-line Pedagogical Focus Summary */}
        <CardFooter className="border-t border-border/60 text-xs text-muted-foreground leading-relaxed">
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
                  <span className="text-band-1-text font-medium tabular-nums">
                    {needsSupportCount} {needsSupportCount === 1 ? "student needs" : "students need"} support
                  </span>
                </>
              )}
            </div>
          ) : (
            <span>All assessed criteria are currently on track.</span>
          )}
        </CardFooter>
      </Card>

      {/* 5 Penmanship Criteria Strip */}
      <div className="xl:col-span-8 grid grid-cols-2 sm:grid-cols-6 lg:grid-cols-5 gap-3">
        {CRITERIA_CARDS.map((card, index) => {
          const score = averages?.[card.key] ?? null;
          const isFocus =
            lowestCriterion !== null &&
            lowestCriterion.key === card.key &&
            lowestCriterion.score < 75;

          const spanClass =
            index === 4
              ? "col-span-2 sm:col-span-3 lg:col-span-1"
              : index === 3
                ? "col-span-1 sm:col-span-3 lg:col-span-1"
                : "col-span-1 sm:col-span-2 lg:col-span-1";

          return (
            <Card
              key={card.key}
              size="sm"
              className={cn(
                "bg-card shadow-warm justify-between gap-2 transition-colors hover:border-primary/40",
                spanClass,
                isFocus ? "border-band-1/50" : "border-border"
              )}
            >
              <CardHeader className="gap-1">
                <CardTitle as="h3" className="font-sans text-xs font-semibold text-muted-foreground truncate">
                  {card.title}
                </CardTitle>
                {isFocus && (
                  <CardAction>
                    <Badge
                      variant="outline"
                      className="rounded-full px-1.5 py-0 text-[11px] font-semibold border-band-1/40 bg-band-1/10 text-band-1-text shrink-0"
                    >
                      Focus
                    </Badge>
                  </CardAction>
                )}
              </CardHeader>

              <CardContent>
                <span className="font-sans text-xl sm:text-2xl font-bold tracking-tight text-foreground tabular-nums block">
                  {score !== null ? `${score.toFixed(1)}%` : "—"}
                </span>
              </CardContent>

              <CardFooter>
                <BandBadge score={score} size="sm" />
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
