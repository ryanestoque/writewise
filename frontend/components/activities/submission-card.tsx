"use client";

import { memo, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import type { Submission } from "@/lib/hooks/use-submissions";
import { useSubmissionImageUrl } from "@/lib/hooks/use-submissions";
import {
  statusConfig,
  getRejectionSummary,
  resolveSubmissionScore,
} from "@/lib/utils/submission-status";
import { formatDate, getRelativeTime } from "@/lib/utils/formatters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { StudentWorkSummary } from "@/components/activities/student-work-summary";
import { WorkCommentsButton } from "@/components/comments/submission-comment-picker-sheet";
import { StudentWorkControls } from "@/components/submissions/submission-lifecycle-controls";
import type { ActivityWorkState } from "@/lib/hooks/use-activity-work";
import {
  AlertCircle,
  FileText,
  History,
  ChevronDown,
  Check,
  Camera,
  ArrowRight,
  Clock,
  Trash2,
  MoreHorizontal,
  MessageSquare,
  CalendarClock,
} from "lucide-react";

export interface SubmissionCardProps {
  compact?: boolean;
  submission: Submission;
  studentName: string;
  attemptCount?: number;
  allSubmissions?: Submission[];
  onSelect: (sub: Submission) => void;
  onReupload: (studentId?: string) => void;
  onSelectAttempt?: (studentId: string, sub: Submission) => void;
  isSelected?: boolean;
  isIndeterminate?: boolean;
  onToggleSelect?: (sub: Submission, allSubmissions?: Submission[]) => void;
  onDeleteSingleAttempt?: (sub: Submission) => void;
  onDeleteAllStudentAttempts?: (studentName: string, subs: Submission[]) => void;
  countedSubmissionId?: string | null;
  latestSubmission?: Submission;
  workSummary?: ReactNode;
  activityId?: string;
  workState?: ActivityWorkState | null;
  workLoading?: boolean;
  imageUrl?: string | null;
}

/**
 * Unified Submission Card Component
 * Accessible card with decoupled interactive regions and consolidated keyboard focus
 */
export const SubmissionCard = memo(function SubmissionCard({
  compact = false,
  submission,
  studentName,
  attemptCount = 1,
  allSubmissions = [],
  onSelect,
  onReupload,
  onSelectAttempt,
  isSelected = false,
  isIndeterminate = false,
  onToggleSelect,
  onDeleteSingleAttempt,
  onDeleteAllStudentAttempts,
  countedSubmissionId,
  latestSubmission,
  workSummary,
  activityId,
  workState,
  workLoading,
  imageUrl: propImageUrl,
}: SubmissionCardProps) {
  const { data: fetchedImageUrl } = useSubmissionImageUrl(
    compact || propImageUrl !== undefined ? null : submission.image_path
  );
  const imageUrl = propImageUrl !== undefined ? propImageUrl : fetchedImageUrl;
  const [imageError, setImageError] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  const config = statusConfig[submission.status];
  const resolvedScore = useMemo(() => resolveSubmissionScore(submission), [submission]);
  const compositeScore = resolvedScore.compositeScore;
  const scoreBand = resolvedScore.scoreBand;
  const rejection = getRejectionSummary(submission.rejection_code);
  const hasMultipleAttempts = attemptCount > 1 && allSubmissions.length > 1;

  const criteriaData = useMemo(() => {
    if (!resolvedScore.isScored) return null;
    const { letterFormation, sizeConsistency, spacing, slant, baselineAlignment } =
      resolvedScore.criteriaScores;
    const items = [
      { key: "formation", name: "Letter Formation", short: "Form", score: letterFormation },
      { key: "size", name: "Size Consistency", short: "Size", score: sizeConsistency },
      { key: "spacing", name: "Spacing", short: "Space", score: spacing },
      { key: "slant", name: "Slant", short: "Slant", score: slant },
      { key: "baseline", name: "Baseline Alignment", short: "Base", score: baselineAlignment },
    ];
    const hasAny = items.some((item) => item.score != null);
    if (!hasAny) return null;
    return items.map((item) => {
      const val = item.score;
      let band = "Unrated";
      let barClass = "bg-muted";
      if (val != null) {
        if (val >= 80) {
          band = "Excellent";
          barClass = "bg-band-4";
        } else if (val >= 60) {
          band = "Satisfactory";
          barClass = "bg-band-3";
        } else if (val >= 40) {
          band = "Developing";
          barClass = "bg-band-2";
        } else {
          band = "Needs Improvement";
          barClass = "bg-band-1";
        }
      }
      return { ...item, band, barClass };
    });
  }, [resolvedScore]);

  const currentAttemptIndex = useMemo(() => {
    if (!hasMultipleAttempts) return 1;
    const idx = allSubmissions.findIndex((s) => s.id === submission.id);
    return idx >= 0 ? attemptCount - idx : attemptCount;
  }, [hasMultipleAttempts, allSubmissions, submission.id, attemptCount]);

  const inspectActionLabel =
    submission.status === "completed"
      ? resolvedScore.isScored
        ? "View assessment"
        : "Score rubric"
      : "View worksheet";
  const accessibleLabel = useMemo(() => {
    let text = `${inspectActionLabel} for ${studentName}. Status: ${config.label}.`;
    if (submission.status === "completed") {
      if (resolvedScore.isScored && compositeScore !== null) {
        const sourceLabel =
          resolvedScore.source === "manual" ? "manual teacher rubric" : "calibrated";
        text += ` Diagnostic composite score: ${Math.round(compositeScore)} percent (${sourceLabel}), rated ${scoreBand.band}.`;
      } else {
        text += ` Worksheet processed. Pending teacher rubric scoring.`;
      }
    } else if (submission.status === "rejected") {
      text += ` Submission rejected: ${rejection.label}. ${rejection.detail}.`;
    }
    if (hasMultipleAttempts) {
      text += ` Attempt ${currentAttemptIndex} of ${attemptCount} total attempts.`;
      if (countedSubmissionId !== undefined) {
        text +=
          submission.id === countedSubmissionId
            ? " This is the official attempt."
            : " This is a past attempt.";
      }
    }
    return text;
  }, [
    inspectActionLabel,
    studentName,
    config.label,
    submission.id,
    submission.status,
    resolvedScore.isScored,
    resolvedScore.source,
    compositeScore,
    scoreBand.band,
    rejection,
    hasMultipleAttempts,
    currentAttemptIndex,
    attemptCount,
    countedSubmissionId,
  ]);

  const showImage = Boolean(imageUrl && !imageError);

  const renderedWorkSummary =
    workSummary ??
    (activityId ? (
      <StudentWorkSummary
        activityId={activityId}
        studentId={submission.student_id}
        studentName={studentName}
        state={workState ?? null}
        attempts={allSubmissions}
        isLoading={Boolean(workLoading)}
        compact={true}
        isScored={resolvedScore.isScored}
      />
    ) : null);

  const attemptMenu = hasMultipleAttempts && (
    <div className={compact ? "mr-auto" : "absolute top-2.5 left-2.5 z-20"}>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="bg-background/95 text-foreground dark:bg-card/95 border-border hover:bg-background focus-visible:ring-ring relative inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-xs backdrop-blur-xs transition-colors focus-visible:ring-2 focus-visible:outline-hidden sm:px-2.5 sm:py-1 md:min-h-[36px]"
          aria-label={`Switch submission attempt for ${studentName}. Currently showing attempt ${currentAttemptIndex} of ${attemptCount}.`}
        >
          <History className="text-muted-foreground size-3" aria-hidden="true" />
          <span>{attemptCount} Attempts</span>
          <ChevronDown className="size-3 opacity-60" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="z-50 w-64">
          <div className="text-muted-foreground px-2.5 py-1.5 text-xs font-medium">
            Submission History ({attemptCount} attempts)
          </div>
          <DropdownMenuSeparator />
          <div className="space-y-0.5 p-1">
            {allSubmissions.map((sub, idx) => {
              const attemptNum = attemptCount - idx;
              const isCurrent = sub.id === submission.id;
              const isLatest = idx === 0;
              const subConfig = statusConfig[sub.status];

              return (
                <DropdownMenuItem
                  key={sub.id}
                  onClick={() => onSelectAttempt?.(submission.student_id, sub)}
                  className={cn(
                    "flex min-h-11 min-w-0 cursor-pointer items-center justify-between gap-2 px-2.5 py-1.5 text-xs md:min-h-9",
                    isCurrent && "bg-primary/10 text-primary font-medium"
                  )}
                >
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span
                      className={`size-1.5 shrink-0 rounded-full ${subConfig.dotClass}`}
                      aria-hidden="true"
                    />
                    <span className="truncate">
                      Attempt {attemptNum}{" "}
                      {sub.id === countedSubmissionId ? "(Official)" : isLatest ? "(Newest)" : ""}
                    </span>
                  </div>
                  <div className="text-muted-foreground flex shrink-0 items-center gap-1.5">
                    <span className="text-xs tabular-nums">
                      {getRelativeTime(sub.created_at)}
                    </span>
                    {isCurrent && (
                      <Check className="text-primary size-3.5 stroke-[2.5]" aria-hidden="true" />
                    )}
                  </div>
                </DropdownMenuItem>
              );
            })}
          </div>

          {(onDeleteSingleAttempt || onDeleteAllStudentAttempts) && (
            <>
              <DropdownMenuSeparator />
              {onDeleteSingleAttempt && (
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => onDeleteSingleAttempt(submission)}
                  className="text-destructive focus:text-destructive focus:bg-destructive/10 flex min-h-11 cursor-pointer items-center gap-2 px-2.5 py-2 text-xs md:min-h-9"
                >
                  <Trash2 className="size-3.5 shrink-0" aria-hidden="true" />
                  <span>Delete displayed attempt (Attempt {currentAttemptIndex})</span>
                </DropdownMenuItem>
              )}
              {onDeleteAllStudentAttempts && allSubmissions.length > 1 && (
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => onDeleteAllStudentAttempts(studentName, allSubmissions)}
                  className="text-destructive focus:text-destructive focus:bg-destructive/10 flex min-h-11 cursor-pointer items-center gap-2 px-2.5 py-2 text-xs md:min-h-9"
                >
                  <Trash2 className="size-3.5 shrink-0" aria-hidden="true" />
                  <span>Delete all {attemptCount} attempts</span>
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
  const selectionControl = onToggleSelect && (
    <div
      className={compact ? "ml-auto" : "absolute right-2.5 bottom-2.5 z-20"}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className={cn(
          "inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-lg p-2 shadow-2xs backdrop-blur-xs transition-all",
          isSelected
            ? "bg-background/95 dark:bg-card/95"
            : "bg-background/85 dark:bg-card/85 hover:bg-background opacity-85 group-hover:opacity-100 hover:opacity-100"
        )}
      >
        <Checkbox
          id={`select-attempt-${submission.id}`}
          checked={isSelected}
          indeterminate={isIndeterminate}
          onCheckedChange={() => onToggleSelect(submission)}
          aria-label={`Select displayed attempt to delete for ${studentName}`}
          className="size-4"
        />
        <label
          htmlFor={`select-attempt-${submission.id}`}
          className="text-foreground cursor-pointer text-xs select-none"
        >
          Delete attempt
        </label>
      </div>
    </div>
  );
  const studentIdentity = (
    <>
      <h3 className="text-foreground text-sm font-semibold break-words" title={studentName}>
        {studentName}
      </h3>

      {countedSubmissionId !== undefined && submission.id !== countedSubmissionId && (
        <span className="inline-flex items-center gap-1.5 mt-1 text-xs font-medium text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-900/50">
          <History className="size-3 shrink-0" aria-hidden="true" />
          <span>Viewing past attempt (not official)</span>
        </span>
      )}
      {hasMultipleAttempts && countedSubmissionId !== undefined && submission.id === countedSubmissionId && (
        <span className="inline-flex items-center gap-1 mt-1 text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-900/50">
          <Check className="size-3 shrink-0" aria-hidden="true" />
          <span>Official Attempt</span>
        </span>
      )}
    </>
  );
  const scoreSummary = (
    <>
      {submission.status === "completed" && (
        <div className="mt-1.5 flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger
                type="button"
                className={cn(
                  "focus-visible:ring-ring inline-flex min-h-11 cursor-help items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold transition-all focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-hidden md:min-h-9",
                  !resolvedScore.isScored
                    ? "border-amber-300/80 bg-amber-50/80 text-amber-900 dark:border-amber-800/80 dark:bg-amber-950/40 dark:text-amber-200"
                    : scoreBand.className
                )}
                aria-label={
                  !resolvedScore.isScored
                    ? "Pending teacher rubric evaluation"
                    : `Diagnostic score: ${scoreBand.label}. ${scoreBand.band} Penmanship: ${scoreBand.description}`
                }
              >
                <span
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    !resolvedScore.isScored ? "bg-amber-600 dark:bg-amber-400" : scoreBand.dotColor
                  )}
                  aria-hidden="true"
                />
                <span>{!resolvedScore.isScored ? "Needs Rubric Scoring" : scoreBand.label}</span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                <p className="font-semibold">
                  {!resolvedScore.isScored
                    ? "Teacher Rubric Required"
                    : `${scoreBand.band} Penmanship ${resolvedScore.source === "manual" ? "(Teacher Rubric)" : ""}`}
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {!resolvedScore.isScored
                    ? "Worksheet processed by OpenCV/CNN. Click Score rubric to grade handwriting criteria."
                    : scoreBand.description}
                </p>
              </TooltipContent>
            </Tooltip>
            {resolvedScore.isScored && (
              <span className="text-muted-foreground text-xs">
                {resolvedScore.source === "manual" ? "Teacher rubric" : "Calibrated"}
              </span>
            )}
          </div>

          {criteriaData && (
            <div className="mt-1 flex flex-col gap-1 w-full max-w-[210px]">
              <Popover>
                <PopoverTrigger
                  type="button"
                  className="group/crit flex flex-col gap-1 w-full rounded-md p-1.5 min-h-[40px] md:min-h-[36px] hover:bg-muted/60 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden text-left cursor-pointer border border-transparent hover:border-border/60"
                  aria-label={`Diagnostic criteria breakdown: ${criteriaData
                    .map((c) => `${c.name}: ${c.score != null ? `${Math.round(c.score)}% (${c.band})` : "Unrated"}`)
                    .join(", ")}. Tap to view full breakdown.`}
                >
                  <div className="flex h-3 w-full items-center gap-1 rounded-sm bg-muted/80 p-0.5">
                    {criteriaData.map((c) => (
                      <span
                        key={c.key}
                        className={cn("block h-full flex-1 rounded-2xs transition-transform group-hover/crit:scale-y-110", c.barClass)}
                      />
                    ))}
                  </div>
                  <div className="flex w-full justify-between text-xs text-muted-foreground/85 px-0.5 font-medium tracking-tight" aria-hidden="true">
                    {criteriaData.map((c) => (
                      <span key={c.key} title={c.name}>{c.short}</span>
                    ))}
                  </div>
                </PopoverTrigger>
                <PopoverContent side="top" align="start" className="w-64 p-3 text-xs shadow-md">
                  <div className="flex items-center justify-between border-b pb-1.5 mb-2">
                    <p className="font-semibold text-foreground">5-Criteria Breakdown</p>
                    {resolvedScore.isScored && compositeScore !== null && (
                      <span className={cn("text-xs font-bold px-1.5 py-0.5 rounded", scoreBand.className)}>
                        {Math.round(compositeScore)}%
                      </span>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {criteriaData.map((c) => (
                      <div key={c.key} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <span className={cn("size-2 rounded-full", c.barClass)} aria-hidden="true" />
                          {c.name}
                        </span>
                        <span className="font-semibold tabular-nums text-foreground">
                          {c.score != null ? `${Math.round(c.score)}% (${c.band})` : "Pending"}
                        </span>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
      )}

      {submission.status === "rejected" && (
        <div className="mt-1 space-y-0.5">
          <p className="text-destructive flex items-center gap-1 truncate text-xs font-medium">
            <AlertCircle className="size-3 shrink-0" aria-hidden="true" />
            <span>{rejection.label}</span>
          </p>
          <p className="text-muted-foreground line-clamp-1 text-xs">{rejection.detail}</p>
        </div>
      )}

      {submission.status === "processing" && (
        <p className="text-warning-foreground mt-1 flex items-center gap-1 truncate text-xs font-medium">
          <Clock
            className="text-warning size-3 shrink-0 motion-safe:animate-pulse"
            aria-hidden="true"
          />
          <span>Analyzing cursive strokes…</span>
        </p>
      )}
    </>
  );
  const newestUpload = latestSubmission && latestSubmission.id !== submission.id && (
    <div className="border-border flex flex-col gap-1 border-t pt-2 text-xs">
      <span className="text-muted-foreground">
        Newest upload: {statusConfig[latestSubmission.status].label}
      </span>
      <Button
        variant="link"
        size="sm"
        className="min-h-11 justify-start px-0 md:min-h-9"
        onClick={() => onSelect(latestSubmission)}
        aria-label={`View newest upload for ${studentName}`}
      >
        View newest upload
      </Button>
    </div>
  );
  const inspectAction =
    submission.status === "rejected" ? (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onReupload(submission.student_id)}
        aria-label={`Re-upload worksheet for ${studentName}. Rejection reason: ${rejection.label}.`}
        className="text-primary hover:text-primary/90 hover:bg-primary/10 focus-visible:ring-ring h-10 min-h-[44px] cursor-pointer gap-1.5 rounded-lg px-3 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-hidden md:h-9 md:px-2.5 md:min-h-[36px]"
      >
        <Camera className="size-3.5" aria-hidden="true" />
        <span>Re-upload</span>
      </Button>
    ) : (
      <Button
        variant={!resolvedScore.isScored && submission.status === "completed" ? "default" : "ghost"}
        size="sm"
        onClick={() => onSelect(submission)}
        aria-label={accessibleLabel}
        className={cn(
          "focus-visible:ring-ring h-10 min-h-[44px] cursor-pointer gap-1.5 rounded-lg px-3 text-xs focus-visible:ring-2 focus-visible:outline-hidden md:h-9 md:px-2.5 md:min-h-[36px]",
          !resolvedScore.isScored && submission.status === "completed"
            ? "bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-xs"
            : "text-primary hover:text-primary/90 hover:bg-primary/10 group/btn font-medium"
        )}
      >
        <span>{inspectActionLabel}</span>
        <ArrowRight
          className="size-3.5 transition-transform group-hover/btn:translate-x-0.5 motion-reduce:transform-none"
          aria-hidden="true"
        />
      </Button>
    );
  const rejectedWorksheetAction = submission.status === "rejected" && (
    <Button
      variant="ghost"
      size="sm"
      className="min-h-11 md:min-h-9"
      onClick={() => onSelect(submission)}
      aria-label={`View worksheet for ${studentName}. Upload rejected.`}
    >
      View worksheet
    </Button>
  );
  const timestamp = (
    <time
      dateTime={submission.created_at}
      title={formatDate(submission.created_at)}
      className="text-muted-foreground text-xs tabular-nums"
    >
      {getRelativeTime(submission.created_at)}
    </time>
  );

  const cardOverflowMenu = activityId && (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-11 min-h-[44px] min-w-[44px] md:size-8 md:min-h-[32px] md:min-w-[32px] text-muted-foreground hover:text-foreground hover:bg-muted/60 cursor-pointer rounded-lg shrink-0"
            aria-label={`More actions for ${studentName}`}
          />
        }
      >
        <MoreHorizontal className="size-4" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 text-xs">
        {allSubmissions.length > 0 && (
          <DropdownMenuItem
            onClick={() => setCommentsOpen(true)}
            className="min-h-9 cursor-pointer gap-2"
          >
            <MessageSquare className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <span>Private comments</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={() => setDeadlineOpen(true)}
          disabled={!workState}
          className="min-h-9 cursor-pointer gap-2"
        >
          <CalendarClock className="size-3.5 text-muted-foreground" aria-hidden="true" />
          <span>Deadline & attempt</span>
        </DropdownMenuItem>
        {hasMultipleAttempts && (
          <>
            <DropdownMenuSeparator />
            {onDeleteSingleAttempt && (
              <DropdownMenuItem
                onClick={() => onDeleteSingleAttempt(submission)}
                className="text-destructive focus:text-destructive focus:bg-destructive/10 min-h-9 cursor-pointer gap-2"
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
                <span>Delete displayed attempt</span>
              </DropdownMenuItem>
            )}
            {onDeleteAllStudentAttempts && (
              <DropdownMenuItem
                onClick={() => onDeleteAllStudentAttempts(studentName, allSubmissions)}
                className="text-destructive focus:text-destructive focus:bg-destructive/10 min-h-9 cursor-pointer gap-2"
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
                <span>Delete all {attemptCount} attempts</span>
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const controlledDialogs = activityId && (
    <>
      <WorkCommentsButton
        scope={{ activityId, studentId: submission.student_id }}
        activeSubmissionId={workState?.active_submission_id ?? null}
        studentName={studentName}
        open={commentsOpen}
        onOpenChange={setCommentsOpen}
        showTrigger={false}
      />
      <StudentWorkControls
        activityId={activityId}
        studentId={submission.student_id}
        studentName={studentName}
        state={workState ?? null}
        attempts={allSubmissions}
        open={deadlineOpen}
        onOpenChange={setDeadlineOpen}
        showTrigger={false}
      />
    </>
  );

  return (
    <article
      className={cn(
        "group bg-surface dark:bg-card relative min-w-0 rounded-xl border text-left",
        isSelected || isIndeterminate ? "border-primary ring-primary/25 ring-2" : "border-border",
        compact
          ? "flex flex-col gap-3 p-3 sm:p-4 lg:grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,.85fr)_minmax(0,1.2fr)_auto] lg:items-center lg:gap-4"
          : "flex flex-col overflow-hidden h-full"
      )}
    >
      {compact ? (
        <>
          <div className="min-w-0">
            <div className="flex items-start justify-between gap-2 lg:block">
              <div className="min-w-0">{studentIdentity}</div>
              <div className="flex items-center gap-1 shrink-0 lg:hidden">
                {inspectAction}
                {cardOverflowMenu}
              </div>
            </div>
            <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              {attemptMenu}
              {timestamp}
            </div>
          </div>
          <div className="min-w-0">
            {scoreSummary}
            {newestUpload}
          </div>
          {renderedWorkSummary && <div className="min-w-0">{renderedWorkSummary}</div>}
          <div
            className={cn(
              "flex flex-wrap items-center justify-between gap-2 lg:justify-end",
              !onToggleSelect && submission.status !== "rejected" && "hidden lg:flex"
            )}
          >
            {selectionControl}
            {rejectedWorksheetAction}
            <div className="hidden lg:flex items-center gap-1.5">
              {inspectAction}
              {cardOverflowMenu}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="bg-muted/40 relative flex aspect-4/3 items-center justify-center overflow-hidden border-b">
            <button
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              onClick={() => onSelect(submission)}
              className={cn(
                "focus-visible:ring-ring flex cursor-pointer items-center justify-center select-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-hidden",
                compact
                  ? "relative size-12 shrink-0 overflow-hidden rounded-md"
                  : "absolute inset-0 z-0 size-full"
              )}
            >
              {showImage ? (
                <Image
                  src={imageUrl ?? ""}
                  alt={`Handwriting worksheet for ${studentName}`}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 320px"
                  loading="lazy"
                  onError={() => setImageError(true)}
                  className="drop-shadow-2xs pointer-events-none size-full object-contain p-2 transition-transform duration-200 group-hover:scale-[1.02] motion-reduce:transform-none"
                />
              ) : (
                <div className="text-muted-foreground pointer-events-none flex size-full flex-col items-center justify-center gap-1.5 p-4">
                  <FileText className="size-8 stroke-[1.5]" aria-hidden="true" />
                  {!compact && (
                    <span className="text-xs font-medium tracking-tight">
                      Worksheet preview
                    </span>
                  )}
                </div>
              )}
            </button>
            {attemptMenu}
            {selectionControl}
            {submission.uploader_role === "parent" && (
              <Badge variant="secondary" className="pointer-events-none absolute bottom-3 left-3">
                Parent upload
              </Badge>
            )}
          </div>
          <div className="flex flex-1 flex-col gap-3 p-4">
            <div>{studentIdentity}</div>
            <div>{scoreSummary}</div>
            {newestUpload}
            <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t pt-2">
              <div className="flex items-center gap-1">
                {timestamp}
                {cardOverflowMenu}
              </div>
              <div className="flex items-center gap-1.5">
                {rejectedWorksheetAction}
                {inspectAction}
              </div>
            </div>
          </div>
          {renderedWorkSummary && <div className="border-t p-3">{renderedWorkSummary}</div>}
        </>
      )}
      {controlledDialogs}
    </article>
  );
});
