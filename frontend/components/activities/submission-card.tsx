"use client";

import { memo, useMemo, useState } from "react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
} from "lucide-react";

export interface SubmissionCardProps {
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
}

/**
 * Unified Submission Card Component
 * Accessible card with decoupled interactive regions and consolidated keyboard focus
 */
export const SubmissionCard = memo(function SubmissionCard({
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
}: SubmissionCardProps) {
  const { data: imageUrl } = useSubmissionImageUrl(submission.image_path);
  const [imageError, setImageError] = useState(false);
  const config = statusConfig[submission.status];
  const resolvedScore = useMemo(
    () => resolveSubmissionScore(submission),
    [submission]
  );
  const compositeScore = resolvedScore.compositeScore;
  const scoreBand = resolvedScore.scoreBand;
  const rejection = getRejectionSummary(submission.rejection_code);
  const hasMultipleAttempts = attemptCount > 1 && allSubmissions.length > 1;

  const currentAttemptIndex = useMemo(() => {
    if (!hasMultipleAttempts) return 1;
    const idx = allSubmissions.findIndex((s) => s.id === submission.id);
    return idx >= 0 ? attemptCount - idx : attemptCount;
  }, [hasMultipleAttempts, allSubmissions, submission.id, attemptCount]);

  const accessibleLabel = useMemo(() => {
    let text = `View diagnostic details for ${studentName}. Status: ${config.label}.`;
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
    }
    return text;
  }, [
    studentName,
    config.label,
    submission.status,
    resolvedScore.isScored,
    resolvedScore.source,
    compositeScore,
    scoreBand.band,
    rejection,
    hasMultipleAttempts,
    currentAttemptIndex,
    attemptCount,
  ]);

  const showImage = Boolean(imageUrl && !imageError);

  return (
    <article
      className={cn(
        "group relative flex flex-col justify-between bg-surface dark:bg-card border rounded-xl sm:rounded-2xl shadow-warm hover:shadow-md transition-all duration-200 overflow-hidden text-left",
        isSelected || isIndeterminate
          ? "border-primary ring-2 ring-primary/25 bg-primary/[0.02]"
          : "border-border hover:border-brand-300 dark:hover:border-brand-800"
      )}
    >
      {/* Photo Thumbnail & Clickable Hero */}
      <div className="aspect-4/3 bg-muted/40 dark:bg-muted/20 relative overflow-hidden p-2 flex items-center justify-center border-b border-border/40">
        {/* Main Photo Click Target (mouse click helper, tabIndex=-1 so keyboard focuses primary button without duplicate tab stops) */}
        <div
          onClick={() => onSelect(submission)}
          role="button"
          tabIndex={-1}
          aria-hidden="true"
          className="absolute inset-0 size-full z-0 cursor-pointer flex items-center justify-center select-none"
        >
          {showImage ? (
            <Image
              src={imageUrl ?? ""}
              alt=""
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 320px"
              loading="lazy"
              onError={() => setImageError(true)}
              className="size-full object-contain p-2 drop-shadow-2xs group-hover:scale-[1.02] transition-transform duration-200 pointer-events-none motion-reduce:transform-none"
            />
          ) : (
            <div className="size-full flex flex-col items-center justify-center gap-1.5 text-muted-foreground p-4 pointer-events-none">
              <FileText className="size-8 stroke-[1.5]" aria-hidden="true" />
              <span className="text-[11px] font-medium tracking-tight">
                Worksheet Preview
              </span>
            </div>
          )}
        </div>

        {/* Attempt history switcher if multiple attempts exist */}
        {hasMultipleAttempts && (
          <div className="absolute top-2.5 left-2.5 z-20">
            <DropdownMenu>
              <DropdownMenuTrigger
                className="relative inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 sm:px-2.5 sm:py-1 min-h-[40px] sm:min-h-[36px] rounded-full bg-background/95 text-foreground dark:bg-card/95 border border-border shadow-xs backdrop-blur-xs hover:bg-background transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Switch submission attempt for ${studentName}. Currently showing attempt ${currentAttemptIndex} of ${attemptCount}.`}
              >
                <History className="size-3 text-muted-foreground" aria-hidden="true" />
                <span>{attemptCount} Attempts</span>
                <ChevronDown className="size-3 opacity-60" aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64 z-50">
                <div className="text-xs text-muted-foreground font-medium px-2.5 py-1.5">
                  Submission History ({attemptCount} attempts)
                </div>
                <DropdownMenuSeparator />
                <div className="p-1 space-y-0.5">
                  {allSubmissions.map((sub, idx) => {
                    const attemptNum = attemptCount - idx;
                    const isCurrent = sub.id === submission.id;
                    const isLatest = idx === 0;
                    const subConfig = statusConfig[sub.status];

                    return (
                      <div
                        key={sub.id}
                        className="group/item flex items-center justify-between gap-1 rounded-md"
                      >
                        <DropdownMenuItem
                          onClick={() =>
                            onSelectAttempt?.(submission.student_id, sub)
                          }
                          className={cn(
                            "flex-1 flex items-center justify-between gap-2 min-w-0 text-xs py-1.5 px-2 cursor-pointer",
                            isCurrent && "bg-primary/10 text-primary font-medium"
                          )}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className={`size-1.5 rounded-full shrink-0 ${subConfig.dotClass}`}
                              aria-hidden="true"
                            />
                            <span className="truncate">
                              Attempt {attemptNum} {isLatest && "(Latest)"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-muted-foreground shrink-0">
                            <span className="text-[11px] tabular-nums">
                              {getRelativeTime(sub.created_at)}
                            </span>
                            {isCurrent && (
                              <Check
                                className="size-3.5 text-primary stroke-[2.5]"
                                aria-hidden="true"
                              />
                            )}
                          </div>
                        </DropdownMenuItem>

                        {onDeleteSingleAttempt && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteSingleAttempt(sub);
                            }}
                            title={`Delete Attempt ${attemptNum}`}
                            aria-label={`Delete Attempt ${attemptNum}`}
                            className="size-8 min-h-[32px] min-w-[32px] sm:size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-70 group-hover/item:opacity-100 focus-visible:opacity-100 cursor-pointer shrink-0"
                          >
                            <Trash2 className="size-3.5" aria-hidden="true" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {onDeleteAllStudentAttempts && allSubmissions.length > 1 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() =>
                        onDeleteAllStudentAttempts(studentName, allSubmissions)
                      }
                      className="cursor-pointer text-xs text-destructive focus:text-destructive focus:bg-destructive/10 flex items-center gap-2 py-2"
                    >
                      <Trash2 className="size-3.5 shrink-0" aria-hidden="true" />
                      <span>Delete all {attemptCount} attempts</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Selection Checkbox */}
        {onToggleSelect && (
          <div
            className="absolute top-2.5 right-2.5 z-20"
            onClick={(e) => e.stopPropagation()}
          >
            <label
              className={cn(
                "inline-flex items-center justify-center min-h-[40px] min-w-[40px] p-2 rounded-lg transition-all shadow-2xs backdrop-blur-xs cursor-pointer",
                isSelected
                  ? "bg-background/95 dark:bg-card/95"
                  : "bg-background/85 dark:bg-card/85 hover:bg-background opacity-85 group-hover:opacity-100 hover:opacity-100"
              )}
            >
              <Checkbox
                checked={isSelected}
                indeterminate={isIndeterminate}
                onCheckedChange={() => onToggleSelect(submission, allSubmissions)}
                aria-label={`Select ${hasMultipleAttempts ? `all ${attemptCount} attempts for ${studentName}` : `attempt by ${studentName}`}`}
                className="size-4"
              />
            </label>
          </div>
        )}

        {/* Uploader indicator (if parent) */}
        {submission.uploader_role === "parent" && (
          <div className="absolute bottom-2.5 left-2.5 z-10 pointer-events-none" aria-hidden="true">
            <Badge
              variant="outline"
              className="text-[10px] font-semibold px-2 py-0.5 bg-brand-50/90 text-brand-800 dark:bg-brand-950/90 dark:text-brand-300 border-brand-200/80 backdrop-blur-xs"
            >
              Parent upload
            </Badge>
          </div>
        )}
      </div>

      {/* Card Info */}
      <div className="p-3.5 space-y-2 flex-1 flex flex-col justify-between relative z-10">
        <div>
          <h3
            className="text-sm font-semibold text-foreground truncate"
            title={studentName}
          >
            <button
              type="button"
              onClick={() => onSelect(submission)}
              tabIndex={-1}
              aria-hidden="true"
              className="text-left font-semibold text-foreground truncate hover:text-brand-700 dark:hover:text-brand-300 transition-colors cursor-pointer rounded-xs max-w-full inline-block"
            >
              {studentName}
            </button>
          </h3>

          {/* Diagnostic score or Rejection note */}
          {submission.status === "completed" && (
            <div className="mt-1.5 flex items-center gap-1.5">
              <Tooltip>
                <TooltipTrigger
                  type="button"
                  className={cn(
                    "inline-flex items-center gap-1.5 text-[11px] font-semibold rounded-md border shadow-2xs cursor-help px-2 py-0.5 min-h-[24px] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 transition-all",
                    scoreBand.className
                  )}
                  aria-label={`Diagnostic score: ${scoreBand.label}. ${scoreBand.band} Penmanship: ${scoreBand.description}`}
                >
                  <span
                    className={cn("size-1.5 rounded-full shrink-0", scoreBand.dotColor)}
                    aria-hidden="true"
                  />
                  <span>{scoreBand.label}</span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs max-w-xs">
                  <p className="font-semibold">
                    {scoreBand.band} Penmanship{" "}
                    {resolvedScore.source === "manual" && "(Teacher Rubric)"}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {scoreBand.description}
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
          )}

          {submission.status === "rejected" && (
            <div className="mt-1 space-y-0.5">
              <p className="text-xs text-destructive flex items-center gap-1 font-medium truncate">
                <AlertCircle className="size-3 shrink-0" aria-hidden="true" />
                <span>{rejection.label}</span>
              </p>
              <p className="text-[11px] text-muted-foreground line-clamp-1">
                {rejection.detail}
              </p>
            </div>
          )}

          {submission.status === "processing" && (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1 font-medium truncate">
              <Clock className="size-3 shrink-0 motion-safe:animate-pulse" aria-hidden="true" />
              <span>Analyzing cursive strokes...</span>
            </p>
          )}
        </div>

        {/* Action / Inspection Row */}
        <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs text-muted-foreground">
          <time
            dateTime={submission.created_at}
            title={formatDate(submission.created_at)}
            className="text-[11px] sm:text-xs text-muted-foreground tabular-nums"
          >
            {getRelativeTime(submission.created_at)}
          </time>

          {submission.status === "rejected" ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onReupload(submission.student_id)}
              aria-label={`Re-upload worksheet for ${studentName}. Rejection reason: ${rejection.label}.`}
              className="h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] px-3 sm:px-2.5 text-xs font-semibold text-primary hover:text-brand-700 dark:hover:text-brand-300 hover:bg-brand-50/50 dark:hover:bg-brand-950/50 rounded-lg gap-1.5 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Camera className="size-3.5" aria-hidden="true" />
              <span>Re-upload</span>
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSelect(submission)}
              aria-haspopup="dialog"
              aria-label={accessibleLabel}
              className="h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] px-3 sm:px-2.5 text-xs font-medium text-primary hover:text-brand-700 dark:hover:text-brand-300 hover:bg-brand-50/50 dark:hover:bg-brand-950/50 rounded-lg gap-1.5 group/btn cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span>
                {resolvedScore.isScored ? "Inspect details" : "Score rubric"}
              </span>
              <ArrowRight
                className="size-3.5 transition-transform group-hover/btn:translate-x-0.5 motion-reduce:transform-none"
                aria-hidden="true"
              />
            </Button>
          )}
        </div>
      </div>
    </article>
  );
});
