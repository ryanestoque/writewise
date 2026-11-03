"use client";

import { useActivityNow } from "@/components/activities/activity-work-status";
import { activitySubmissionsClosed, formatActivityDueAt } from "@/lib/utils/activity-deadlines";
import type { TakeHomeActivity, TakeHomeActivitySubmission } from "@/lib/hooks/use-parent-data";
import { useState, useMemo } from "react";
import {
  useTakeHomeActivities,
  useChildSubmissionForActivity,
} from "@/lib/hooks/use-parent-data";
import { BandBadge } from "@/components/shared/band-badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Upload,
  ClipboardList,
  Loader2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Camera,
  Trash2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDeleteSubmission } from "@/lib/hooks/use-submissions";
import { toast } from "sonner";
import { getRejectionSummary } from "@/lib/utils/submission-status";
import {
  getActivitySkillMeta,
  type CriterionKey,
} from "@/lib/utils/scoring";
import { cn } from "@/lib/utils";

interface TakeHomeActivitiesProps {
  childId: string | null;
  onUploadClick: (activityId: string) => void;
  expanded?: boolean;
  onToggleExpanded?: () => void;
  showExpandButton?: boolean;
  gridClassName?: string;
  practiceFocusKey?: CriterionKey | null;
}

export function TakeHomeActivities({
  childId,
  onUploadClick,
  expanded: controlledExpanded,
  onToggleExpanded,
  showExpandButton = true,
  gridClassName = "grid grid-cols-1 gap-3.5",
  practiceFocusKey,
}: TakeHomeActivitiesProps) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [showCompletedTakeHome, setShowCompletedTakeHome] = useState(false);
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;
  const toggleExpanded = onToggleExpanded || (() => setInternalExpanded((prev) => !prev));
  const { data: activities, isLoading, isError, refetch } = useTakeHomeActivities(childId);
  const now = useActivityNow();

  // Filter to take-home activities only (in-class worksheets are graded by the teacher and shown in Past Worksheets)
  const takeHomeOnly = useMemo(() => {
    if (!activities) return [];
    return activities.filter((a) => a.isTakeHome);
  }, [activities]);

  // Sort actionable items first: 1. Photo retake -> 2. Returned -> 3. Practice focus match -> 4. Newest
  const sortedTakeHome = useMemo(() => {
    return [...takeHomeOnly].sort((a, b) => {
      const aSub = a.submission ?? a.latestSubmission;
      const bSub = b.submission ?? b.latestSubmission;

      const aRejected = aSub?.status === "rejected";
      const bRejected = bSub?.status === "rejected";
      if (aRejected && !bRejected) return -1;
      if (!aRejected && bRejected) return 1;

      const aReturned =
        aSub?.status === "returned" ||
        Boolean(a.workState?.returned_at && !a.workState?.active_submission_id);
      const bReturned =
        bSub?.status === "returned" ||
        Boolean(b.workState?.returned_at && !b.workState?.active_submission_id);
      if (aReturned && !bReturned) return -1;
      if (!aReturned && bReturned) return 1;

      if (practiceFocusKey) {
        const aMatches = getActivitySkillMeta(a.targetText).criterionKey === practiceFocusKey;
        const bMatches = getActivitySkillMeta(b.targetText).criterionKey === practiceFocusKey;
        if (aMatches && !bMatches) return -1;
        if (!aMatches && bMatches) return 1;
      }

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [takeHomeOnly, practiceFocusKey]);

  const toDoActivities = useMemo(() => {
    return sortedTakeHome.filter((work) => {
      const closed = activitySubmissionsClosed(
        { due_at: work.dueAt, close_after_due: work.closeAfterDue },
        now
      );
      if (closed) return false;
      const sub = work.submission ?? work.latestSubmission;
      if (!sub) return true;
      if (sub.status === "rejected" || sub.status === "returned" || sub.status === "processing") {
        return true;
      }
      if (work.workState?.returned_at && !work.workState?.active_submission_id) {
        return true;
      }
      return false;
    });
  }, [sortedTakeHome, now]);

  const completedTakeHome = useMemo(() => {
    const toDoIds = new Set(toDoActivities.map((item) => item.id));
    return sortedTakeHome.filter((item) => !toDoIds.has(item.id));
  }, [sortedTakeHome, toDoActivities]);

  if (isLoading) {
    return (
      <div role="status" aria-live="polite" className="flex flex-col items-center justify-center py-8 gap-2">
        <Loader2 className="size-5 animate-spin motion-reduce:animate-none text-muted-foreground" aria-hidden="true" />
        <span className="text-sm text-muted-foreground">Checking take-home tasks...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div role="alert" className="flex flex-col items-start gap-2 rounded-xl border border-border p-4">
        <p className="text-sm">Could not load take-home activities.</p>
        <Button variant="outline" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  if (sortedTakeHome.length === 0) {
    return (
      <Empty className="border border-border rounded-xl shadow-warm bg-card py-8">
        <EmptyMedia variant="icon" className="bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300">
          <ClipboardList className="size-6" />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle>No Take-Home Sheets Assigned</EmptyTitle>
          <EmptyDescription className="text-sm max-w-md mx-auto leading-relaxed">
            When your child&apos;s teacher assigns take-home cursive practice, it will appear right here with a button to send a photo.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const activeList = showCompletedTakeHome ? sortedTakeHome : toDoActivities;
  const visibleActivities =
    activeList.length > 3 && !isExpanded ? activeList.slice(0, 3) : activeList;

  return (
    <div className="space-y-3">
      {toDoActivities.length === 0 && !showCompletedTakeHome ? (
        <div className="rounded-xl border border-border bg-card shadow-warm p-5 text-center space-y-3">
          <div className="size-9 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center mx-auto">
            <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <p className="text-sm sm:text-base font-semibold text-foreground">All caught up!</p>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
              Nothing to send right now. All assigned take-home practice sheets have been turned in.
            </p>
          </div>
          {completedTakeHome.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowCompletedTakeHome(true)}
              className="text-xs sm:text-sm text-foreground h-9 min-h-[36px] px-3.5 font-medium cursor-pointer"
            >
              Show completed take-home sheets ({completedTakeHome.length})
            </Button>
          )}
        </div>
      ) : (
        <>
          <div id="take-home-activities-grid" className={gridClassName}>
            {visibleActivities.map((activity) => (
              <ActivityCard
                key={activity.id}
                work={activity}
                activityId={activity.id}
                targetText={activity.targetText}
                createdAt={activity.createdAt}
                childId={childId}
                initialSubmission={activity.submission}
                onUploadClick={() => onUploadClick(activity.id)}
                practiceFocusKey={practiceFocusKey}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            {activeList.length > 3 && showExpandButton && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={toggleExpanded}
                aria-expanded={isExpanded}
                aria-controls="take-home-activities-grid"
                className="h-9 min-h-[36px] text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 gap-1.5 cursor-pointer rounded-lg border border-border/60 bg-card shadow-2xs"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="size-3.5" aria-hidden="true" />
                    <span>Show fewer</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="size-3.5" aria-hidden="true" />
                    <span>See all ({activeList.length})</span>
                  </>
                )}
              </Button>
            )}

            {completedTakeHome.length > 0 && (
              <button
                type="button"
                onClick={() => setShowCompletedTakeHome((prev) => !prev)}
                className="text-xs sm:text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline cursor-pointer px-2 py-1 min-h-[36px] inline-flex items-center"
              >
                {showCompletedTakeHome
                  ? `Hide completed (${completedTakeHome.length})`
                  : `Show completed (${completedTakeHome.length})`}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ActivityCard({
  work,
  activityId,
  targetText,
  createdAt,
  childId,
  initialSubmission,
  onUploadClick,
  practiceFocusKey,
}: {
  work: TakeHomeActivity;
  activityId: string;
  targetText: string;
  createdAt: string;
  childId: string | null;
  initialSubmission?: TakeHomeActivitySubmission | null;
  onUploadClick: () => void;
  practiceFocusKey?: CriterionKey | null;
}) {
  const shouldFetchIndividually = initialSubmission === undefined;
  const { data: individualSubmission, isLoading: individualLoading } =
    useChildSubmissionForActivity(
      shouldFetchIndividually ? childId : null,
      shouldFetchIndividually ? activityId : ""
    );

  const submission =
    initialSubmission !== undefined ? initialSubmission : individualSubmission;
  const isLoading = shouldFetchIndividually && individualLoading;

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const deleteMutation = useDeleteSubmission();

  const handleDelete = async () => {
    if (!submission?.submissionId) return;
    try {
      await deleteMutation.mutateAsync(submission.submissionId);
      toast.success("Photo removed. You can send a new photo anytime.");
      setIsDeleteDialogOpen(false);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to delete submission";
      toast.error(errorMsg);
    }
  };

  const formattedDate = new Date(createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  const now = useActivityNow();
  const closed = activitySubmissionsClosed(
    { due_at: work.dueAt, close_after_due: work.closeAfterDue },
    now
  );
  const isProcessing =
    submission?.status === "processing" || work.latestSubmission?.status === "processing";
  const isCompleted = submission?.status === "completed";
  const isRejected = submission?.status === "rejected";
  const isReturned =
    submission?.status === "returned" ||
    Boolean(work.workState?.returned_at && !work.workState?.active_submission_id);

  const needsUpload = !submission || isRejected || isReturned;

  const skillMeta = useMemo(() => getActivitySkillMeta(targetText), [targetText]);
  const isPracticeFocusMatch =
    practiceFocusKey != null && skillMeta.criterionKey === practiceFocusKey;

  const isTitleSameAsTarget =
    work.title.trim().toLowerCase() === targetText.trim().toLowerCase() ||
    targetText.startsWith(work.title);

  return (
    <div
      className={cn(
        "rounded-xl border bg-card shadow-warm p-4 flex flex-col justify-between gap-3 transition-all",
        isRejected
          ? "border-warning/50 dark:border-warning/60 bg-warning/5 dark:bg-warning/10"
          : isPracticeFocusMatch && needsUpload
            ? "border-amber-300/80 dark:border-amber-700/70 bg-amber-50/25 dark:bg-amber-950/20"
            : "border-border/80"
      )}
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground font-medium">
            {work.dueAt ? `Due ${formatActivityDueAt(work.dueAt)}` : `Assigned ${formattedDate}`}
          </span>
          <span
            className={cn(
              "inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-md border shrink-0",
              isPracticeFocusMatch
                ? "bg-amber-100/90 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border-amber-300/80 dark:border-amber-700/80"
                : "bg-muted/70 text-muted-foreground border-border/60"
            )}
          >
            {isPracticeFocusMatch && (
              <span className="size-1.5 rounded-full bg-amber-600 dark:bg-amber-400 mr-1.5 shrink-0" aria-hidden="true" />
            )}
            {isPracticeFocusMatch
              ? `Recommended · ${skillMeta.shortLabel}`
              : `Skill: ${skillMeta.shortLabel}`}
          </span>
        </div>

        <div className="space-y-1">
          <h3 className="text-base font-semibold leading-snug text-foreground" title={work.title}>
            {work.title}
          </h3>
          {!isTitleSameAsTarget && (
            <p className="text-sm text-foreground/90 italic font-normal">
              &ldquo;{targetText}&rdquo;
            </p>
          )}
          {work.instructions && (
            <p className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed">
              {work.instructions}
            </p>
          )}
        </div>

        {work.latestSubmission?.submissionId !== submission?.submissionId &&
          work.latestSubmission?.status === "rejected" && (
            <p role="status" className="text-sm text-muted-foreground">
              Latest photo needs a clearer shot: {getRejectionSummary(work.latestSubmission.rejectionCode).label}. Your earlier result is still saved.
            </p>
          )}

        {work.latestSubmission?.submissionId !== submission?.submissionId &&
          work.latestSubmission?.status === "processing" && (
            <p role="status" className="text-sm text-muted-foreground">
              Checking your new photo now. Your earlier result stays saved until it finishes.
            </p>
          )}

        {isReturned && (
          <div className="flex flex-col gap-1 rounded-lg border border-border p-3 text-sm bg-muted/30">
            <p className="font-semibold text-foreground">Teacher asked for a new photo</p>
            {work.workState?.return_reason && (
              <p className="text-muted-foreground">
                Reason: {work.workState.return_reason.replaceAll("_", " ")}
              </p>
            )}
            {work.workState?.return_note && (
              <p className="text-foreground">{work.workState.return_note}</p>
            )}
          </div>
        )}

        {closed && (
          <p role="status" className="text-sm text-muted-foreground">
            The deadline has passed. Ask your teacher if you need to send a late photo.
          </p>
        )}
      </div>

      {/* Action Footer */}
      <div className="pt-2.5 border-t border-border/50 flex flex-wrap items-center justify-between gap-2">
        {isLoading ? (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            <span>Checking status...</span>
          </div>
        ) : isRejected ? (
          <div className="space-y-2.5 w-full">
            {(() => {
              const rejection = getRejectionSummary(submission?.rejectionCode);
              return (
                <div
                  role="status"
                  aria-live="polite"
                  className="space-y-1 text-sm bg-warning/10 dark:bg-warning/20 border border-warning/40 dark:border-warning/50 p-3 rounded-lg leading-normal"
                >
                  <div className="flex items-center gap-1.5 font-semibold text-warning-foreground">
                    <Camera className="size-4 shrink-0 text-warning-foreground" aria-hidden="true" />
                    <span>Clearer photo needed: {rejection.label}</span>
                  </div>
                  <p className="text-sm text-foreground/90 pl-5 leading-relaxed">
                    {rejection.detail}
                  </p>
                </div>
              );
            })()}

            <Button
              variant="default"
              size="sm"
              className="h-10 min-h-[40px] gap-1.5 w-full font-semibold cursor-pointer text-sm"
              onClick={onUploadClick}
              disabled={closed}
              aria-label={`Send new photo for "${targetText}"`}
            >
              <Camera className="size-4" aria-hidden="true" />
              <span>Send new photo</span>
            </Button>
          </div>
        ) : isCompleted ? (
          <>
            <div className="flex items-center gap-2 min-w-0">
              <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-brand-700 dark:text-brand-300">
                <CheckCircle2 className="size-4 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                {work.workState?.work_status === "Released" ? "Scored" : "Turned in"}
              </span>
              {submission?.compositeScore != null && (
                <BandBadge score={submission.compositeScore} size="sm" />
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {submission?.canDelete && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsDeleteDialogOpen(true)}
                  disabled={deleteMutation.isPending}
                  className="h-9 min-h-[36px] text-xs font-medium text-destructive hover:bg-destructive/10 hover:text-destructive gap-1 px-2.5 rounded-lg border border-destructive/20 cursor-pointer"
                  title="Delete this photo"
                  aria-label="Delete this photo"
                >
                  <Trash2 className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="hidden sm:inline">Delete</span>
                </Button>
              )}

              {!closed && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 min-h-[36px] text-xs sm:text-sm font-medium gap-1.5 cursor-pointer shrink-0 border-border/80 hover:bg-muted/50 px-3"
                  onClick={onUploadClick}
                  disabled={isProcessing}
                  aria-label={`Send new photo for "${targetText}"`}
                >
                  <Upload className="size-3.5 shrink-0" aria-hidden="true" />
                  <span>Send new photo</span>
                </Button>
              )}
            </div>
          </>
        ) : isReturned ? (
          <Button
            variant="default"
            size="sm"
            className="h-10 min-h-[40px] text-sm font-semibold gap-1.5 cursor-pointer w-full"
            onClick={onUploadClick}
            disabled={closed}
          >
            <Upload className="size-4" aria-hidden="true" />
            <span>Send new photo</span>
          </Button>
        ) : isProcessing ? (
          <div role="status" aria-live="polite" className="flex items-center gap-2 min-w-0">
            <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-warning-foreground bg-warning/15 dark:bg-warning/25 px-3 py-1 rounded-md border border-warning/30">
              <Loader2 className="size-4 shrink-0 animate-spin motion-reduce:animate-none text-warning-foreground" aria-hidden="true" />
              Checking handwriting…
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between w-full gap-2">
            <span className="text-xs text-muted-foreground truncate hidden sm:inline">
              Flat paper · Good light · All 4 corners
            </span>
            <Button
              variant="default"
              size="sm"
              className="h-10 min-h-[40px] gap-1.5 font-semibold cursor-pointer text-sm sm:w-auto w-full px-4"
              onClick={onUploadClick}
              disabled={closed}
              aria-label={`Send photo for "${targetText}"`}
            >
              <Upload className="size-4" aria-hidden="true" />
              <span>Send photo</span>
            </Button>
          </div>
        )}

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this photo?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes your uploaded photo for &ldquo;{targetText}&rdquo;. You can take and send a new photo anytime.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                disabled={deleteMutation.isPending}
                onClick={() => setIsDeleteDialogOpen(false)}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={deleteMutation.isPending}
                onClick={(e) => {
                  e.preventDefault();
                  handleDelete();
                }}
                variant="destructive"
                className="gap-2 cursor-pointer"
              >
                {deleteMutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  "Delete Photo"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
