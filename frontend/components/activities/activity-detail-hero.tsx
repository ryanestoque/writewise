"use client";

import Link from "next/link";
import type { Activity } from "@/lib/hooks/use-activities";
import type { ScoreBandInfo } from "@/lib/utils/submission-status";
import { formatDate } from "@/lib/utils/formatters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
  Home,
  BookOpen,
  CalendarDays,
  Upload,
  MoreVertical,
  Copy,
  Check,
  Edit3,
  Trash2,
  GraduationCap,
  ArrowRight,
  BarChart3,
  ChevronDown,
} from "lucide-react";

export interface ClassDiagnosticSummary {
  completedCount: number;
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
  hasCopiedPrompt: boolean;
  onCopyPrompt: () => void;
  onUpload: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleArchive: () => void;
}

export function ActivityDetailHero({
  activity,
  isArchived,
  wordCount,
  totalStudents,
  uniqueStudentsCount,
  totalScansCount,
  completionRate,
  classDiagnostics,
  hasCopiedPrompt,
  onCopyPrompt,
  onUpload,
  onEdit,
  onDuplicate,
  onDelete,
  onToggleArchive,
}: ActivityDetailHeroProps) {
  return (
    <section
      aria-labelledby="activity-prompt-heading"
      className={cn(
        "relative bg-surface dark:bg-card border rounded-xl sm:rounded-2xl p-5 sm:p-6 shadow-warm transition-all overflow-hidden print:shadow-none print:border-black/30 print:p-4 print:bg-white",
        isArchived
          ? "border-muted-foreground/30 bg-muted/20 opacity-95"
          : "border-border"
      )}
    >
      {/* Screen Reader Semantic Heading */}
      <h1 id="activity-prompt-heading" className="sr-only">
        Activity: {activity.target_text || "Untitled Activity"}
      </h1>

      {/* Archived Top Warning Banner if Archived */}
      {isArchived && (
        <div
          role="status"
          className="mb-4 -mt-1 -mx-1 px-3 py-1.5 rounded-lg bg-warning/10 border border-warning/25 text-warning-foreground dark:text-warning text-xs flex items-center gap-2 print:border-black/30 print:bg-muted/10 print:text-black"
        >
          <Archive
            className="size-3.5 shrink-0 text-warning print:text-black"
            aria-hidden="true"
          />
          <span>
            This activity is archived and hidden from student assignment
            pickers.
          </span>
        </div>
      )}

      <div className="flex flex-col gap-4 min-w-0">
        {/* Top Row: Context Badges + Action Buttons */}
        <div className="flex items-start justify-between gap-2.5 sm:gap-3 min-w-0">
          {/* Badges & Metadata */}
          <div className="flex flex-col gap-1.5 min-w-0 flex-1">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap text-xs text-muted-foreground min-w-0">
              {isArchived ? (
                <Badge
                  variant="outline"
                  className="text-xs font-semibold px-2.5 py-0.5 bg-muted/60 text-muted-foreground border-border/80 print:border-black/30 print:text-black"
                >
                  <Archive className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                  Archived
                </Badge>
              ) : activity.is_take_home ? (
                <Badge
                  variant="outline"
                  className="text-xs font-semibold px-2.5 py-0.5 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300 border-brand-200/80 dark:border-brand-900 print:border-black/30 print:text-black"
                >
                  <Home
                    className="w-3.5 h-3.5 mr-1 text-brand-600 dark:text-brand-400 print:text-black"
                    aria-hidden="true"
                  />
                  Take-home Activity
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="text-xs font-semibold px-2.5 py-0.5 bg-brand-100/70 text-brand-800 dark:bg-brand-900/50 dark:text-brand-200 border-brand-200/70 dark:border-brand-800/80 print:border-black/30 print:text-black"
                >
                  <BookOpen
                    className="w-3.5 h-3.5 mr-1 text-brand-600 dark:text-brand-400 print:text-black"
                    aria-hidden="true"
                  />
                  In-Class Activity
                </Badge>
              )}

              <span className="inline-flex items-center text-[11px] font-medium text-muted-foreground bg-muted/40 dark:bg-muted/30 px-2 py-0.5 rounded-md border border-border/50 tabular-nums print:border-black/30 print:text-black">
                {wordCount} {wordCount === 1 ? "word" : "words"}
              </span>
            </div>

            <time
              dateTime={activity.created_at}
              className="text-xs text-muted-foreground inline-flex items-center gap-1 print:text-black"
            >
              <CalendarDays className="w-3.5 h-3.5" aria-hidden="true" />
              Created {formatDate(activity.created_at)}
            </time>
          </div>

          {/* Fast Action CTAs */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 self-start print:hidden">
            <Button
              size="sm"
              onClick={onUpload}
              className="h-10 sm:h-9 px-3 sm:px-3.5 bg-primary hover:bg-brand-700 text-primary-foreground text-xs sm:text-sm font-medium shadow-xs rounded-lg sm:rounded-xl cursor-pointer"
            >
              <Upload className="w-4 h-4 mr-1.5 shrink-0" />
              <span>Upload Worksheets</span>
              <kbd className="hidden sm:inline-flex items-center justify-center ml-2 px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground/90 bg-white/20 dark:bg-white/15 rounded border border-white/30 font-mono">
                U
              </kbd>
            </Button>

            {/* Options Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger
                className="inline-flex items-center justify-center size-10 sm:size-9 rounded-lg sm:rounded-xl border border-border bg-background hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-all cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="More activity options"
              >
                <MoreVertical className="w-4 h-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 z-50">
                <DropdownMenuItem
                  onClick={onCopyPrompt}
                  className="cursor-pointer text-xs flex items-center min-h-[44px] sm:min-h-[36px]"
                >
                  {hasCopiedPrompt ? (
                    <Check className="w-3.5 h-3.5 mr-2 text-primary stroke-[2.5]" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                  )}
                  <span>{hasCopiedPrompt ? "Prompt Copied!" : "Copy Prompt Text"}</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={onDuplicate}
                  className="cursor-pointer text-xs flex items-center min-h-[44px] sm:min-h-[36px]"
                >
                  <Copy className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                  <span>Duplicate Activity</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={onEdit}
                  className="cursor-pointer text-xs flex items-center min-h-[44px] sm:min-h-[36px]"
                >
                  <Edit3 className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                  <span>Edit Details</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={onToggleArchive}
                  className="cursor-pointer text-xs flex items-center min-h-[44px] sm:min-h-[36px]"
                >
                  {isArchived ? (
                    <>
                      <ArchiveRestore className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                      <span>Unarchive Activity</span>
                    </>
                  ) : (
                    <>
                      <Archive className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                      <span>Archive Activity</span>
                    </>
                  )}
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={onDelete}
                  className="cursor-pointer text-xs text-destructive hover:bg-destructive/10 focus:text-destructive focus:bg-destructive/10 flex items-center min-h-[44px] sm:min-h-[36px]"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                  <span>Delete Activity</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Hero Penmanship Prompt on Authentic 3-Line Cursive Ruling */}
        <div className="relative group/prompt">
          <div className="relative rounded-xl border border-border/80 bg-background/60 dark:bg-card/60 p-4 sm:p-5 shadow-warm-sm overflow-hidden">
            <div
              className="absolute inset-0 pointer-events-none opacity-25 dark:opacity-15 bg-[repeating-linear-gradient(0deg,transparent,transparent_47px,currentColor_48px)] text-brand-600 dark:text-brand-400"
              aria-hidden="true"
            />
            <p
              className={cn(
                "relative tracking-wide select-all break-words print:text-black",
                activity.target_text?.trim()
                  ? "font-cursive text-foreground/90 font-normal text-2xl sm:text-3xl lg:text-4xl leading-[48px]"
                  : "text-muted-foreground italic font-sans text-sm sm:text-base leading-normal py-3"
              )}
            >
              {activity.target_text?.trim() || "No target text specified"}
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Aggregate Bar: Class Roster Progress + Diagnostic Synthesis */}
      <div className="pt-3 border-t border-border/50 grid grid-cols-1 lg:grid-cols-2 gap-3.5 mt-4">
        {/* Left: Class Roster Completion */}
        <div className="flex flex-col justify-center gap-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5 flex-wrap">
              <GraduationCap
                className="size-4 text-brand-600 dark:text-brand-400 shrink-0"
                aria-hidden="true"
              />
              <span>
                <strong className="text-foreground font-semibold tabular-nums">
                  {uniqueStudentsCount}
                </strong>{" "}
                of{" "}
                <strong className="text-foreground font-semibold tabular-nums">
                  {totalStudents}
                </strong>{" "}
                enrolled students submitted
                {totalScansCount > uniqueStudentsCount && (
                  <span className="text-muted-foreground/80 font-normal">
                    {" "}
                    ({totalScansCount} total{" "}
                    {totalScansCount === 1 ? "scan" : "scans"})
                  </span>
                )}
              </span>
            </div>
            {totalStudents > 0 && (
              <Badge
                variant="outline"
                className="text-[11px] font-semibold px-2 py-0.5 bg-muted/60 text-foreground shrink-0 tabular-nums"
              >
                {completionRate}% complete
              </Badge>
            )}
          </div>

          {/* Progress bar or Empty Roster Prompt */}
          {totalStudents > 0 ? (
            <div
              className="w-full h-2 rounded-full bg-muted overflow-hidden"
              role="progressbar"
              aria-valuenow={completionRate}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuetext={`${uniqueStudentsCount} of ${totalStudents} students submitted (${completionRate}%)`}
              aria-label={`Class completion rate: ${completionRate}%`}
            >
              <div
                className="h-full bg-brand-600 dark:bg-brand-500 rounded-full transition-all duration-500 ease-out motion-reduce:transition-none"
                style={{
                  width: `${completionRate}%`,
                }}
              />
            </div>
          ) : (
            <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/20 px-2.5 py-1.5 rounded-lg border border-dashed border-border">
              <span className="text-[11px]">No students enrolled yet</span>
              <Link
                href="/roster"
                className="text-[11px] font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 inline-flex items-center gap-1 group/link focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                <span>Manage Roster</span>
                <ArrowRight className="size-3 transition-transform group-hover/link:translate-x-0.5 motion-reduce:transform-none" aria-hidden="true" />
              </Link>
            </div>
          )}
        </div>

        {/* Right: Class Diagnostic Synthesis (when completed scans exist) */}
        {classDiagnostics ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between lg:justify-end gap-2.5 bg-muted/25 dark:bg-muted/15 p-2.5 rounded-xl border border-border/60 text-xs">
            <div className="flex items-center gap-2">
              <BarChart3
                className="size-4 text-brand-600 dark:text-brand-400 shrink-0"
                aria-hidden="true"
              />
              <div>
                <span className="text-[11px] text-muted-foreground font-medium block">
                  Class Performance ({classDiagnostics.completedCount} scored)
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs font-semibold px-2 py-0.5",
                      classDiagnostics.scoreBand.className
                    )}
                  >
                    <span>{classDiagnostics.scoreBand.label}</span>
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Popover>
                <PopoverTrigger
                  className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] sm:min-h-[36px] text-xs font-medium rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="View class criteria breakdown"
                >
                  <BarChart3
                    className="size-3.5 text-brand-600 dark:text-brand-400"
                    aria-hidden="true"
                  />
                  <span>Class Breakdown</span>
                  <ChevronDown
                    className="size-3 opacity-60"
                    aria-hidden="true"
                  />
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  className="w-72 p-3.5 space-y-3 z-50 text-xs"
                >
                  <PopoverHeader>
                    <PopoverTitle className="text-xs font-semibold text-foreground flex items-center justify-between">
                      <span>5-Criterion Class Average</span>
                      <span className="text-primary font-bold tabular-nums">
                        {classDiagnostics.avgCompositeScore}%
                      </span>
                    </PopoverTitle>
                    <PopoverDescription className="sr-only">
                      Aggregated class diagnostic scores across Letter Formation, Size Consistency, Spacing, Slant, and Baseline Alignment.
                    </PopoverDescription>
                  </PopoverHeader>

                  <div className="space-y-2 pt-1">
                    <div>
                      <div className="flex justify-between text-[11px] mb-0.5 text-muted-foreground">
                        <span>Letter Formation</span>
                        <span className="font-medium tabular-nums text-foreground">
                          {classDiagnostics.criteriaAverages.letterFormation}%
                        </span>
                      </div>
                      <div
                        className="h-1.5 w-full bg-muted rounded-full overflow-hidden"
                        role="progressbar"
                        aria-valuenow={classDiagnostics.criteriaAverages.letterFormation}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Letter Formation class average: ${classDiagnostics.criteriaAverages.letterFormation}%`}
                      >
                        <div
                          className="h-full bg-brand-500 rounded-full transition-all duration-300 motion-reduce:transition-none"
                          style={{
                            width: `${classDiagnostics.criteriaAverages.letterFormation}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] mb-0.5 text-muted-foreground">
                        <span>Size Consistency</span>
                        <span className="font-medium tabular-nums text-foreground">
                          {classDiagnostics.criteriaAverages.sizeConsistency}%
                        </span>
                      </div>
                      <div
                        className="h-1.5 w-full bg-muted rounded-full overflow-hidden"
                        role="progressbar"
                        aria-valuenow={classDiagnostics.criteriaAverages.sizeConsistency}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Size Consistency class average: ${classDiagnostics.criteriaAverages.sizeConsistency}%`}
                      >
                        <div
                          className="h-full bg-brand-500 rounded-full transition-all duration-300 motion-reduce:transition-none"
                          style={{
                            width: `${classDiagnostics.criteriaAverages.sizeConsistency}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] mb-0.5 text-muted-foreground">
                        <span>Spacing</span>
                        <span className="font-medium tabular-nums text-foreground">
                          {classDiagnostics.criteriaAverages.spacing}%
                        </span>
                      </div>
                      <div
                        className="h-1.5 w-full bg-muted rounded-full overflow-hidden"
                        role="progressbar"
                        aria-valuenow={classDiagnostics.criteriaAverages.spacing}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Spacing class average: ${classDiagnostics.criteriaAverages.spacing}%`}
                      >
                        <div
                          className="h-full bg-brand-500 rounded-full transition-all duration-300 motion-reduce:transition-none"
                          style={{
                            width: `${classDiagnostics.criteriaAverages.spacing}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] mb-0.5 text-muted-foreground">
                        <span>Slant Consistency</span>
                        <span className="font-medium tabular-nums text-foreground">
                          {classDiagnostics.criteriaAverages.slant}%
                        </span>
                      </div>
                      <div
                        className="h-1.5 w-full bg-muted rounded-full overflow-hidden"
                        role="progressbar"
                        aria-valuenow={classDiagnostics.criteriaAverages.slant}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Slant Consistency class average: ${classDiagnostics.criteriaAverages.slant}%`}
                      >
                        <div
                          className="h-full bg-brand-500 rounded-full transition-all duration-300 motion-reduce:transition-none"
                          style={{
                            width: `${classDiagnostics.criteriaAverages.slant}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] mb-0.5 text-muted-foreground">
                        <span>Baseline Alignment</span>
                        <span className="font-medium tabular-nums text-foreground">
                          {classDiagnostics.criteriaAverages.baselineAlignment}%
                        </span>
                      </div>
                      <div
                        className="h-1.5 w-full bg-muted rounded-full overflow-hidden"
                        role="progressbar"
                        aria-valuenow={classDiagnostics.criteriaAverages.baselineAlignment}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Baseline Alignment class average: ${classDiagnostics.criteriaAverages.baselineAlignment}%`}
                      >
                        <div
                          className="h-full bg-brand-500 rounded-full transition-all duration-300 motion-reduce:transition-none"
                          style={{
                            width: `${classDiagnostics.criteriaAverages.baselineAlignment}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {classDiagnostics.strongestCriterion && (
                    <div className="pt-2 border-t border-border/60 text-[11px] space-y-1 text-muted-foreground">
                      <p>
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">
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
                          <span className="font-semibold text-amber-800 dark:text-amber-400">
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
          </div>
        ) : (
          <div className="flex items-center gap-2 p-2.5 rounded-xl border border-dashed border-border/80 text-xs text-muted-foreground bg-muted/10">
            <BarChart3
              className="size-4 text-muted-foreground/60 shrink-0"
              aria-hidden="true"
            />
            <span>
              Class diagnostic insights will unlock as student worksheets
              are scored.
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
