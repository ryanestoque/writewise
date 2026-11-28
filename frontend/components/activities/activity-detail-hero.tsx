"use client";

import { formatActivityDueAt } from "@/lib/utils/activity-deadlines";
import { getBandFromScore, getBandMeta } from "@/lib/utils/scoring";
import { memo, useState } from "react";
import { useShortcutKeys } from "@/hooks/use-shortcut-keys";
import type { Activity } from "@/lib/hooks/use-activities";
import type { ScoreBandInfo } from "@/lib/utils/submission-status";
import { Alert, AlertAction, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Kbd } from "@/components/ui/kbd";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
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
  DropdownMenuGroup,
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

const CRITERION_BAND_STYLES = {
  excellent: {
    barClass: "bg-band-4",
    textClass: "text-band-4-text",
    dotClass: "bg-band-4",
  },
  satisfactory: {
    barClass: "bg-band-3",
    textClass: "text-band-3-text",
    dotClass: "bg-band-3",
  },
  developing: {
    barClass: "bg-band-2",
    textClass: "text-band-2-text",
    dotClass: "bg-band-2",
  },
  needs_improvement: {
    barClass: "bg-band-1",
    textClass: "text-band-1-text",
    dotClass: "bg-band-1",
  },
} as const;

export function getCriterionBandStyle(score: number) {
  const bandKey = getBandFromScore(score) ?? "needs_improvement";
  const meta = getBandMeta(bandKey);
  return {
    band: meta.label,
    ...CRITERION_BAND_STYLES[bandKey],
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
          <span className="font-medium text-primary">
            Take-home
          </span>
        ) : (
          <span className="font-medium text-foreground/80">
            In-class
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
        <span className="tabular-nums whitespace-nowrap">
          {activity.due_at ? "Due " + formatActivityDueAt(activity.due_at) : "No due date"}
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
          "h-10 sm:h-9 text-xs font-semibold shadow-2xs",
          compact ? "px-2.5" : "px-3"
        )}
        title={`Upload worksheets (${altKey}+U)`}
        aria-keyshortcuts="Alt+U"
      >
        <Upload data-icon="inline-start" aria-hidden="true" />
        <span className={compact ? "inline" : "sm:hidden"}>Upload</span>
        {!compact && (
          <>
            <span className="hidden sm:inline">Upload worksheets</span>
            <Kbd
              aria-hidden="true"
              className="ml-1 hidden h-5 min-w-0 rounded border border-primary-foreground/30 bg-primary-foreground/10 px-1 text-xs text-primary-foreground md:inline-flex"
            >
              {altKey}+U
            </Kbd>
          </>
        )}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-11 sm:size-9 text-muted-foreground hover:text-foreground"
              aria-label="More activity options"
            />
          }
        >
          <MoreVertical aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuGroup>
            <DropdownMenuItem
              onClick={onDuplicate}
              className="min-h-11 md:min-h-9 cursor-pointer text-xs"
            >
              <Copy className="text-muted-foreground" aria-hidden="true" />
              <span>Duplicate Activity</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={onEdit}
              className="min-h-11 md:min-h-9 cursor-pointer text-xs"
            >
              <Edit3 className="text-muted-foreground" aria-hidden="true" />
              <span>Edit Activity</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={onToggleArchive}
              className="min-h-11 md:min-h-9 cursor-pointer text-xs"
            >
              {isArchived ? (
                <>
                  <ArchiveRestore className="text-muted-foreground" aria-hidden="true" />
                  <span>Unarchive Activity</span>
                </>
              ) : (
                <>
                  <Archive className="text-muted-foreground" aria-hidden="true" />
                  <span>Archive Activity</span>
                </>
              )}
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <DropdownMenuItem
              variant="destructive"
              onClick={onDelete}
              className="min-h-11 md:min-h-9 cursor-pointer text-xs"
            >
              <Trash2 aria-hidden="true" />
              <span>Delete Activity</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <Card
      aria-labelledby="activity-prompt-heading"
      className="gap-0 px-4 py-3 sm:p-5"
    >
      {/* Unified Responsive Title & Metadata */}
      <CardHeader className="p-0 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center justify-between gap-3 sm:block">
            <CardTitle
              as="h1"
              id="activity-prompt-heading"
              className="text-lg font-semibold break-words leading-snug sm:text-xl"
            >
              {activity.title || "Untitled Activity"}
            </CardTitle>
            <div className="shrink-0 sm:hidden">
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
      </CardHeader>

      <CardContent className="p-0">
        {isArchived && (
          <Alert role="status" className="mt-3">
            <Archive aria-hidden="true" />
            <AlertDescription>
              Archived and hidden from student assignment pickers.
            </AlertDescription>
          </Alert>
        )}
        <Collapsible
          open={isPromptExpanded}
          onOpenChange={setIsPromptExpanded}
          render={<section aria-label="Worksheet prompt" className="mt-3.5 flex flex-col gap-2" />}
        >
          {/* Standard print / non-cursive ground truth text with Copy aligned at the bottom end */}
          <div className="flex flex-wrap items-end justify-between gap-2 sm:gap-3">
            <p className="min-w-0 flex-1 text-sm font-medium text-foreground tracking-tight leading-relaxed break-words select-all">
              {targetText || (
                <span className="text-muted-foreground/70 italic text-sm font-normal">
                  No text specified
                </span>
              )}
            </p>
            <div className="ml-auto flex shrink-0 items-center gap-1 self-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onCopyPrompt}
                aria-label={hasCopiedPrompt ? "Target text copied" : "Copy target text"}
                className="min-h-11 sm:min-h-7 sm:h-7 px-2.5 sm:px-2 text-xs text-muted-foreground hover:text-foreground"
                title="Copy target text"
              >
                {hasCopiedPrompt ? (
                  <Check data-icon="inline-start" className="text-primary" aria-hidden="true" />
                ) : (
                  <Copy data-icon="inline-start" aria-hidden="true" />
                )}
                <span className="text-[11px] font-medium">
                  {hasCopiedPrompt ? "Copied" : "Copy target text"}
                </span>
              </Button>
              {isLongPrompt && (
                <CollapsibleTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="min-h-11 sm:min-h-7 sm:h-7 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
                      title={isPromptExpanded ? "Collapse cursive preview" : "Expand cursive preview"}
                    />
                  }
                >
                  <ChevronDown
                    data-icon="inline-start"
                    className={cn(
                      "transition-transform duration-200 motion-reduce:transition-none motion-reduce:transform-none",
                      isPromptExpanded && "rotate-180"
                    )}
                    aria-hidden="true"
                  />
                  <span className="text-[11px]">{isPromptExpanded ? "Collapse" : "Expand"}</span>
                </CollapsibleTrigger>
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
        </Collapsible>
      </CardContent>

      <Separator className="my-3.5" />

      <CardFooter className="p-0 flex-col items-stretch gap-3.5 sm:flex-row sm:items-center sm:gap-6">
        <div className="min-w-0 flex-1 flex flex-col gap-1.5">
          {summaryState === "loading" && totalStudents === 0 ? (
            <div className="flex flex-col gap-1.5" role="status" aria-label="Loading student submission progress">
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
                <Progress
                  value={completionRate}
                  max={100}
                  aria-label="Students with an official worksheet"
                  aria-valuetext={
                    uniqueStudentsCount +
                    " of " +
                    totalStudents +
                    " assigned students have an official worksheet (" +
                    completionRate +
                    "%)"
                  }
                  trackClassName="h-1.5 bg-muted"
                  indicatorClassName="bg-primary rounded-full duration-300 motion-reduce:transition-none"
                />
              ) : (
                <Button variant="link" onClick={onEdit} className="min-h-10 sm:min-h-9 self-start px-0 text-xs">
                  Edit assignments
                  <ArrowRight data-icon="inline-end" aria-hidden="true" />
                </Button>
              )}
            </>
          )}
        </div>

        <Separator className="sm:hidden" />

        {summaryState === "loading" ? (
          <div
            className="flex min-w-0 flex-1 items-center justify-between gap-3"
            role="status"
            aria-label="Loading diagnostic insights"
          >
            <div className="flex flex-col gap-1">
              <Skeleton className="h-3.5 w-24" />
              <div className="flex items-center gap-1.5">
                <Skeleton className="h-5 w-20 rounded-md" />
                <Skeleton className="h-3.5 w-28" />
              </div>
            </div>
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>
        ) : summaryState === "error" ? (
          <Alert variant="destructive" className="min-w-0 flex-1 py-2.5 text-xs">
            <AlertDescription className="truncate text-xs">
              Class insights unavailable.
            </AlertDescription>
            {onRetrySummary && (
              <AlertAction className="top-1.5 right-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onRetrySummary}
                  className="h-8 text-xs font-medium"
                >
                  <RefreshCw data-icon="inline-start" aria-hidden="true" />
                  Retry
                </Button>
              </AlertAction>
            )}
          </Alert>
        ) : classDiagnostics ? (
          <div className="flex min-w-0 flex-1 flex-col items-start justify-between gap-2.5 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-col gap-1">
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
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11 sm:min-h-9 shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground"
                    aria-label="View class criteria breakdown"
                  />
                }
              >
                <BarChart3 data-icon="inline-start" className="text-primary" aria-hidden="true" />
                <span>Breakdown</span>
                <ChevronDown data-icon="inline-end" className="opacity-60" aria-hidden="true" />
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[min(calc(100vw-2rem),21rem)] gap-2.5 p-3.5 text-xs">
                <PopoverHeader className="flex flex-col gap-1">
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

                <div className="flex flex-col gap-2">
                  {CRITERIA_METRICS.map(({ key, label }) => {
                    const score = classDiagnostics.criteriaAverages[key];
                    const { band, barClass, textClass } = getCriterionBandStyle(score);

                    return (
                      <div key={key}>
                        <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                          <span className="text-muted-foreground min-w-0 truncate">{label}</span>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <span className={cn("text-[11px] font-medium", textClass)}>
                              {band}
                            </span>
                            <span className="text-foreground font-medium tabular-nums">
                              {score}%
                            </span>
                          </div>
                        </div>
                        <Progress
                          value={Math.max(0, Math.min(100, score))}
                          max={100}
                          aria-label={`${label} class average: ${score}% (${band})`}
                          trackClassName="h-1.5 bg-muted"
                          indicatorClassName={cn(
                            "rounded-full duration-300 ease-out motion-reduce:transition-none",
                            barClass
                          )}
                        />
                      </div>
                    );
                  })}
                </div>

                {classDiagnostics.strongestCriterion && (
                  <>
                    <Separator />
                    <div className="text-muted-foreground flex flex-col gap-1.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={cn(
                              "size-1.5 shrink-0 rounded-full",
                              getCriterionBandStyle(classDiagnostics.strongestCriterion.score).dotClass
                            )}
                            aria-hidden="true"
                          />
                          <span
                            className={cn(
                              getCriterionBandStyle(classDiagnostics.strongestCriterion.score).textClass,
                              "font-semibold shrink-0"
                            )}
                          >
                            Strength:
                          </span>
                          <span className="truncate">{classDiagnostics.strongestCriterion.name}</span>
                        </div>
                        <span className="text-foreground font-medium tabular-nums shrink-0">
                          {classDiagnostics.strongestCriterion.score}%
                        </span>
                      </div>
                      {classDiagnostics.focusCriterion && (
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className={cn(
                                "size-1.5 shrink-0 rounded-full",
                                getCriterionBandStyle(classDiagnostics.focusCriterion.score).dotClass
                              )}
                              aria-hidden="true"
                            />
                            <span
                              className={cn(
                                getCriterionBandStyle(classDiagnostics.focusCriterion.score).textClass,
                                "font-semibold shrink-0"
                              )}
                            >
                              Practice Focus:
                            </span>
                            <span className="truncate">{classDiagnostics.focusCriterion.name}</span>
                          </div>
                          <span className="text-foreground font-medium tabular-nums shrink-0">
                            {classDiagnostics.focusCriterion.score}%
                          </span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </PopoverContent>
            </Popover>
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="size-3.5 shrink-0 opacity-60" aria-hidden="true" />
            <span>Class insights appear as worksheets are scored.</span>
          </div>
        )}
      </CardFooter>
    </Card>
  );
});
