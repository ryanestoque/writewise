"use client";

import { memo, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Activity } from "@/lib/hooks/use-activities";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Upload,
  Inbox,
  CheckCircle2,
  MoreVertical,
  Edit3,
  Trash2,
  Copy,
  Archive,
  ArchiveRestore,
  Home,
  BookOpen,
  CalendarDays,
} from "lucide-react";

export interface ActivityCardProps {
  activity: Activity;
  isSelected: boolean;
  isSelectMode: boolean;
  totalStudents: number;
  onToggleSelect: (id: string, shiftKey?: boolean) => void;
  onUpload: (activityId: string) => void;
  onDuplicate: (activity: Activity) => void;
  onEdit: (activity: Activity) => void;
  onDelete: (activity: Activity) => void;
  onToggleArchive: (activityId: string) => void;
}

function getWordCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

function getRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 30) {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  }
  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return "Just now";
}

export const ActivityCard = memo(function ActivityCard({
  activity,
  isSelected,
  isSelectMode,
  totalStudents,
  onToggleSelect,
  onUpload,
  onDuplicate,
  onEdit,
  onDelete,
  onToggleArchive,
}: ActivityCardProps) {
  const router = useRouter();

  const isArchived = activity.is_archived;
  const displayTargetText = activity.target_text?.trim() || "Untitled Activity";
  const wordCount = useMemo(() => getWordCount(activity.target_text ?? ""), [activity.target_text]);
  const relativeTime = useMemo(() => getRelativeTime(activity.created_at), [activity.created_at]);

  // Derived submission stats
  const { submissionCount, completedCount, processingCount, rejectedCount, isFullyCollected } =
    useMemo(() => {
      const submissions = activity.submissions ?? [];
      const total = submissions.length;
      let completed = 0;
      let processing = 0;
      let rejected = 0;

      for (let i = 0; i < total; i++) {
        const s = submissions[i];
        if (s.status === "completed") completed++;
        else if (s.status === "processing") processing++;
        else if (s.status === "rejected") rejected++;
      }

      return {
        submissionCount: total,
        completedCount: completed,
        processingCount: processing,
        rejectedCount: rejected,
        isFullyCollected: totalStudents > 0 && total >= totalStudents,
      };
    }, [activity.submissions, totalStudents]);

  return (
    <div
      onClick={
        isSelectMode
          ? (e) => onToggleSelect(activity.id, e.shiftKey)
          : undefined
      }
      className={cn(
        "group relative flex flex-col justify-between bg-surface dark:bg-card border rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-warm hover:shadow-md transition-all duration-200",
        isSelectMode && "cursor-pointer select-none",
        isSelected && "ring-2 ring-primary border-primary/60 bg-brand-50/20 dark:bg-brand-950/20",
        isArchived
          ? "border-dashed border-border/80 opacity-80 hover:opacity-100"
          : "border-border hover:border-brand-300 dark:hover:border-brand-800"
      )}
    >
      <div>
        {/* Card Header: Checkbox, Badges & Actions Menu */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            {/* Selection Checkbox with Touch-Friendly Hit Target */}
            <div
              className={cn(
                "transition-all duration-150 ease-out flex items-center justify-center shrink-0",
                isSelectMode || isSelected
                  ? "w-8 opacity-100"
                  : "w-8 opacity-100 sm:w-0 sm:opacity-0 sm:overflow-hidden sm:group-hover:w-8 sm:group-hover:opacity-100 sm:group-hover:overflow-visible sm:focus-within:w-8 sm:focus-within:opacity-100"
              )}
            >
              <label
                className="flex size-10 sm:size-7 items-center justify-center rounded-md hover:bg-muted/70 cursor-pointer transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => {
                    onToggleSelect(
                      activity.id,
                      (e.nativeEvent as MouseEvent).shiftKey
                    );
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  aria-label={`Select activity: ${displayTargetText.slice(0, 40)}`}
                  className="size-4.5 sm:size-4 rounded border-border accent-primary cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
            </div>

            {isArchived ? (
              <Badge
                variant="outline"
                className="text-xs font-semibold px-2.5 py-0.5 bg-muted/60 text-muted-foreground border-border/80"
              >
                <Archive className="w-3.5 h-3.5 mr-1" />
                Archived
              </Badge>
            ) : activity.is_take_home ? (
              <Badge
                variant="outline"
                className="text-xs font-semibold px-2.5 py-0.5 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300 border-brand-200/80 dark:border-brand-900"
              >
                <Home className="w-3.5 h-3.5 mr-1 text-brand-600 dark:text-brand-400" />
                Take-home
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-xs font-semibold px-2.5 py-0.5 bg-emerald-50/70 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200/70 dark:border-emerald-900/60"
              >
                <BookOpen className="w-3.5 h-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
                In-Class
              </Badge>
            )}

            <span className="inline-flex items-center text-xs font-medium text-muted-foreground bg-muted/40 dark:bg-muted/30 px-2 py-0.5 rounded-md border border-border/50 tabular-nums">
              {wordCount} {wordCount === 1 ? "word" : "words"}
            </span>
          </div>

          {/* Overflow Actions Menu with 40px Touch Hit Target on Mobile */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex size-10 sm:size-8 min-h-[40px] sm:min-h-[32px] items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Actions for activity: ${displayTargetText.slice(0, 40)}`}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem
                onClick={() => onUpload(activity.id)}
                className="cursor-pointer gap-2 text-xs min-h-[36px]"
              >
                <Upload className="size-3.5" />
                <span>Upload Worksheet</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDuplicate(activity)}
                className="cursor-pointer gap-2 text-xs min-h-[36px]"
              >
                <Copy className="size-3.5" />
                <span>Duplicate Activity</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onEdit(activity)}
                className="cursor-pointer gap-2 text-xs min-h-[36px]"
              >
                <Edit3 className="size-3.5" />
                <span>Edit Target Text</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push(`/activities/${activity.id}`)}
                className="cursor-pointer gap-2 text-xs min-h-[36px]"
              >
                <Inbox className="size-3.5" />
                <span>View Submissions</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onToggleArchive(activity.id)}
                className="cursor-pointer gap-2 text-xs min-h-[36px]"
              >
                {isArchived ? (
                  <>
                    <ArchiveRestore className="size-3.5" />
                    <span>Unarchive Activity</span>
                  </>
                ) : (
                  <>
                    <Archive className="size-3.5" />
                    <span>Archive Activity</span>
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(activity)}
                className="cursor-pointer gap-2 text-xs text-destructive focus:text-destructive min-h-[36px]"
              >
                <Trash2 className="size-3.5" />
                <span>Delete Activity</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Target Text Preview with Cursive Worksheet Accent & 3-line Ruling */}
        <Link
          href={`/activities/${activity.id}`}
          title={`Open activity: ${displayTargetText}`}
          aria-label={`Open activity: ${displayTargetText}`}
          onClick={(e) => {
            if (isSelectMode) {
              e.preventDefault();
            }
          }}
          className="block group-hover:opacity-90 transition-opacity focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
        >
          <div className="relative p-3.5 sm:p-4 pb-5 sm:pb-6 rounded-xl bg-linear-to-b from-brand-50/20 via-surface to-brand-50/10 dark:from-card dark:to-card/80 border border-brand-200/50 dark:border-border/60 mb-3.5 overflow-hidden shadow-2xs">
            <div className="relative">
              {/* Authentic 3-line ruling aligned with Cedarville Cursive baseline */}
              <div
                className="absolute inset-0 pointer-events-none opacity-40 dark:opacity-20 cursive-guidelines overflow-hidden z-0"
                aria-hidden="true"
              />

              <p
                className={cn(
                  "relative z-10 font-cursive leading-snug sm:leading-[44px] md:leading-[48px] tracking-wide break-words",
                  activity.target_text?.trim()
                    ? "text-2xl sm:text-[32px] md:text-[34px] text-foreground/90 font-normal"
                    : "text-base sm:text-lg text-muted-foreground/70 italic font-sans"
                )}
              >
                {activity.target_text?.trim() || "No text specified"}
              </p>
            </div>
          </div>
        </Link>
      </div>

      {/* Card Footer: Submission Progress Gauge & Direct Actions */}
      <div className="space-y-2.5 pt-2.5 border-t border-border/60">
        {/* Status header with count and timestamp */}
        <div className="flex items-center justify-between gap-1.5 text-xs">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-semibold text-foreground text-xs flex items-center gap-1.5 truncate">
              <Inbox className="size-3.5 text-muted-foreground shrink-0" />
              {totalStudents > 0 ? (
                <span className="truncate">
                  {submissionCount > totalStudents
                    ? `${submissionCount} collected`
                    : `${submissionCount} of ${totalStudents} collected`}
                </span>
              ) : (
                <span className="truncate">
                  {submissionCount}{" "}
                  {submissionCount === 1 ? "submission" : "submissions"}
                </span>
              )}
            </span>

            {isFullyCollected && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/60 px-2 py-0.5 rounded-md border border-brand-200/80 dark:border-brand-900 shrink-0">
                <CheckCircle2 className="size-3" />
                Complete
              </span>
            )}
          </div>

          <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0 tabular-nums">
            <CalendarDays className="size-3.5" />
            {relativeTime}
          </span>
        </div>

        {/* Visual Progress Bar (when totalStudents > 0) */}
        {totalStudents > 0 && (
          <Tooltip>
            <TooltipTrigger
              render={
                <div
                  tabIndex={0}
                  role="progressbar"
                  aria-valuenow={submissionCount}
                  aria-valuemin={0}
                  aria-valuemax={totalStudents}
                  aria-label={`Submission progress: ${completedCount} completed, ${processingCount} processing, ${rejectedCount} rejected out of ${totalStudents} students`}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation();
                    }
                  }}
                  className="group/progress w-full py-0.5 cursor-help focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded-full"
                >
                  <div className="w-full bg-muted/60 dark:bg-muted/40 h-2 rounded-full overflow-hidden flex shadow-2xs group-hover/progress:brightness-95 transition-all">
                    {completedCount > 0 && (
                      <div
                        className="bg-brand-500 transition-all duration-300 motion-reduce:transition-none"
                        style={{
                          width: `${(completedCount / totalStudents) * 100}%`,
                        }}
                      />
                    )}
                    {processingCount > 0 && (
                      <div
                        className="bg-amber-500 transition-all duration-300 motion-reduce:transition-none"
                        style={{
                          width: `${(processingCount / totalStudents) * 100}%`,
                        }}
                      />
                    )}
                    {rejectedCount > 0 && (
                      <div
                        className="bg-destructive transition-all duration-300 motion-reduce:transition-none"
                        style={{
                          width: `${(rejectedCount / totalStudents) * 100}%`,
                        }}
                      />
                    )}
                  </div>
                </div>
              }
            />
            <TooltipContent
              side="top"
              sideOffset={6}
              arrowClassName="bg-popover fill-popover border-b border-r border-border"
              className="flex flex-col items-stretch bg-popover text-popover-foreground border border-border shadow-warm-md text-xs p-3 space-y-2 min-w-[220px] rounded-xl"
            >
              <div className="font-semibold text-foreground pb-2 border-b border-border flex items-center justify-between">
                <span className="text-xs font-heading font-medium">Class Submissions</span>
                <span className="tabular-nums text-muted-foreground font-medium text-xs bg-muted/60 dark:bg-muted/40 px-1.5 py-0.5 rounded-md">
                  {submissionCount}/{totalStudents}
                </span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-foreground/90 font-medium">
                    <span className="size-2 rounded-full bg-brand-500 inline-block shrink-0 shadow-2xs" />
                    Completed
                  </span>
                  <span className="font-semibold tabular-nums text-foreground">{completedCount}</span>
                </div>
                {processingCount > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 font-medium">
                      <span className="size-2 rounded-full bg-amber-500 inline-block shrink-0 animate-pulse motion-reduce:animate-none" />
                      Processing
                    </span>
                    <span className="font-semibold tabular-nums text-amber-700 dark:text-amber-300">{processingCount}</span>
                  </div>
                )}
                {rejectedCount > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-destructive font-medium">
                      <span className="size-2 rounded-full bg-destructive inline-block shrink-0" />
                      Rejected (Needs Re-scan)
                    </span>
                    <span className="font-semibold tabular-nums text-destructive">{rejectedCount}</span>
                  </div>
                )}
                {totalStudents - submissionCount > 0 && (
                  <div className="flex items-center justify-between text-muted-foreground pt-1.5 border-t border-border/50">
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-muted-foreground/30 inline-block shrink-0" />
                      Unsubmitted
                    </span>
                    <span className="font-medium tabular-nums">{totalStudents - submissionCount}</span>
                  </div>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Assessment Status Subtext */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-0.5">
          <span className="flex items-center gap-1.5 truncate">
            <span
              className={cn(
                "size-1.5 rounded-full shrink-0",
                processingCount > 0
                  ? "bg-amber-500 motion-safe:animate-pulse motion-reduce:animate-none"
                  : completedCount > 0
                  ? "bg-brand-500"
                  : "bg-muted-foreground/50"
              )}
            />
            <span className="truncate">
              {completedCount > 0
                ? `${completedCount} ${completedCount === 1 ? "worksheet" : "worksheets"} scored`
                : processingCount > 0
                ? `${processingCount} ${processingCount === 1 ? "worksheet" : "worksheets"} processing analysis`
                : submissionCount > 0
                ? `${submissionCount} collected · Ready to evaluate`
                : "Awaiting worksheet submissions"}
            </span>
          </span>
        </div>

        {/* Standardized 2-Action Button Row with Touch-Friendly Hit Targets */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onUpload(activity.id);
            }}
            className="h-10 sm:h-8 min-h-[40px] sm:min-h-[36px] px-2 text-xs font-medium border-border/80 hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-950/60 dark:hover:text-brand-300 rounded-lg cursor-pointer transition-colors w-full justify-center"
            title={isFullyCollected ? "Upload additional worksheet scans" : "Upload student worksheet scans"}
            aria-label={
              isFullyCollected
                ? `Upload more worksheets for ${displayTargetText}`
                : `Upload worksheet for ${displayTargetText}`
            }
          >
            <Upload className="size-3.5 mr-1.5 text-primary shrink-0" />
            <span className="truncate">{isFullyCollected ? "Upload More" : "Upload"}</span>
          </Button>

          <Link
            href={`/activities/${activity.id}`}
            onClick={(e) => {
              if (isSelectMode) {
                e.stopPropagation();
              }
            }}
            className={cn(
              buttonVariants({
                variant: isFullyCollected ? "default" : "secondary",
                size: "sm",
              }),
              "h-10 sm:h-8 min-h-[40px] sm:min-h-[36px] px-2 text-xs font-semibold rounded-lg shadow-2xs cursor-pointer group/btn w-full justify-center"
            )}
            title={isFullyCollected ? "Review completed submissions" : "View submissions for this activity"}
            aria-label={
              isFullyCollected
                ? `Review submissions for ${displayTargetText}`
                : `View submissions for ${displayTargetText}`
            }
          >
            <Inbox className="size-3.5 mr-1.5 shrink-0" />
            <span className="truncate">{isFullyCollected ? "Review" : "Submissions"}</span>
            <span className="ml-1 text-xs transition-transform group-hover/btn:translate-x-0.5 shrink-0">
              &rarr;
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
});
