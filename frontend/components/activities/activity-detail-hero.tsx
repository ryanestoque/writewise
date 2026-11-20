"use client";

import { formatActivityDueAt } from "@/lib/utils/activity-deadlines";
import { memo, useState } from "react";
import { useShortcutKeys } from "@/hooks/use-shortcut-keys";
import type { Activity } from "@/lib/hooks/use-activities";
import type { ScoreBandInfo } from "@/lib/utils/submission-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { WorksheetPrompt } from "@/components/activities/worksheet-prompt";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Archive,
  ArchiveRestore,
  Upload,
  MoreVertical,
  Copy,
  Check,
  Edit3,
  Trash2,
  ArrowRight,
  BarChart3,
  ChevronDown,
  Clock,
  RefreshCw,
  Home,
  BookOpen,
} from "lucide-react";

export interface ClassDiagnosticSummary {
  completedCount: number;
  manualCount: number;
  calibratedCount: number;
  avgCompositeScore: number;
  scoreBand: ScoreBandInfo;
  criteriaAverages: {
    letterFormation: number;
    sizeConsistency: number;
    spacing: number;
    slant: number;
    baselineAlignment: number;
  };
  strongestCriterion: { name: string; score: number } | null;
  focusCriterion: { name: string; score: number } | null;
}

const CRITERIA_METRICS: Array<{
  key: keyof ClassDiagnosticSummary["criteriaAverages"];
  label: string;
}> = [
  { key: "letterFormation", label: "Letter Formation" },
  { key: "sizeConsistency", label: "Size Consistency" },
  { key: "spacing", label: "Spacing" },
  { key: "slant", label: "Slant Consistency" },
  { key: "baselineAlignment", label: "Baseline Alignment" },
];

function getCriterionBandStyle(score: number) {
  if (score >= 80) {
    return {
      band: "Excellent",
      barClass: "bg-band-4",
      textClass: "text-band-4-text",
    };
  }
  if (score >= 60) {
    return {
      band: "Satisfactory",
      barClass: "bg-band-3",
      textClass: "text-band-3-text",
    };
  }
  if (score >= 40) {
    return {
      band: "Developing",
      barClass: "bg-band-2",
      textClass: "text-band-2-text",
    };
  }
  return {
    band: "Needs Impr.",
    barClass: "bg-band-1",
    textClass: "text-band-1-text",
  };
}

export interface ActivityDetailHeroProps {
  activity: Activity;
  isArchived: boolean;
  wordCount: number;
  totalStudents: number;
  uniqueStudentsCount: number;
  totalScansCount: number;
  completionRate: number;
  classDiagnostics: ClassDiagnosticSummary | null;
  summaryState?: "loading" | "error" | "ready";
  onRetrySummary?: () => void;
  hasCopiedPrompt: boolean;
  onCopyPrompt: () => void;
  onUpload: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleArchive: () => void;
}

export const ActivityDetailHero = memo(function ActivityDetailHero({
  activity,
  isArchived,
  wordCount,
  totalStudents,
  uniqueStudentsCount,
  totalScansCount,
  completionRate,
  classDiagnostics,
  summaryState = "ready",
  onRetrySummary,
  hasCopiedPrompt,
  onCopyPrompt,
  onUpload,
  onEdit,
  onDuplicate,
  onDelete,
  onToggleArchive,
}: ActivityDetailHeroProps) {
  const { altKey } = useShortcutKeys();
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);
  const targetText = activity.target_text?.trim() ?? "";
  const isLongPrompt = wordCount > 10 || targetText.includes("\n") || targetText.length > 60;

  const metadataContent = (
    <div className="text-muted-foreground text-xs flex flex-wrap items-center gap-x-2 gap-y-1">
      {/* Group 1: Activity Mode & Word Count */}
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        {activity.is_take_home ? (
          <span className="inline-flex items-center gap-1 font-medium text-brand-700 dark:text-brand-300">
            <Home className="size-3 text-brand-600 dark:text-brand-400" aria-hidden="true" />
            <span>Take-home</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 font-medium text-foreground/80">
            <BookOpen className="size-3 text-brand-600 dark:text-brand-400" aria-hidden="true" />
            <span>In-class</span>
          </span>
        )}
        <span aria-hidden="true" className="text-muted-foreground/40 select-none">·</span>
        <span className="tabular-nums">
          {wordCount} {wordCount === 1 ? "word" : "words"}
        </span>
      </span>

      <span aria-hidden="true" className="text-muted-foreground/40 select-none hidden min-[480px]:inline">·</span>

      {/* Group 2: Due Date & Closure Policy */}
      <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <span className="inline-flex items-center gap-1 tabular-nums whitespace-nowrap">
          <Clock className="size-3 text-muted-foreground/70 shrink-0" aria-hidden="true" />
          <span>{activity.due_at ? "Due " + formatActivityDueAt(activity.due_at) : "No due date"}</span>
        </span>
        {activity.close_after_due && (
          <>
            <span aria-hidden="true" className="text-muted-foreground/40 select-none">·</span>
            <span className="whitespace-nowrap">Closes at deadline</span>
          </>
        )}
      </span>
    </div>
  );

  const renderActions = (compact = false) => (
    <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 print:hidden">
      <Button
        size="sm"
        onClick={onUpload}
        className={cn(
          "h-9 font-semibold text-xs gap-1.5 shadow-2xs cursor-pointer",
          compact ? "px-2.5" : "px-3"
        )}
        title={`Upload worksheets (${altKey}+U)`}
        aria-keyshortcuts="Alt+U"
      >
        <Upload className="size-3.5" data-icon="inline-start" />
        <span className={compact ? "inline" : "sm:hidden"}>Upload</span>
        {!compact && (
          <>
            <span className="hidden sm:inline">Upload worksheets</span>
            <kbd className="ml-1 hidden rounded border px-1 text-xs md:inline">
              {altKey}+U
            </kbd>
          </>
        )}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="border-border bg-background hover:bg-muted/60 text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex size-9 cursor-pointer items-center justify-center rounded-lg border transition-all focus-visible:ring-2 focus-visible:outline-hidden"
          aria-label="More activity options"
        >
          <MoreVertical className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="z-50 w-48">
          <DropdownMenuItem
            onClick={onDuplicate}
            className="flex min-h-[44px] cursor-pointer items-center text-xs md:min-h-[36px]"
          >
            <Copy className="text-muted-foreground mr-2 h-3.5 w-3.5" />
            <span>Duplicate Activity</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={onEdit}
            className="flex min-h-[44px] cursor-pointer items-center text-xs md:min-h-[36px]"
          >
            <Edit3 className="text-muted-foreground mr-2 h-3.5 w-3.5" />
            <span>Edit Activity</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={onToggleArchive}
            className="flex min-h-[44px] cursor-pointer items-center text-xs md:min-h-[36px]"
          >
            {isArchived ? (
              <>
                <ArchiveRestore className="text-muted-foreground mr-2 h-3.5 w-3.5" />
                <span>Unarchive Activity</span>
              </>
            ) : (
              <>
                <Archive className="text-muted-foreground mr-2 h-3.5 w-3.5" />
                <span>Archive Activity</span>
              </>
            )}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={onDelete}
            className="text-destructive hover:bg-destructive/10 focus:text-destructive focus:bg-destructive/10 flex min-h-[44px] cursor-pointer items-center text-xs md:min-h-[36px]"
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            <span>Delete Activity</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <section
      aria-labelledby="activity-prompt-heading"
      className="bg-surface dark:bg-card rounded-xl border px-4 py-3 sm:p-5"
    >
      {/* Unified Responsive Title & Metadata */}
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3 min-w-0 sm:block">
            <h1
              id="activity-prompt-heading"
              className="font-heading text-lg font-semibold break-words leading-snug sm:text-xl"
            >
              {activity.title || "Untitled Activity"}
            </h1>
            <div className="sm:hidden shrink-0">
              {renderActions(true)}
            </div>
          </div>
          <div className="mt-1">
            {metadataContent}
          </div>
        </div>
        <div className="hidden sm:flex sm:shrink-0">
          {renderActions(false)}
        </div>
      </div>
      {isArchived && (
        <p role="status" className="text-muted-foreground mt-3 text-sm">
          <Archive className="mr-1 inline size-4" aria-hidden="true" />
          Archived and hidden from student assignment pickers.
        </p>
      )}
      <section aria-label="Worksheet prompt" className="mt-3.5 flex flex-col gap-2">
        {/* Standard print / non-cursive ground truth text with Copy aligned at the bottom end */}
        <div className="flex flex-wrap items-end justify-between gap-2 sm:gap-3">
          <p className="min-w-0 flex-1 text-sm font-medium text-foreground tracking-tight leading-relaxed break-words select-all">
            {targetText || (
              <span className="text-muted-foreground/70 italic text-sm font-normal">
                No text specified
              </span>
            )}
          </p>
          <div className="flex items-center gap-1 shrink-0 self-end ml-auto">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCopyPrompt}
              aria-label={hasCopiedPrompt ? "Target text copied" : "Copy target text"}
              className="h-10 min-h-[44px] sm:h-7 sm:min-h-[28px] px-2.5 sm:px-2 text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 cursor-pointer rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
              title="Copy target text"
            >
              {hasCopiedPrompt ? (
                <Check className="text-primary size-3.5" data-icon="inline-start" />
              ) : (
                <Copy className="size-3.5" data-icon="inline-start" />
              )}
              <span className="text-[11px] font-medium">
                {hasCopiedPrompt ? "Copied" : "Copy target text"}
              </span>
            </Button>
            {isLongPrompt && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsPromptExpanded(!isPromptExpanded)}
                aria-expanded={isPromptExpanded}
                className="h-10 min-h-[44px] sm:h-7 sm:min-h-[28px] px-2 text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1 cursor-pointer rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
                title={isPromptExpanded ? "Collapse cursive preview" : "Expand cursive preview"}
              >
                <ChevronDown
                  className={cn("size-3.5 transition-transform duration-200", isPromptExpanded && "rotate-180")}
                  aria-hidden="true"
                />
                <span className="text-[11px]">{isPromptExpanded ? "Collapse" : "Expand"}</span>
              </Button>
            )}
          </div>
        </div>

        {activity.instructions && (
          <p className="max-w-prose text-xs text-muted-foreground break-words whitespace-pre-wrap">
            {activity.instructions}
          </p>
        )}

        <WorksheetPrompt
          text={activity.target_text}
          preview={isLongPrompt && !isPromptExpanded}
        />
      </section>
      <div className="flex flex-col gap-3.5 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:gap-6">
        <div className="min-w-0 flex-1 space-y-1.5">
          {summaryState === "loading" && totalStudents === 0 ? (
            <div className="space-y-1.5" role="status" aria-label="Loading student submission progress">
              <div className="flex items-center justify-between text-xs">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-8" />
              </div>
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs">
                <span
                  className="text-muted-foreground"
                  title={`${uniqueStudentsCount} of ${totalStudents} students submitted (${totalScansCount} total ${totalScansCount === 1 ? "upload" : "uploads"})`}
                >
                  <strong className="text-foreground font-semibold tabular-nums">
                    {uniqueStudentsCount} of {totalStudents}
                  </strong>{" "}
                  students submitted
                </span>
                {totalStudents > 0 && (
                  <span className="text-muted-foreground text-[11px] font-medium tabular-nums">
                    {completionRate}%
                  </span>
                )}
              </div>
              {totalStudents > 0 ? (
                <div
                  className="bg-muted h-1.5 overflow-hidden rounded-full"
                  role="progressbar"
                  aria-valuenow={completionRate}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Students with an official worksheet"
                  aria-valuetext={
                    uniqueStudentsCount +
                    " of " +
                    totalStudents +
                    " assigned students have an official worksheet (" +
                    completionRate +
                    "%)"
                  }
                >
                  <div
                    className="bg-primary h-full rounded-full transition-all duration-300 motion-reduce:transition-none"
                    style={{ width: completionRate + "%" }}
                  />
                </div>
              ) : (
                <Button variant="link" onClick={onEdit} className="min-h-9 px-0 text-xs">
                  Edit assignments
                  <ArrowRight data-icon="inline-end" />
                </Button>
              )}
            </>
          )}
        </div>

        {summaryState === "loading" ? (
          <div
            className="flex min-w-0 flex-1 items-center justify-between gap-3 border-t border-border/40 pt-3 sm:border-t-0 sm:pt-0"
            role="status"
            aria-label="Loading diagnostic insights"
          >
            <div className="space-y-1">
              <Skeleton className="h-3.5 w-24" />
              <div className="flex items-center gap-1.5">
                <Skeleton className="h-5 w-20 rounded-md" />
                <Skeleton className="h-3.5 w-28" />
              </div>
            </div>
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>
        ) : summaryState === "error" ? (
          <div
            className="flex min-w-0 flex-1 items-center justify-between gap-2 border-t border-border/40 pt-3 text-xs text-muted-foreground sm:border-t-0 sm:pt-0"
            role="alert"
          >
            <span className="truncate">Class insights unavailable.</span>
            {onRetrySummary && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRetrySummary}
                className="h-8 shrink-0 text-xs font-medium text-foreground hover:bg-muted cursor-pointer"
              >
                <RefreshCw className="mr-1 size-3" aria-hidden="true" />
                Retry
              </Button>
            )}
          </div>
        ) : classDiagnostics ? (
          <div className="flex min-w-0 flex-1 flex-col items-start justify-between gap-2.5 border-t border-border/40 pt-3 sm:border-t-0 sm:pt-0 sm:flex-row sm:items-center">
            <div className="min-w-0 space-y-1">
              <p className="text-muted-foreground text-xs flex items-center gap-1.5 flex-wrap">
                <span>Class average</span>
                <span aria-hidden="true" className="text-muted-foreground/40 select-none">·</span>
                <span className="tabular-nums">{classDiagnostics.completedCount} scored</span>
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge
                  variant="outline"
                  className={cn("px-2 py-0.5 text-xs font-medium", classDiagnostics.scoreBand.className)}
                >
                  {classDiagnostics.scoreBand.label}
                </Badge>
                {classDiagnostics.focusCriterion && (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground text-xs">
                    <span aria-hidden="true" className="text-muted-foreground/40 select-none hidden min-[360px]:inline">·</span>
                    <span className="truncate">
                      Focus:{" "}
                      <strong className="text-foreground font-medium">
                        {classDiagnostics.focusCriterion.name.toLowerCase()}
                      </strong>
                    </span>
                  </span>
                )}
              </div>
            </div>
            <Popover>
              <PopoverTrigger
                className="border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted/60 focus-visible:ring-ring inline-flex min-h-[44px] sm:min-h-[36px] shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-hidden"
                aria-label="View class criteria breakdown"
              >
                <BarChart3
                  className="text-brand-600 dark:text-brand-400 size-3.5"
                  aria-hidden="true"
                />
                <span>Breakdown</span>
                <ChevronDown className="size-3 opacity-60" aria-hidden="true" />
              </PopoverTrigger>
              <PopoverContent align="end" className="z-50 w-[min(calc(100vw-2rem),21rem)] space-y-3.5 p-4 text-xs">
                <PopoverHeader className="space-y-1">
                  <PopoverTitle className="text-foreground flex items-center justify-between text-xs font-semibold">
                    <span>5-Criterion Class Average</span>
                    <span className="text-primary font-bold tabular-nums">
                      {classDiagnostics.avgCompositeScore}%
                    </span>
                  </PopoverTitle>
                  {classDiagnostics.manualCount > 0 && classDiagnostics.calibratedCount > 0 ? (
                    <p className="text-muted-foreground text-[11px]">
                      Mixed sources: {classDiagnostics.manualCount} teacher rubric · {classDiagnostics.calibratedCount} calibrated
                    </p>
                  ) : classDiagnostics.manualCount > 0 ? (
                    <p className="text-muted-foreground text-[11px]">
                      Based on teacher rubric scores
                    </p>
                  ) : null}
                  <PopoverDescription className="sr-only">
                    Aggregated class diagnostic scores across Letter Formation, Size Consistency,
                    Spacing, Slant, and Baseline Alignment.
                  </PopoverDescription>
                </PopoverHeader>

                <div className="space-y-2.5 pt-1">
                  {CRITERIA_METRICS.map(({ key, label }) => {
                    const score = classDiagnostics.criteriaAverages[key];
                    const { band, barClass, textClass } = getCriterionBandStyle(score);

                    return (
                      <div key={key}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{label}</span>
                          <div className="flex items-center gap-1.5">
                            <span className={cn("text-[11px] font-medium", textClass)}>
                              {band}
                            </span>
                            <span className="text-foreground font-medium tabular-nums">
                              {score}%
                            </span>
                          </div>
                        </div>
                        <div
                          className="bg-muted h-1.5 w-full overflow-hidden rounded-full"
                          role="progressbar"
                          aria-valuenow={score}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${label} class average: ${score}% (${band})`}
                        >
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-300 motion-reduce:transition-none",
                              barClass
                            )}
                            style={{
                              width: `${score}%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {classDiagnostics.strongestCriterion && (
                  <div className="border-border/60 text-muted-foreground space-y-1.5 border-t pt-2.5 text-xs">
                    <p>
                      <span
                        className={cn(
                          getCriterionBandStyle(classDiagnostics.strongestCriterion.score).textClass,
                          "font-semibold"
                        )}
                      >
                        Strength:
                      </span>{" "}
                      {classDiagnostics.strongestCriterion.name} (
                      <span className="tabular-nums">
                        {classDiagnostics.strongestCriterion.score}%
                      </span>
                      )
                    </p>
                    {classDiagnostics.focusCriterion && (
                      <p>
                        <span
                          className={cn(
                            getCriterionBandStyle(classDiagnostics.focusCriterion.score).textClass,
                            "font-semibold"
                          )}
                        >
                          Practice Focus:
                        </span>{" "}
                        {classDiagnostics.focusCriterion.name} (
                        <span className="tabular-nums">
                          {classDiagnostics.focusCriterion.score}%
                        </span>
                        )
                      </p>
                    )}
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-1.5 border-t border-border/40 pt-3 text-xs text-muted-foreground sm:border-t-0 sm:pt-0">
            <Clock className="size-3.5 shrink-0 opacity-60" aria-hidden="true" />
            <span>Class insights appear as worksheets are scored.</span>
          </div>
        )}
      </div>
    </section>
  );
});
