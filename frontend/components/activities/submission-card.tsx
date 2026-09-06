"use client";

import { memo, useMemo, useState } from "react";
import type { Submission } from "@/lib/hooks/use-submissions";
import { useSubmissionImageUrl } from "@/lib/hooks/use-submissions";
import {
  statusConfig,
  getScoreBandLabel,
  getRejectionSummary,
} from "@/lib/utils/submission-status";
import { formatDate, getRelativeTime } from "@/lib/utils/formatters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
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
  Home,
  Camera,
  ArrowRight,
  Clock,
} from "lucide-react";

export interface SubmissionCardProps {
  submission: Submission;
  studentName: string;
  attemptCount?: number;
  allSubmissions?: Submission[];
  onSelect: (sub: Submission) => void;
  onReupload: (studentId?: string) => void;
  onSelectAttempt?: (studentId: string, sub: Submission) => void;
}

/**
 * Unified Submission Card Component
 * Accessible card with decoupled interactive regions
 */
export const SubmissionCard = memo(function SubmissionCard({
  submission,
  studentName,
  attemptCount = 1,
  allSubmissions = [],
  onSelect,
  onReupload,
  onSelectAttempt,
}: SubmissionCardProps) {
  const { data: imageUrl } = useSubmissionImageUrl(submission.image_path);
  const [imageError, setImageError] = useState(false);
  const config = statusConfig[submission.status];
  const compositeScore = submission.measurement?.composite_score;
  const scoreBand = getScoreBandLabel(compositeScore);
  const rejection = getRejectionSummary(submission.rejection_code);
  const hasMultipleAttempts = attemptCount > 1 && allSubmissions.length > 1;
  const ScoreIcon = scoreBand.icon;

  const currentAttemptIndex = useMemo(() => {
    if (!hasMultipleAttempts) return 1;
    const idx = allSubmissions.findIndex((s) => s.id === submission.id);
    return idx >= 0 ? attemptCount - idx : attemptCount;
  }, [hasMultipleAttempts, allSubmissions, submission.id, attemptCount]);

  const accessibleLabel = useMemo(() => {
    let text = `View diagnostic details for ${studentName}. Status: ${config.label}.`;
    if (
      submission.status === "completed" &&
      compositeScore !== undefined &&
      compositeScore !== null
    ) {
      text += ` Diagnostic composite score: ${Math.round(compositeScore)} percent, rated ${scoreBand.band}.`;
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
    compositeScore,
    scoreBand.band,
    rejection,
    hasMultipleAttempts,
    currentAttemptIndex,
    attemptCount,
  ]);

  const showImage = Boolean(imageUrl && !imageError);

  return (
    <article className="group relative flex flex-col justify-between bg-surface dark:bg-card border border-border hover:border-brand-300 dark:hover:border-brand-800 rounded-xl sm:rounded-2xl shadow-warm hover:shadow-md transition-all duration-200 overflow-hidden text-left">
      {/* Photo Thumbnail & Clickable Hero */}
      <div className="aspect-4/3 bg-muted/40 dark:bg-muted/20 relative overflow-hidden p-2 flex items-center justify-center border-b border-border/40">
        {/* Main Photo Click Target */}
        <button
          type="button"
          onClick={() => onSelect(submission)}
          aria-haspopup="dialog"
          aria-label={accessibleLabel}
          className="absolute inset-0 size-full z-0 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset flex items-center justify-center"
        >
          {showImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl ?? ""}
              alt=""
              aria-hidden="true"
              width={320}
              height={240}
              loading="lazy"
              decoding="async"
              onError={() => setImageError(true)}
              className="size-full object-contain drop-shadow-2xs group-hover:scale-[1.02] transition-transform duration-200 pointer-events-none motion-reduce:transform-none"
            />
          ) : (
            <div className="size-full flex flex-col items-center justify-center gap-1.5 text-muted-foreground p-4 pointer-events-none">
              <FileText className="size-8 stroke-[1.5]" aria-hidden="true" />
              <span className="text-[11px] font-medium tracking-tight">
                Worksheet Preview
              </span>
            </div>
          )}
        </button>

        {/* Attempt history switcher if multiple attempts exist */}
        {hasMultipleAttempts && (
          <div className="absolute top-2.5 left-2.5 z-20">
            <DropdownMenu>
              <DropdownMenuTrigger
                className="relative inline-flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 sm:px-2.5 sm:py-1 min-h-[44px] sm:min-h-[28px] rounded-full bg-background/95 text-foreground dark:bg-card/95 border border-border shadow-xs backdrop-blur-xs hover:bg-background transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Switch submission attempt for ${studentName}. Currently showing attempt ${currentAttemptIndex} of ${attemptCount}.`}
              >
                <History className="size-3 text-muted-foreground" aria-hidden="true" />
                <span>{attemptCount} Attempts</span>
                <ChevronDown className="size-3 opacity-60" aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 z-50">
                <div className="text-xs text-muted-foreground font-medium px-2.5 py-1.5">
                  Submission History ({attemptCount} attempts)
                </div>
                <DropdownMenuSeparator />
                {allSubmissions.map((sub, idx) => {
                  const attemptNum = attemptCount - idx;
                  const isCurrent = sub.id === submission.id;
                  const isLatest = idx === 0;
                  const subConfig = statusConfig[sub.status];

                  return (
                    <DropdownMenuItem
                      key={sub.id}
                      onClick={() =>
                        onSelectAttempt?.(submission.student_id, sub)
                      }
                      className="cursor-pointer text-xs flex items-center justify-between gap-2 min-h-[44px] sm:min-h-[36px]"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`size-1.5 rounded-full shrink-0 ${subConfig.dotClass}`}
                        />
                        <span className="font-medium truncate">
                          Attempt {attemptNum} {isLatest && "(Latest)"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground shrink-0">
                        <span className="text-[11px]">
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
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Uploader indicator (if parent) */}
        {submission.uploader_role === "parent" && (
          <div className="absolute bottom-2.5 left-2.5 z-10 pointer-events-none" aria-hidden="true">
            <Badge
              variant="outline"
              className="text-[10px] font-semibold px-2 py-0.5 bg-brand-50/90 text-brand-800 dark:bg-brand-950/90 dark:text-brand-300 border-brand-200/80 backdrop-blur-xs"
            >
              <Home className="size-2.5 mr-1" />
              Parent upload
            </Badge>
          </div>
        )}
      </div>

      {/* Card Info */}
      <div className="p-3.5 space-y-2 flex-1 flex flex-col justify-between relative z-10">
        <div>
          <h3 className="text-sm font-semibold text-foreground truncate">
            <button
              type="button"
              onClick={() => onSelect(submission)}
              className="text-left font-semibold text-foreground truncate hover:text-brand-700 dark:hover:text-brand-300 transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded-xs max-w-full inline-block"
              aria-label={`Inspect diagnostic assessment for ${studentName}`}
            >
              {studentName}
            </button>
          </h3>

          {/* Diagnostic score or Rejection note */}
          {submission.status === "completed" && (
            <div className="mt-1.5 flex items-center gap-1.5">
              <TooltipProvider delay={200}>
                <Tooltip>
                  <TooltipTrigger
                    type="button"
                    className={cn(
                      "inline-flex items-center gap-1 text-[11px] font-semibold rounded-md border shadow-2xs cursor-help px-1.5 py-0.5 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 transition-all",
                      scoreBand.className
                    )}
                    aria-label={`Diagnostic score: ${scoreBand.label}. ${scoreBand.band} Penmanship: ${scoreBand.description}`}
                  >
                    <ScoreIcon
                      className="size-3 shrink-0"
                      aria-hidden="true"
                    />
                    <span>{scoreBand.label}</span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs max-w-xs">
                    <p className="font-semibold">
                      {scoreBand.band} Penmanship
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {scoreBand.description}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
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
              aria-label={`Re-upload worksheet for ${studentName}`}
              className="h-11 sm:h-8 min-h-[44px] sm:min-h-[32px] px-3 sm:px-2 text-xs font-semibold text-primary hover:text-brand-700 dark:hover:text-brand-300 hover:bg-brand-50/50 dark:hover:bg-brand-950/50 rounded-lg gap-1.5 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Camera className="size-3.5 sm:size-3" aria-hidden="true" />
              <span>Re-upload</span>
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSelect(submission)}
              aria-haspopup="dialog"
              tabIndex={-1}
              aria-hidden="true"
              className="h-11 sm:h-8 min-h-[44px] sm:min-h-[32px] px-3 sm:px-2 text-xs font-medium text-primary hover:text-brand-700 dark:hover:text-brand-300 hover:bg-brand-50/50 dark:hover:bg-brand-950/50 rounded-lg gap-1.5 group/btn cursor-pointer"
            >
              <span>Inspect details</span>
              <ArrowRight className="size-3.5 sm:size-3 transition-transform group-hover/btn:translate-x-0.5 motion-reduce:transform-none" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    </article>
  );
});
