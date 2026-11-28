"use client";

import { formatActivityDueAt } from "@/lib/utils/activity-deadlines";
import { memo, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Activity } from "@/lib/hooks/use-activities";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { WorksheetPrompt } from "@/components/activities/worksheet-prompt";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
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
} from "lucide-react";

export interface ActivityCardProps {
  activity: Activity;
  isSelected: boolean;
  isSelectMode: boolean;
  totalStudents: number;
  assignedStudentIds?: string[];
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
  assignedStudentIds,
  onToggleSelect,
  onUpload,
  onDuplicate,
  onEdit,
  onDelete,
  onToggleArchive,
}: ActivityCardProps) {
  const router = useRouter();

  const isArchived = activity.is_archived;
  const displayTargetText = activity.title?.trim() || "Untitled Activity";
  const wordCount = useMemo(() => getWordCount(activity.target_text ?? ""), [activity.target_text]);
  const relativeTime = useMemo(() => getRelativeTime(activity.created_at), [activity.created_at]);

  // Derived per-student submission stats (unique students, never inflated by retries)
  const {
    collectedStudents,
    totalAttempts,
    completedCount,
    processingCount,
    rejectedCount,
    isFullyCollected,
  } = useMemo(() => {
    const submissions = activity.submissions ?? [];
    const assignedSet =
      assignedStudentIds && assignedStudentIds.length > 0
        ? new Set(assignedStudentIds)
        : null;

    // Best status per unique student: completed > processing > rejected
    const studentStatus = new Map<string, "completed" | "processing" | "rejected">();
    const priority = { completed: 3, processing: 2, rejected: 1 } as const;

    for (let i = 0; i < submissions.length; i++) {
      const s = submissions[i];
      if (assignedSet && !assignedSet.has(s.student_id)) continue;
      const status = s.status;
      if (status !== "completed" && status !== "processing" && status !== "rejected") continue;
      const existing = studentStatus.get(s.student_id);
      if (!existing || priority[status] > priority[existing]) {
        studentStatus.set(s.student_id, status);
      }
    }

    let completed = 0;
    let processing = 0;
    let rejected = 0;
    for (const status of studentStatus.values()) {
      if (status === "completed") completed++;
      else if (status === "processing") processing++;
      else if (status === "rejected") rejected++;
    }

    const uniqueCollected = studentStatus.size;
    return {
      collectedStudents: uniqueCollected,
      totalAttempts: submissions.length,
      completedCount: completed,
      processingCount: processing,
      rejectedCount: rejected,
      isFullyCollected: totalStudents > 0 && uniqueCollected >= totalStudents,
    };
  }, [activity.submissions, assignedStudentIds, totalStudents]);

  return (
    <Card
      onClick={
        isSelectMode
          ? (e) => onToggleSelect(activity.id, e.shiftKey)
          : undefined
      }
      className={cn(
        "group relative justify-between gap-3 p-4 sm:p-5 sm:rounded-2xl transition-all duration-200 hover:shadow-md",
        isSelectMode && "cursor-pointer select-none",
        isSelected && "ring-2 ring-primary border-primary/60 bg-primary/5",
        isArchived
          ? "border-dashed border-border/80 opacity-80 hover:opacity-100"
          : "hover:border-primary/40"
      )}
    >
      <CardHeader className="p-0 flex flex-row items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {/* Selection Checkbox with Touch-Friendly Hit Target */}
          <div
            className="flex w-8 shrink-0 items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => {
                onToggleSelect(activity.id);
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (e.shiftKey) {
                  e.preventDefault();
                  onToggleSelect(activity.id, true);
                }
              }}
              aria-label={`Select activity: ${displayTargetText.slice(0, 40)}`}
              className="cursor-pointer"
            />
          </div>

          {isArchived ? (
            <Badge
              variant="outline"
              className="bg-muted/60 text-muted-foreground border-border/80"
            >
              Archived
            </Badge>
          ) : (
            <div className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              {activity.is_take_home ? (
                <span className="text-primary">
                  Take-home
                </span>
              ) : (
                <span className="text-foreground/80">
                  In-Class
                </span>
              )}
              <span className="text-muted-foreground/40">•</span>
              <span className="tabular-nums">
                {wordCount} {wordCount === 1 ? "word" : "words"}
              </span>
            </div>
          )}
        </div>

        {/* Overflow Actions Menu with 40px Touch Hit Target on Mobile */}
        <CardAction>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-10 sm:size-8 min-h-10 sm:min-h-8 text-muted-foreground hover:text-foreground"
                  aria-label={`Actions for activity: ${displayTargetText.slice(0, 40)}`}
                  onClick={(e) => e.stopPropagation()}
                />
              }
            >
              <MoreVertical aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onClick={() => onUpload(activity.id)}
                  className="min-h-9 cursor-pointer text-xs"
                >
                  <Upload aria-hidden="true" />
                  <span>Upload Worksheet</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDuplicate(activity)}
                  className="min-h-9 cursor-pointer text-xs"
                >
                  <Copy aria-hidden="true" />
                  <span>Duplicate Activity</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onEdit(activity)}
                  className="min-h-9 cursor-pointer text-xs"
                >
                  <Edit3 aria-hidden="true" />
                  <span>Edit Activity</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => router.push(`/activities/${activity.id}`)}
                  className="min-h-9 cursor-pointer text-xs"
                >
                  <Inbox aria-hidden="true" />
                  <span>View Submissions</span>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onClick={() => onToggleArchive(activity.id)}
                  className="min-h-9 cursor-pointer text-xs"
                >
                  {isArchived ? (
                    <>
                      <ArchiveRestore aria-hidden="true" />
                      <span>Unarchive Activity</span>
                    </>
                  ) : (
                    <>
                      <Archive aria-hidden="true" />
                      <span>Archive Activity</span>
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => onDelete(activity)}
                  className="min-h-9 cursor-pointer text-xs"
                >
                  <Trash2 aria-hidden="true" />
                  <span>Delete Activity</span>
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>

      <CardContent className="p-0 flex-1">
        {/* Target Text Preview with Cursive Worksheet Accent & 3-line Ruling */}
        <Link
          href={`/activities/${activity.id}`}
          title={`Open activity: ${displayTargetText}`}
          aria-label={`Open activity: ${displayTargetText}`}
          onClick={(e) => {
            if (isSelectMode) {
              e.preventDefault();
              e.stopPropagation();
              onToggleSelect(activity.id, e.shiftKey);
            }
          }}
          className="block rounded-xl transition-opacity group-hover:opacity-95 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CardTitle as="h3" className="mb-1 text-base font-semibold">
            {activity.title}
          </CardTitle>
          <p className="mb-3 text-xs text-muted-foreground">
            {activity.due_at ? `Due ${formatActivityDueAt(activity.due_at)}` : "No due date"}
          </p>
          <WorksheetPrompt text={activity.target_text} preview />
        </Link>
      </CardContent>

      <Separator />

      {/* Card Footer: Submission Progress Gauge & Direct Actions */}
      <CardFooter className="p-0 flex-col items-stretch gap-2.5">
        {/* Status header with count and timestamp */}
        <div className="flex items-center justify-between gap-1.5 text-xs">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-xs font-semibold text-foreground">
              {totalStudents > 0 ? (
                <span className="truncate tabular-nums">
                  {collectedStudents} of {totalStudents}{" "}
                  {totalStudents === 1 ? "student" : "students"}
                </span>
              ) : (
                <span className="truncate tabular-nums">
                  {totalAttempts}{" "}
                  {totalAttempts === 1 ? "upload" : "uploads"}
                </span>
              )}
            </span>

            {isFullyCollected && (
              <Badge
                variant="outline"
                className="shrink-0 border-band-4/30 bg-band-4/15 text-band-4-text"
              >
                <CheckCircle2 data-icon="inline-start" aria-hidden="true" />
                Complete
              </Badge>
            )}
          </div>

          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {relativeTime}
          </span>
        </div>

        {/* Visual Progress Bar (when totalStudents > 0) */}
        {totalStudents > 0 && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  aria-label={`Submission progress: ${completedCount} completed, ${processingCount} processing, ${rejectedCount} needing re-scan out of ${totalStudents} assigned students`}
                  onClick={(e) => e.stopPropagation()}
                  className="group/progress -my-1.5 h-auto w-full cursor-help rounded-full px-0 py-2 hover:bg-transparent active:not-aria-[haspopup]:translate-y-0 touch-manipulation"
                />
              }
            >
              <div
                aria-hidden="true"
                className="flex h-2 w-full overflow-hidden rounded-full bg-muted/60 shadow-warm-sm transition-all group-hover/progress:brightness-95"
              >
                {completedCount > 0 && (
                  <div
                    className="bg-primary transition-all duration-300 motion-reduce:transition-none"
                    style={{
                      width: `${Math.min((completedCount / totalStudents) * 100, 100)}%`,
                    }}
                  />
                )}
                {processingCount > 0 && (
                  <div
                    className="bg-warning transition-all duration-300 motion-reduce:transition-none"
                    style={{
                      width: `${Math.min((processingCount / totalStudents) * 100, 100)}%`,
                    }}
                  />
                )}
                {rejectedCount > 0 && (
                  <div
                    className="bg-destructive transition-all duration-300 motion-reduce:transition-none"
                    style={{
                      width: `${Math.min((rejectedCount / totalStudents) * 100, 100)}%`,
                    }}
                  />
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              sideOffset={6}
              arrowClassName="bg-popover fill-popover border-b border-r border-border"
              className="flex min-w-[220px] flex-col items-stretch gap-2 rounded-xl border border-border bg-popover p-3 text-xs text-popover-foreground shadow-warm"
            >
              <div className="flex items-center justify-between font-semibold text-foreground">
                <span className="font-heading text-xs font-medium">Assigned Students</span>
                <Badge variant="secondary" className="tabular-nums">
                  {collectedStudents}/{totalStudents}
                </Badge>
              </div>
              <Separator />
              <div className="flex flex-col gap-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-medium text-foreground/90">
                    <span className="inline-block size-2 shrink-0 rounded-full bg-primary shadow-warm-sm" />
                    Completed
                  </span>
                  <span className="font-semibold tabular-nums text-foreground">{completedCount}</span>
                </div>
                {processingCount > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-medium text-band-2-text">
                      <span className="inline-block size-2 shrink-0 rounded-full bg-warning" />
                      Processing
                    </span>
                    <span className="font-semibold tabular-nums text-band-2-text">{processingCount}</span>
                  </div>
                )}
                {rejectedCount > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-medium text-destructive">
                      <span className="inline-block size-2 shrink-0 rounded-full bg-destructive" />
                      Needs Re-scan
                    </span>
                    <span className="font-semibold tabular-nums text-destructive">{rejectedCount}</span>
                  </div>
                )}
                {Math.max(0, totalStudents - collectedStudents) > 0 && (
                  <>
                    <Separator className="my-0.5" />
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block size-2 shrink-0 rounded-full bg-muted-foreground/30" />
                        Not submitted
                      </span>
                      <span className="font-medium tabular-nums">
                        {Math.max(0, totalStudents - collectedStudents)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Triage-First Assessment Status Subtext */}
        <div className="flex items-center justify-between pt-0.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5 truncate">
            <span
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                rejectedCount > 0
                  ? "bg-destructive"
                  : processingCount > 0
                    ? "bg-warning"
                    : completedCount > 0
                      ? "bg-primary"
                      : "bg-muted-foreground/50"
              )}
            />
            <span className="truncate tabular-nums">
              {rejectedCount > 0 && completedCount > 0
                ? `${rejectedCount} ${rejectedCount === 1 ? "needs" : "need"} re-scan · ${completedCount} ready to review`
                : rejectedCount > 0
                  ? `${rejectedCount} ${rejectedCount === 1 ? "worksheet needs" : "worksheets need"} re-scan`
                  : processingCount > 0
                    ? `${processingCount} ${processingCount === 1 ? "worksheet" : "worksheets"} analyzing`
                    : completedCount > 0
                      ? `${completedCount} ${completedCount === 1 ? "worksheet" : "worksheets"} ready to review`
                      : collectedStudents > 0
                        ? `${collectedStudents} collected · Ready to review`
                        : "Awaiting worksheet uploads"}
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
            className="h-10 sm:h-9 min-h-10 sm:min-h-9 w-full justify-center px-2 text-xs font-medium"
            title={isFullyCollected ? "Upload additional worksheet scans" : "Upload student worksheet scans"}
            aria-label={
              isFullyCollected
                ? `Upload more worksheets for ${displayTargetText}`
                : `Upload worksheet for ${displayTargetText}`
            }
          >
            <Upload data-icon="inline-start" className="text-primary" aria-hidden="true" />
            <span className="truncate">{isFullyCollected ? "Upload More" : "Upload"}</span>
          </Button>

          <Button
            nativeButton={false}
            variant={isFullyCollected ? "default" : "secondary"}
            size="sm"
            render={
              <Link
                href={`/activities/${activity.id}`}
                onClick={(e) => {
                  if (isSelectMode) {
                    e.stopPropagation();
                  }
                }}
              />
            }
            className="group/btn h-10 sm:h-9 min-h-10 sm:min-h-9 w-full justify-center px-2 text-xs font-semibold shadow-warm-sm"
            title={isFullyCollected ? "Review completed submissions" : "View submissions for this activity"}
            aria-label={
              isFullyCollected
                ? `Review submissions for ${displayTargetText}`
                : `View submissions for ${displayTargetText}`
            }
          >
            <Inbox data-icon="inline-start" aria-hidden="true" />
            <span className="truncate">{isFullyCollected ? "Review" : "Submissions"}</span>
            <span className="ml-1 shrink-0 text-xs transition-transform group-hover/btn:translate-x-0.5 motion-reduce:transform-none">
              &rarr;
            </span>
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
});

