"use client";

import { formatActivityDueAt } from "@/lib/utils/activity-deadlines";
import { memo } from "react";
import { useShortcutKeys } from "@/hooks/use-shortcut-keys";
import type { Activity } from "@/lib/hooks/use-activities";
import type { ScoreBandInfo } from "@/lib/utils/submission-status";
import { formatDate } from "@/lib/utils/formatters";
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
  hasCopiedPrompt,
  onCopyPrompt,
  onUpload,
  onEdit,
  onDuplicate,
  onDelete,
  onToggleArchive,
}: ActivityDetailHeroProps) {
  const { altKey } = useShortcutKeys();
  return (
    <section
      aria-labelledby="activity-prompt-heading"
      className="bg-surface dark:bg-card rounded-xl border px-4 py-3 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1
            id="activity-prompt-heading"
            className="font-heading text-lg font-semibold break-words sm:text-xl"
          >
            {activity.title || "Untitled Activity"}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2 print:hidden">
          <Button
            size="sm"
            onClick={onUpload}
            className="h-11 md:h-9"
            title={`Upload worksheets (${altKey}+U)`}
            aria-keyshortcuts="Alt+U"
          >
            <Upload data-icon="inline-start" />
            <span className="sm:hidden">Upload</span>
            <span className="hidden sm:inline">Upload worksheets</span>
            <kbd className="ml-1 hidden rounded border px-1 text-xs md:inline">
              {altKey}+U
            </kbd>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="border-border bg-background hover:bg-muted/60 text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex size-11 cursor-pointer items-center justify-center rounded-lg border transition-all focus-visible:ring-2 focus-visible:outline-hidden md:size-9 md:rounded-xl"
              aria-label="More activity options"
            >
              <MoreVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="z-50 w-48">
              <DropdownMenuItem
                onClick={onCopyPrompt}
                className="flex min-h-[44px] cursor-pointer items-center text-xs md:min-h-[36px]"
              >
                {hasCopiedPrompt ? (
                  <Check className="text-primary mr-2 h-3.5 w-3.5 stroke-[2.5]" />
                ) : (
                  <Copy className="text-muted-foreground mr-2 h-3.5 w-3.5" />
                )}
                <span>{hasCopiedPrompt ? "Prompt Copied!" : "Copy Prompt Text"}</span>
              </DropdownMenuItem>

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
      </div>
      <p className="text-muted-foreground mt-1 text-xs">
        {activity.is_take_home ? "Take-home" : "In-class"} ·{" "}
        {activity.due_at ? "Due " + formatActivityDueAt(activity.due_at) : "No due date"}
        {activity.close_after_due ? " · Parent uploads close at the deadline" : ""}
      </p>
      {isArchived && (
        <p role="status" className="text-muted-foreground mt-3 text-sm">
          <Archive className="mr-1 inline size-4" aria-hidden="true" />
          Archived and hidden from student assignment pickers.
        </p>
      )}
      <section aria-labelledby="worksheet-prompt-heading" className="mt-2 flex flex-col gap-2 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-x-3">
          <h2 id="worksheet-prompt-heading" className="font-heading text-sm font-semibold">
            Worksheet prompt
          </h2>
          <Button
            variant="ghost"
            onClick={onCopyPrompt}
            aria-label={hasCopiedPrompt ? "Worksheet prompt copied" : "Copy worksheet prompt"}
            className="h-11 md:h-9"
          >
            {hasCopiedPrompt ? (
              <Check data-icon="inline-start" />
            ) : (
              <Copy data-icon="inline-start" />
            )}
            {hasCopiedPrompt ? "Copied" : "Copy"}
          </Button>
        </div>
        {activity.instructions && (
          <p className="max-w-prose text-sm break-words whitespace-pre-wrap">
            {activity.instructions}
          </p>
        )}
        <WorksheetPrompt text={activity.target_text} />
        <p className="text-muted-foreground text-xs">
          {wordCount} {wordCount === 1 ? "word" : "words"} · Created{" "}
          <time dateTime={activity.created_at}>{formatDate(activity.created_at)}</time> ·{" "}
          {totalScansCount} total uploads
        </p>
      </section>
      {summaryState !== "ready" ? (
        <div role="status" className="text-muted-foreground mt-2 text-sm">
          {summaryState === "loading" ? (
            <>
              <span>Loading class progress...</span>
              <Skeleton className="mt-2 h-2 w-full" />
            </>
          ) : (
            "Class progress is unavailable. Retry the failed section below."
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center sm:gap-6">
          <div className="min-w-0 flex-1">
            <p className="text-muted-foreground text-xs">
              <strong className="text-foreground tabular-nums">
                {uniqueStudentsCount} of {totalStudents}
              </strong>{" "}
              assigned students have an official worksheet
            </p>
            {totalStudents > 0 ? (
              <div
                className="bg-muted mt-2 h-1.5 overflow-hidden rounded-full"
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
                  className="bg-primary h-full rounded-full"
                  style={{ width: completionRate + "%" }}
                />
              </div>
            ) : (
              <Button variant="link" onClick={onEdit} className="min-h-11 px-0">
                Edit assignments
                <ArrowRight data-icon="inline-end" />
              </Button>
            )}
            {totalStudents > 0 && (
              <p className="text-muted-foreground mt-1.5 text-xs">
                The official worksheet counts toward the result. A newer upload may still need review.
              </p>
            )}
          </div>
          {classDiagnostics ? (
            <div className="flex min-w-0 flex-1 flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-muted-foreground text-xs">
                  Class performance · {classDiagnostics.completedCount} scored
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {classDiagnostics.manualCount > 0 && classDiagnostics.calibratedCount > 0
                    ? `Mixed sources: ${classDiagnostics.manualCount} teacher rubric · ${classDiagnostics.calibratedCount} calibrated`
                    : classDiagnostics.manualCount > 0
                      ? "Based on teacher rubric scores"
                      : "Based on calibrated scores"}
                </p>
                <Badge
                  variant="outline"
                  className={cn("mt-1", classDiagnostics.scoreBand.className)}
                >
                  {classDiagnostics.scoreBand.label}
                </Badge>
                {classDiagnostics.focusCriterion && (
                  <p className="mt-1 text-xs break-words">
                    Practice focus:{" "}
                    <strong className="font-medium">
                      {classDiagnostics.focusCriterion.name.toLowerCase()}
                    </strong>
                  </p>
                )}
              </div>
              <Popover>
                <PopoverTrigger
                  className="border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted/60 focus-visible:ring-ring inline-flex min-h-[44px] shrink-0 cursor-pointer items-center gap-1 rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-hidden sm:gap-1.5 sm:px-3 md:min-h-[36px]"
                  aria-label="View class criteria breakdown"
                >
                  <BarChart3
                    className="text-brand-600 dark:text-brand-400 size-3.5"
                    aria-hidden="true"
                  />
                  <span className="inline">Class Breakdown</span>
                  <ChevronDown className="size-3 opacity-60" aria-hidden="true" />
                </PopoverTrigger>
                <PopoverContent align="end" className="z-50 w-[min(calc(100vw-2rem),18rem)] space-y-3 p-3.5 text-xs">
                  <PopoverHeader>
                    <PopoverTitle className="text-foreground flex items-center justify-between text-xs font-semibold">
                      <span>5-Criterion Class Average</span>
                      <span className="text-primary font-bold tabular-nums">
                        {classDiagnostics.avgCompositeScore}%
                      </span>
                    </PopoverTitle>
                    <PopoverDescription className="sr-only">
                      Aggregated class diagnostic scores across Letter Formation, Size Consistency,
                      Spacing, Slant, and Baseline Alignment.
                    </PopoverDescription>
                  </PopoverHeader>

                  <div className="space-y-2 pt-1">
                    <div>
                      <div className="text-muted-foreground mb-0.5 flex justify-between text-[11px]">
                        <span>Letter Formation</span>
                        <span className="text-foreground font-medium tabular-nums">
                          {classDiagnostics.criteriaAverages.letterFormation}%
                        </span>
                      </div>
                      <div
                        className="bg-muted h-1.5 w-full overflow-hidden rounded-full"
                        role="progressbar"
                        aria-valuenow={classDiagnostics.criteriaAverages.letterFormation}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Letter Formation class average: ${classDiagnostics.criteriaAverages.letterFormation}%`}
                      >
                        <div
                          className="bg-brand-600 dark:bg-brand-400 h-full rounded-full transition-all duration-300 motion-reduce:transition-none"
                          style={{
                            width: `${classDiagnostics.criteriaAverages.letterFormation}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="text-muted-foreground mb-0.5 flex justify-between text-[11px]">
                        <span>Size Consistency</span>
                        <span className="text-foreground font-medium tabular-nums">
                          {classDiagnostics.criteriaAverages.sizeConsistency}%
                        </span>
                      </div>
                      <div
                        className="bg-muted h-1.5 w-full overflow-hidden rounded-full"
                        role="progressbar"
                        aria-valuenow={classDiagnostics.criteriaAverages.sizeConsistency}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Size Consistency class average: ${classDiagnostics.criteriaAverages.sizeConsistency}%`}
                      >
                        <div
                          className="bg-brand-600 dark:bg-brand-400 h-full rounded-full transition-all duration-300 motion-reduce:transition-none"
                          style={{
                            width: `${classDiagnostics.criteriaAverages.sizeConsistency}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="text-muted-foreground mb-0.5 flex justify-between text-[11px]">
                        <span>Spacing</span>
                        <span className="text-foreground font-medium tabular-nums">
                          {classDiagnostics.criteriaAverages.spacing}%
                        </span>
                      </div>
                      <div
                        className="bg-muted h-1.5 w-full overflow-hidden rounded-full"
                        role="progressbar"
                        aria-valuenow={classDiagnostics.criteriaAverages.spacing}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Spacing class average: ${classDiagnostics.criteriaAverages.spacing}%`}
                      >
                        <div
                          className="bg-brand-600 dark:bg-brand-400 h-full rounded-full transition-all duration-300 motion-reduce:transition-none"
                          style={{
                            width: `${classDiagnostics.criteriaAverages.spacing}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="text-muted-foreground mb-0.5 flex justify-between text-[11px]">
                        <span>Slant Consistency</span>
                        <span className="text-foreground font-medium tabular-nums">
                          {classDiagnostics.criteriaAverages.slant}%
                        </span>
                      </div>
                      <div
                        className="bg-muted h-1.5 w-full overflow-hidden rounded-full"
                        role="progressbar"
                        aria-valuenow={classDiagnostics.criteriaAverages.slant}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Slant Consistency class average: ${classDiagnostics.criteriaAverages.slant}%`}
                      >
                        <div
                          className="bg-brand-600 dark:bg-brand-400 h-full rounded-full transition-all duration-300 motion-reduce:transition-none"
                          style={{
                            width: `${classDiagnostics.criteriaAverages.slant}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="text-muted-foreground mb-0.5 flex justify-between text-[11px]">
                        <span>Baseline Alignment</span>
                        <span className="text-foreground font-medium tabular-nums">
                          {classDiagnostics.criteriaAverages.baselineAlignment}%
                        </span>
                      </div>
                      <div
                        className="bg-muted h-1.5 w-full overflow-hidden rounded-full"
                        role="progressbar"
                        aria-valuenow={classDiagnostics.criteriaAverages.baselineAlignment}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Baseline Alignment class average: ${classDiagnostics.criteriaAverages.baselineAlignment}%`}
                      >
                        <div
                          className="bg-brand-600 dark:bg-brand-400 h-full rounded-full transition-all duration-300 motion-reduce:transition-none"
                          style={{
                            width: `${classDiagnostics.criteriaAverages.baselineAlignment}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {classDiagnostics.strongestCriterion && (
                    <div className="border-border/60 text-muted-foreground space-y-1 border-t pt-2 text-[11px]">
                      <p>
                        <span className="text-band-4-text font-semibold">
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
                          <span className="text-band-2-text font-semibold">
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
            <p className="text-muted-foreground hidden flex-1 text-xs sm:block">
              Class insights appear as worksheets are scored.
            </p>
          )}
        </div>
      )}
    </section>
  );
});
