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
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
} from "@/components/ui/popover";
import { getCriterionBandStyle } from "@/components/activities/activity-detail-hero";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ActivityWorkStatus } from "@/components/activities/activity-work-status";
import { StudentWorkSummary } from "@/components/activities/student-work-summary";
import { WorksheetHistory } from "@/components/activities/worksheet-history";
import { WorkCommentsButton } from "@/components/comments/submission-comment-picker-sheet";
import { StudentWorkControls } from "@/components/submissions/submission-lifecycle-controls";
import type { ActivityWorkState } from "@/lib/hooks/use-activity-work";
import {
  AlertCircle,
  FileText,
  History,
  Camera,
  ArrowRight,
  Trash2,
  MoreHorizontal,
  MessageSquare,
  CalendarClock,
  Upload,
  ChevronDown,
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
  batchManaged?: boolean;
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
  batchManaged = false,
}: SubmissionCardProps) {
  const { data: fetchedImageUrl } = useSubmissionImageUrl(
    compact || batchManaged || propImageUrl !== undefined ? null : submission.image_path
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
  const isLatestSubmission = useMemo(() => {
    if (!latestSubmission) return true;
    return latestSubmission.id === submission.id;
  }, [latestSubmission, submission.id]);

  const criteriaData = useMemo(() => {
    if (!resolvedScore.isScored) return null;
    const { letterFormation, sizeConsistency, spacing, slant, baselineAlignment } =
      resolvedScore.criteriaScores;
    const items = [
      { key: "formation", name: "Letter Formation", short: "Form", score: letterFormation },
      { key: "size", name: "Size Consistency", short: "Size", score: sizeConsistency },
      { key: "spacing", name: "Spacing", short: "Space", score: spacing },
      { key: "slant", name: "Slant Consistency", short: "Slant", score: slant },
      { key: "baseline", name: "Baseline Alignment", short: "Base", score: baselineAlignment },
    ];
    const hasAny = items.some((item) => item.score != null);
    if (!hasAny) return null;
    return items.map((item) => {
      const val = item.score;
      if (val != null) {
        const { band, barClass, textClass, dotClass } = getCriterionBandStyle(val);
        return { ...item, band, barClass, textClass, dotClass };
      }
      return {
        ...item,
        band: "Unrated",
        barClass: "bg-muted",
        textClass: "text-muted-foreground",
        dotClass: "bg-muted",
      };
    });
  }, [resolvedScore]);

  const { strongestCriterion, focusCriterion } = useMemo(() => {
    if (!criteriaData) return { strongestCriterion: null, focusCriterion: null };
    const valid = criteriaData.filter((c) => c.score != null);
    if (valid.length === 0) return { strongestCriterion: null, focusCriterion: null };
    const sorted = [...valid].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const strongest = sorted[0];
    const lowest = sorted.length > 1 ? sorted[sorted.length - 1] : null;
    const focus =
      lowest && ((lowest.score ?? 0) < 80 || (strongest.score ?? 0) - (lowest.score ?? 0) >= 10)
        ? lowest
        : null;
    return { strongestCriterion: strongest, focusCriterion: focus };
  }, [criteriaData]);

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
        hideDraftPending={submission.status === "completed" && !resolvedScore.isScored}
      />
    ) : null);

  const attemptHistoryTrigger = hasMultipleAttempts && activityId && (
    <div className={compact ? "inline-flex items-center" : "absolute top-2.5 left-2.5 z-20"}>
      <WorksheetHistory
        activityId={activityId}
        studentName={studentName}
        attempts={allSubmissions}
        officialId={countedSubmissionId ?? null}
        onSelectAttempt={onSelectAttempt ? (sub) => onSelectAttempt(submission.student_id, sub) : undefined}
        trigger={
          compact ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="h-auto px-1 py-0.5 text-xs font-medium text-foreground hover:bg-transparent hover:text-primary"
              aria-label={`View attempt history for ${studentName}. Attempt ${currentAttemptIndex} of ${attemptCount}.`}
            >
              <History data-icon="inline-start" className="text-muted-foreground" aria-hidden="true" />
              <span>Attempt {currentAttemptIndex} of {attemptCount}</span>
              <ChevronDown data-icon="inline-end" className="text-muted-foreground" aria-hidden="true" />
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="xs"
              className="relative h-auto rounded-full border-border/80 bg-background/90 px-2.5 py-1 text-xs font-medium text-foreground shadow-2xs backdrop-blur-xs hover:bg-background"
              aria-label={`View attempt history for ${studentName}. Attempt ${currentAttemptIndex} of ${attemptCount}.`}
            >
              <History data-icon="inline-start" className="text-muted-foreground" aria-hidden="true" />
              <span>Attempt {currentAttemptIndex} of {attemptCount}</span>
              <ChevronDown data-icon="inline-end" className="text-muted-foreground" aria-hidden="true" />
            </Button>
          )
        }
      />
    </div>
  );
  const selectionControl = onToggleSelect && (
    <div
      className={compact ? "ml-auto" : "absolute right-2.5 bottom-2.5 z-20"}
      onClick={(e) => e.stopPropagation()}
    >
      <Field
        orientation="horizontal"
        className={cn(
          "w-auto min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg p-2 shadow-2xs backdrop-blur-xs transition-all",
          isSelected
            ? "bg-card/95"
            : "bg-card/85 hover:bg-card opacity-85 group-hover:opacity-100 hover:opacity-100"
        )}
      >
        <Checkbox
          id={`select-attempt-${submission.id}`}
          checked={isSelected}
          indeterminate={isIndeterminate}
          onCheckedChange={() => onToggleSelect(submission)}
          aria-label={`Select worksheet attempt for ${studentName}`}
        />
        <FieldLabel
          htmlFor={`select-attempt-${submission.id}`}
          className="text-foreground cursor-pointer text-xs select-none font-medium"
        >
          Select attempt
        </FieldLabel>
      </Field>
    </div>
  );
  const studentIdentity = (
    <div className="flex flex-col gap-1 min-w-0">
      <div className="flex items-center gap-2 min-w-0">
        <h3
          className="text-foreground text-sm font-semibold sm:text-base leading-snug truncate min-w-0"
          title={studentName}
        >
          {studentName}
        </h3>
        {compact && renderedWorkSummary && (
          <div className="shrink-0">{renderedWorkSummary}</div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
        {compact ? (
          <>
            {attemptHistoryTrigger ? (
              <>
                {attemptHistoryTrigger}
                <span className="text-muted-foreground/40 select-none" aria-hidden="true">·</span>
              </>
            ) : hasMultipleAttempts ? (
              <>
                <span>Attempt {currentAttemptIndex} of {attemptCount}</span>
                <span className="text-muted-foreground/40 select-none" aria-hidden="true">·</span>
              </>
            ) : null}
            {submission.uploader_role === "parent" && (
              <>
                <Badge variant="secondary">Parent upload</Badge>
                <span className="text-muted-foreground/40 select-none" aria-hidden="true">·</span>
              </>
            )}
            <time
              dateTime={submission.created_at}
              title={formatDate(submission.created_at)}
              className="tabular-nums"
            >
              {getRelativeTime(submission.created_at)}
            </time>
          </>
        ) : (
          <>
            <time
              dateTime={submission.created_at}
              title={formatDate(submission.created_at)}
              className="tabular-nums"
            >
              {getRelativeTime(submission.created_at)}
            </time>
            {renderedWorkSummary && (
              <>
                <span className="text-muted-foreground/40 select-none" aria-hidden="true">·</span>
                {renderedWorkSummary}
              </>
            )}
            {hasMultipleAttempts && !attemptHistoryTrigger && (
              <>
                <span className="text-muted-foreground/40 select-none" aria-hidden="true">·</span>
                <span>Attempt {currentAttemptIndex} of {attemptCount}</span>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
  const scoreSummary = (
    <>
      {submission.status === "completed" && (
        <div className="mt-1 flex flex-col gap-1.5">
          {!resolvedScore.isScored ? (
            <div className="flex items-center gap-2 py-1">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      className="h-auto px-1 py-0.5 cursor-help text-xs font-medium text-band-2-text hover:bg-transparent hover:opacity-80"
                      aria-label="Worksheet processed. Pending teacher rubric score."
                    />
                  }
                >
                  <span className="size-2 shrink-0 rounded-full bg-warning" aria-hidden="true" />
                  <span>Worksheet Analyzed · Needs Rubric</span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs">
                  <p className="font-semibold text-foreground">Penmanship Analysis Complete</p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Handwriting lines and cursive strokes have been measured. Click &quot;Score rubric&quot; to review diagnostic details and enter your teacher rubric.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 w-full">
              <Popover>
                <PopoverTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      className="group/crit flex h-auto min-h-11 w-full flex-col items-stretch gap-1.5 rounded-lg border-border/60 p-2 text-left whitespace-normal hover:border-border hover:bg-muted/50"
                      aria-label={`Diagnostic score: ${compositeScore !== null ? Math.round(compositeScore) : 0}% (${scoreBand.band}). ${criteriaData ? criteriaData.map((c) => `${c.name}: ${c.score != null ? `${Math.round(c.score)}% (${c.band})` : "Unrated"}`).join(", ") : ""}. Tap to view full breakdown.`}
                    />
                  }
                >
                  <div className="flex items-baseline justify-between gap-2 w-full">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold tabular-nums text-foreground">
                        {compositeScore !== null ? `${Math.round(compositeScore)}%` : "—"}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className={cn("size-2 rounded-full shrink-0", scoreBand.dotColor)} aria-hidden="true" />
                        <span className="text-foreground/90 font-medium">{scoreBand.band}</span>
                      </span>
                    </div>
                    {resolvedScore.source === "manual" && (
                      <span className="text-[11px] text-muted-foreground/75 font-normal">
                        Teacher rubric
                      </span>
                    )}
                  </div>

                  {criteriaData && (
                    <>
                      <div className="flex h-2 w-full items-center gap-1 rounded-xs bg-muted/80 p-0.5">
                        {criteriaData.map((c) => (
                          <span
                            key={c.key}
                            className={cn("block h-full flex-1 rounded-2xs transition-transform group-hover/crit:scale-y-110", c.barClass)}
                          />
                        ))}
                      </div>
                      <div className="flex w-full justify-between text-[11px] text-muted-foreground/80 px-0.5 font-medium tracking-tight" aria-hidden="true">
                        {criteriaData.map((c) => (
                          <span key={c.key} title={c.name}>{c.short}</span>
                        ))}
                      </div>
                    </>
                  )}
                </PopoverTrigger>
                <PopoverContent
                  align={compact ? "start" : "end"}
                  className="w-[min(calc(100vw-2rem),21rem)] gap-2.5 p-3.5 text-xs"
                >
                  <PopoverHeader className="flex flex-col gap-1">
                    <PopoverTitle className="text-foreground flex items-center justify-between text-xs font-semibold">
                      <span>5-Criteria Diagnostic</span>
                      <span className="text-primary font-bold tabular-nums">
                        {compositeScore !== null ? `${Math.round(compositeScore)}%` : "—"}
                      </span>
                    </PopoverTitle>
                    {scoreBand.description && (
                      <p className="text-muted-foreground text-[11px] leading-relaxed">
                        {scoreBand.description}
                      </p>
                    )}
                    {resolvedScore.source === "manual" && (
                      <p className="text-muted-foreground text-[11px]">
                        Based on teacher rubric scores
                      </p>
                    )}
                    <PopoverDescription className="sr-only">
                      Diagnostic scores across Letter Formation, Size Consistency, Spacing, Slant Consistency, and Baseline Alignment for {studentName}.
                    </PopoverDescription>
                  </PopoverHeader>

                  {criteriaData && (
                    <div className="flex flex-col gap-2">
                      {criteriaData.map((c) => {
                        const score = c.score ?? 0;
                        return (
                          <div key={c.key}>
                            <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                              <span className="text-muted-foreground min-w-0 truncate">{c.name}</span>
                              <div className="flex shrink-0 items-center gap-1.5">
                                <span className={cn("text-[11px] font-medium", c.textClass)}>
                                  {c.band}
                                </span>
                                <span className="text-foreground font-medium tabular-nums">
                                  {c.score != null ? `${Math.round(c.score)}%` : "—"}
                                </span>
                              </div>
                            </div>
                            <Progress
                              value={Math.max(0, Math.min(100, score))}
                              aria-label={
                                c.score != null
                                  ? `${c.name}: ${Math.round(c.score)}% (${c.band})`
                                  : `${c.name}: Unrated`
                              }
                              className="gap-0"
                              trackClassName="bg-muted/80 h-1.5"
                              indicatorClassName={cn(
                                "rounded-full motion-reduce:transition-none",
                                c.barClass
                              )}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {(strongestCriterion || focusCriterion) && (
                    <>
                      <Separator />
                      <div className="text-muted-foreground flex flex-col gap-1.5 text-xs">
                        {strongestCriterion && (
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className={cn(
                                  "size-1.5 shrink-0 rounded-full",
                                  strongestCriterion.dotClass
                                )}
                                aria-hidden="true"
                              />
                              <span
                                className={cn(
                                  strongestCriterion.textClass,
                                  "font-semibold shrink-0"
                                )}
                              >
                                Strength:
                              </span>
                              <span className="truncate">{strongestCriterion.name}</span>
                            </div>
                            <span className="text-foreground font-medium tabular-nums shrink-0">
                              {strongestCriterion.score != null ? `${Math.round(strongestCriterion.score)}%` : "—"}
                            </span>
                          </div>
                        )}
                        {focusCriterion && (
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className={cn(
                                  "size-1.5 shrink-0 rounded-full",
                                  focusCriterion.dotClass
                                )}
                                aria-hidden="true"
                              />
                              <span
                                className={cn(
                                  focusCriterion.textClass,
                                  "font-semibold shrink-0"
                                )}
                              >
                                Practice Focus:
                              </span>
                              <span className="truncate">{focusCriterion.name}</span>
                            </div>
                            <span className="text-foreground font-medium tabular-nums shrink-0">
                              {focusCriterion.score != null ? `${Math.round(focusCriterion.score)}%` : "—"}
                            </span>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
      )}

      {submission.status === "rejected" && (
        <Alert
          variant={isLatestSubmission ? "destructive" : "default"}
          className={cn(
            "mt-2 px-3 py-2.5 text-xs has-data-[slot=alert-action]:pr-24",
            !isLatestSubmission && "bg-muted/30"
          )}
        >
          <AlertCircle
            className={!isLatestSubmission ? "text-muted-foreground" : undefined}
            aria-hidden="true"
          />
          <AlertTitle
            className={cn(
              "text-xs font-semibold",
              !isLatestSubmission && "text-foreground/80"
            )}
          >
            {rejection.label}
          </AlertTitle>
          <AlertDescription className="text-[11px] leading-relaxed">
            {rejection.detail}
          </AlertDescription>
          {!isLatestSubmission && latestSubmission && (
            <AlertAction className="top-2 right-2.5">
              <Button
                type="button"
                variant="link"
                size="xs"
                onClick={() => onSelect(latestSubmission)}
                className="h-auto px-0 py-0 text-[11px] font-medium"
                aria-label={`Switch to newest upload for ${studentName}`}
              >
                <span>View latest</span>
                <ArrowRight data-icon="inline-end" aria-hidden="true" />
              </Button>
            </AlertAction>
          )}
        </Alert>
      )}

      {submission.status === "processing" && (
        <p className="text-band-2-text mt-1 flex items-center gap-1.5 truncate text-xs font-medium">
          <Spinner className="text-warning size-3.5 shrink-0" />
          <span>Analyzing cursive strokes…</span>
        </p>
      )}
    </>
  );
  const newestUpload = latestSubmission && latestSubmission.id !== submission.id && submission.status !== "rejected" && (
    <Alert className="mt-2.5 flex items-center justify-between gap-2 bg-muted/35 px-3 py-2.5 text-xs">
      <div className="flex min-w-0 flex-col">
        <AlertTitle className="text-[11px] font-medium text-muted-foreground">
          Newer attempt available
        </AlertTitle>
        <AlertDescription className="truncate text-xs font-semibold text-foreground">
          {statusConfig[latestSubmission.status].label}
        </AlertDescription>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="h-8 min-h-8 px-2.5 text-xs shrink-0 font-medium shadow-2xs hover:bg-background"
        onClick={() => onSelect(latestSubmission)}
        aria-label={`Switch to newest upload for ${studentName}`}
      >
        <span>View latest</span>
        <ArrowRight data-icon="inline-end" aria-hidden="true" />
      </Button>
    </Alert>
  );
  const inspectAction =
    submission.status === "rejected" && isLatestSubmission ? (
      <Button
        variant="outline"
        size="sm"
        onClick={() => onReupload(submission.student_id)}
        aria-label={`Re-upload worksheet for ${studentName}. Rejection reason: ${rejection.label}.`}
        className="h-10 min-h-11 md:h-9 md:min-h-9 px-3 text-xs font-semibold text-primary border-primary/30 hover:bg-primary/10 hover:text-primary/90 shrink-0"
      >
        <Camera data-icon="inline-start" aria-hidden="true" />
        <span>Re-upload</span>
      </Button>
    ) : (
      <Button
        variant={!resolvedScore.isScored && submission.status === "completed" ? "default" : "outline"}
        size="sm"
        onClick={() => onSelect(submission)}
        aria-label={accessibleLabel}
        className={cn(
          "h-10 min-h-11 md:h-9 md:min-h-9 px-3 text-xs sm:text-sm shrink-0",
          !resolvedScore.isScored && submission.status === "completed"
            ? "font-semibold shadow-xs"
            : "group/btn border-border/80 font-medium text-foreground hover:bg-muted/70"
        )}
      >
        <span>{inspectActionLabel}</span>
        <ArrowRight
          data-icon="inline-end"
          className="transition-transform group-hover/btn:translate-x-0.5 motion-reduce:transform-none"
          aria-hidden="true"
        />
      </Button>
    );

  const cardOverflowMenu = activityId && (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-11 min-h-11 min-w-11 md:size-8 md:min-h-8 md:min-w-8 text-muted-foreground hover:text-foreground hover:bg-muted/60 shrink-0"
            aria-label={`More actions for ${studentName}`}
          />
        }
      >
        <MoreHorizontal aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 text-xs">
        <DropdownMenuGroup>
          {allSubmissions.length > 0 && (
            <DropdownMenuItem
              onClick={() => setCommentsOpen(true)}
              className="min-h-9 cursor-pointer"
            >
              <MessageSquare className="text-muted-foreground" aria-hidden="true" />
              <span>Private comments</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={() => setDeadlineOpen(true)}
            disabled={!workState}
            className="min-h-9 cursor-pointer"
          >
            <CalendarClock className="text-muted-foreground" aria-hidden="true" />
            <span>Deadline &amp; attempt</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        {submission && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                onClick={() => onSelect(submission)}
                className="min-h-9 cursor-pointer"
              >
                <FileText className="text-muted-foreground" aria-hidden="true" />
                <span>View worksheet details</span>
              </DropdownMenuItem>
              {onDeleteSingleAttempt && (
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => onDeleteSingleAttempt(submission)}
                  className="min-h-9 cursor-pointer"
                >
                  <Trash2 aria-hidden="true" />
                  <span>{hasMultipleAttempts ? "Delete displayed attempt" : "Delete submission"}</span>
                </DropdownMenuItem>
              )}
              {hasMultipleAttempts && onDeleteAllStudentAttempts && (
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => onDeleteAllStudentAttempts(studentName, allSubmissions)}
                  className="min-h-9 cursor-pointer"
                >
                  <Trash2 aria-hidden="true" />
                  <span>Delete all {attemptCount} attempts</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
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
    <Card
      size="sm"
      className={cn(
        "group relative min-w-0 text-left transition-colors",
        (isSelected || isIndeterminate) && "border-primary ring-2 ring-primary/25 bg-primary/5",
        compact
          ? "p-3.5 sm:p-4 transition-all hover:border-border/80"
          : "h-full gap-0 py-0"
      )}
    >
      {compact ? (
        <CardContent className="p-0 flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.5fr)_auto] lg:items-center lg:gap-6">
          <div className="min-w-0">
            <div className="flex items-start justify-between gap-2 lg:block">
              <div className="min-w-0">{studentIdentity}</div>
              <div className="flex items-center gap-1 shrink-0 lg:hidden">
                {inspectAction}
                {cardOverflowMenu}
              </div>
            </div>
          </div>
          <div className="min-w-0">
            {scoreSummary}
            {newestUpload}
          </div>
          <div
            className={cn(
              "flex flex-wrap items-center justify-between gap-2 lg:justify-end",
              !onToggleSelect && submission.status !== "rejected" && "hidden lg:flex"
            )}
          >
            {selectionControl}
            <div className="hidden lg:flex items-center gap-2">
              {inspectAction}
              {cardOverflowMenu}
            </div>
          </div>
        </CardContent>
      ) : (
        <>
          <div className="bg-muted/40 relative flex aspect-4/3 items-center justify-center overflow-hidden border-b">
            {/* Top gradient scrim for badge legibility */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-black/20 to-transparent z-10" aria-hidden="true" />
            <Button
              type="button"
              variant="ghost"
              onClick={() => onSelect(submission)}
              aria-label={`View handwriting worksheet assessment for ${studentName}`}
              className={cn(
                "flex h-auto cursor-pointer items-center justify-center rounded-none p-0 select-none hover:bg-transparent",
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
            </Button>
            {attemptHistoryTrigger}
            {selectionControl}
            {submission.uploader_role === "parent" && (
              <Badge
                variant="secondary"
                className="pointer-events-none absolute top-2.5 right-2.5 z-20 border-border/80 bg-background/90 text-foreground/80 shadow-2xs backdrop-blur-xs"
              >
                Parent upload
              </Badge>
            )}
          </div>
          <CardHeader className="px-4 pt-4 pb-0">
            {studentIdentity}
          </CardHeader>
          <CardContent className="flex-1 px-4 pt-2.5 pb-4">
            {scoreSummary}
            {newestUpload}
          </CardContent>
          <Separator />
          <CardFooter className="min-w-0 justify-between gap-2 px-4 py-3">
            <div className="flex items-center gap-1.5 shrink-0">
              {cardOverflowMenu}
            </div>
            <div className="flex items-center gap-1.5 min-w-0 justify-end">
              {inspectAction}
            </div>
          </CardFooter>
        </>
      )}
      {controlledDialogs}
    </Card>
  );
});

export interface UnsubmittedCardProps {
  compact?: boolean;
  student: { id: string; full_name: string };
  activityId?: string;
  workState?: ActivityWorkState | null;
  workLoading?: boolean;
  onUpload: (studentId: string) => void;
}

export const UnsubmittedCard = memo(function UnsubmittedCard({
  compact = false,
  student,
  activityId,
  workState,
  workLoading = false,
  onUpload,
}: UnsubmittedCardProps) {
  const [deadlineOpen, setDeadlineOpen] = useState(false);

  const overflowMenu = activityId && (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-11 min-h-11 min-w-11 md:size-8 md:min-h-8 md:min-w-8 text-muted-foreground hover:text-foreground hover:bg-muted/60 shrink-0"
            aria-label={`More actions for ${student.full_name}`}
          />
        }
      >
        <MoreHorizontal aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 text-xs">
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() => setDeadlineOpen(true)}
            disabled={!workState}
            className="min-h-9 cursor-pointer"
          >
            <CalendarClock className="text-muted-foreground" aria-hidden="true" />
            <span>Deadline &amp; attempt</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const deadlineDialog = activityId && (
    <StudentWorkControls
      activityId={activityId}
      studentId={student.id}
      studentName={student.full_name}
      state={workState ?? null}
      attempts={[]}
      open={deadlineOpen}
      onOpenChange={setDeadlineOpen}
      showTrigger={false}
    />
  );

  if (compact) {
    return (
      <Card size="sm" className="p-3.5 sm:p-4 text-left transition-all hover:border-border/80">
        <CardContent className="p-0 flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.5fr)_auto] lg:items-center lg:gap-6">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="text-foreground text-sm font-semibold sm:text-base leading-snug truncate min-w-0 shrink">
                {student.full_name}
              </h3>
              <div className="shrink-0">
                <ActivityWorkStatus state={workState ?? null} unavailable={!workState && !workLoading} />
              </div>
            </div>
            <p className="text-muted-foreground text-xs">
              Awaiting submission
            </p>
          </div>
          <div className="text-muted-foreground text-xs">
            <span className="italic">No worksheet uploaded yet</span>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              className="min-h-9 text-xs font-medium"
              onClick={() => onUpload(student.id)}
              aria-label={`Upload worksheet for ${student.full_name}`}
            >
              <Upload data-icon="inline-start" aria-hidden="true" />
              <span>Upload worksheet</span>
            </Button>
            {overflowMenu}
          </div>
        </CardContent>
        {deadlineDialog}
      </Card>
    );
  }

  return (
    <Card
      size="sm"
      className="group relative flex h-full min-w-0 flex-col gap-0 py-0 text-left shadow-2xs transition-shadow hover:shadow-xs"
    >
      {/* 4:3 Dropzone */}
      <div className="bg-muted/20 relative flex aspect-4/3 items-center justify-center overflow-hidden border-b">
        <Button
          type="button"
          variant="ghost"
          onClick={() => onUpload(student.id)}
          className="group/dropzone flex size-full h-auto flex-col items-center justify-center gap-2 rounded-none p-4 text-center whitespace-normal hover:bg-muted/35"
          aria-label={`Upload worksheet for ${student.full_name}`}
        >
          <div className="bg-card border-border/80 text-muted-foreground group-hover/dropzone:border-primary group-hover/dropzone:text-primary flex size-10 items-center justify-center rounded-lg border border-dashed transition-colors shadow-2xs">
            <Upload className="size-5 transition-transform group-hover/dropzone:-translate-y-0.5 motion-reduce:transform-none" aria-hidden="true" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-foreground group-hover/dropzone:text-primary text-xs font-semibold transition-colors">
              Upload worksheet
            </span>
            <span className="text-muted-foreground text-xs opacity-75">
              Click to attach image
            </span>
          </div>
        </Button>
      </div>

      {/* Body */}
      <CardHeader className="px-4 pt-4 pb-0">
        <h3 className="text-foreground text-sm font-semibold break-words sm:text-base leading-snug" title={student.full_name}>
          {student.full_name}
        </h3>
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          <ActivityWorkStatus state={workState ?? null} unavailable={!workState && !workLoading} />
          <span className="text-xs text-muted-foreground">
            Awaiting submission
          </span>
        </div>
      </CardHeader>

      <CardContent className="flex-1 min-h-6 px-4 py-2" />

      <Separator />

      {/* Unified bottom footer matching SubmissionCard */}
      <CardFooter className="justify-between gap-2 px-4 py-3">
        <div className="flex items-center gap-1.5">
          {overflowMenu}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onUpload(student.id)}
          aria-label={`Upload worksheet for ${student.full_name}`}
          className="group/btn h-10 min-h-11 md:h-9 md:min-h-9 px-3 text-xs sm:text-sm font-medium border-border/80 text-foreground hover:bg-muted/70"
        >
          <Upload data-icon="inline-start" className="text-muted-foreground group-hover/btn:text-foreground transition-colors" aria-hidden="true" />
          <span>Upload worksheet</span>
        </Button>
      </CardFooter>

      {deadlineDialog}
    </Card>
  );
});
