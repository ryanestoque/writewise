"use client";

import { useActivityNow } from "@/components/activities/activity-work-status";
import { formatActivityDueAt } from "@/lib/utils/activity-deadlines";
import { compareParentActivityUrgency, getParentActivityStatus } from "@/lib/utils/parent-activity-status";
import type { TakeHomeActivity, TakeHomeActivitySubmission } from "@/lib/hooks/use-parent-data";
import { useState, useMemo } from "react";
import { WorkCommentsButton } from "@/components/comments/submission-comment-picker-sheet";
import {
  useTakeHomeActivities,
  useChildSubmissionForActivity,
} from "@/lib/hooks/use-parent-data";
import { BandBadge } from "@/components/shared/band-badge";
import { QueryRecovery } from "@/components/shared/query-recovery";
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
  Clock3,
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
  PARENT_CRITERIA_METADATA,
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
  const [showAllTakeHome, setShowAllTakeHome] = useState(false);
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;
  const toggleExpanded = onToggleExpanded || (() => setInternalExpanded((prev) => !prev));
  const { data: activities, isLoading, isError, isFetching, refetch } = useTakeHomeActivities(childId);
  const now = useActivityNow();

  // Filter to take-home activities only (in-class worksheets are graded by the teacher and shown in Past Worksheets)
  const takeHomeOnly = useMemo(() => {
    if (!activities) return [];
    return activities.filter((a) => a.isTakeHome);
  }, [activities]);

  // Resubmissions and deadlines come before routine practice items.
  const sortedTakeHome = useMemo(() => {
    return [...takeHomeOnly].sort((a, b) => {
      const priority = compareParentActivityUrgency(a, b, now);
      if (priority !== 0) return priority;

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [takeHomeOnly, now]);

  const toDoActivities = useMemo(() => {
    return sortedTakeHome.filter((work) => {
      const { category } = getParentActivityStatus(work, now);
      return category === "todo" || category === "processing";
    });
  }, [sortedTakeHome, now]);

  const submittedAndClosed = useMemo(() => {
    const toDoIds = new Set(toDoActivities.map((item) => item.id));
    return sortedTakeHome.filter((item) => !toDoIds.has(item.id));
  }, [sortedTakeHome, toDoActivities]);

  const closedWithoutPhotoCount = submittedAndClosed.filter(
    (work) => getParentActivityStatus(work, now).category === "closed"
  ).length;

  if (isLoading) {
    return (
      <div role="status" aria-live="polite" className="flex flex-col items-center justify-center py-8 gap-2">
        <Loader2 className="size-5 animate-spin motion-reduce:animate-none text-muted-foreground" aria-hidden="true" />
        <span className="text-sm text-muted-foreground">Checking practice worksheets...</span>
      </div>
    );
  }

  const recovery = isError ? (
    <QueryRecovery
      title={activities === undefined ? "Could not load practice worksheets" : "Could not refresh practice worksheets"}
      description={activities === undefined
        ? "Please check your connection and try again to see assigned worksheets."
        : "Showing the worksheets loaded earlier. Try again to check for assignment updates."}
      onRetry={() => { void refetch(); }}
      isRetrying={isFetching}
    />
  ) : null;

  if (isError && activities === undefined) return recovery;

  if (sortedTakeHome.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        {recovery}
        <Empty className="border border-border rounded-xl shadow-warm bg-card py-8">
          <EmptyMedia variant="icon" className="bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300">
            <ClipboardList className="size-6" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>No Practice Worksheets Assigned</EmptyTitle>
            <EmptyDescription className="text-sm max-w-md mx-auto leading-relaxed">
              When your child&apos;s teacher assigns take-home cursive practice, it will appear right here with a button to send a photo.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  const activeList = showAllTakeHome ? [...toDoActivities, ...submittedAndClosed] : toDoActivities;
  const visibleActivities =
    activeList.length > 3 && !isExpanded ? activeList.slice(0, 3) : activeList;
  const focusMeta = practiceFocusKey ? PARENT_CRITERIA_METADATA[practiceFocusKey] : null;

  return (
    <div className="space-y-3">
      {recovery}
      {focusMeta && toDoActivities.length > 0 && (
        <div className="rounded-xl border border-band-2/30 dark:border-band-2/40 bg-band-2/10 dark:bg-band-2/20 px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed">
          <span className="inline-flex items-center gap-1.5 font-semibold text-band-2-text dark:text-amber-200 mr-1.5">
            <span className="size-1.5 rounded-full bg-band-2 shrink-0" aria-hidden="true" />
            Active practice focus: {focusMeta.label}.
          </span>
          <span className="text-foreground/90">{focusMeta.homeTip}</span>
        </div>
      )}
      {toDoActivities.length === 0 && !showAllTakeHome ? (
        <div className="rounded-xl border border-border bg-card p-5 text-center space-y-3">
          <div className="size-9 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center mx-auto">
            {closedWithoutPhotoCount > 0 ? <Clock3 className="size-5" aria-hidden="true" /> : <CheckCircle2 className="size-5" aria-hidden="true" />}
          </div>
          <div className="space-y-1">
            <p className="text-sm sm:text-base font-semibold text-foreground">
              {closedWithoutPhotoCount > 0 ? "Some worksheets are closed" : "All caught up!"}
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
              {closedWithoutPhotoCount > 0
                ? `${closedWithoutPhotoCount} ${closedWithoutPhotoCount === 1 ? "worksheet still needs" : "worksheets still need"} a photo, but submissions are closed. Ask the teacher about sending it late.`
                : "Nothing to send right now. Your practice worksheets have been turned in."}
            </p>
          </div>
          {submittedAndClosed.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setShowAllTakeHome(true);
                if (!isExpanded) toggleExpanded();
              }}
              className="h-auto min-h-11 max-w-full whitespace-normal px-3.5 py-2"
            >
              Show submitted and closed sheets ({submittedAndClosed.length})
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
                className="h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 gap-1.5 cursor-pointer rounded-lg border border-border/60 bg-card shadow-2xs"
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

            {submittedAndClosed.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setShowAllTakeHome((prev) => !prev);
                  if (!showAllTakeHome && !isExpanded) toggleExpanded();
                }}
                aria-expanded={showAllTakeHome}
                aria-controls="take-home-activities-grid"
                className="text-xs sm:text-sm font-medium text-primary hover:underline cursor-pointer px-2 py-1 min-h-11 inline-flex items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {showAllTakeHome
                  ? `Hide submitted and closed (${submittedAndClosed.length})`
                  : `Show submitted and closed (${submittedAndClosed.length})`}
              </button>
            )}
          </div>
          {!showAllTakeHome && closedWithoutPhotoCount > 0 && (
            <p className="text-sm text-muted-foreground">
              {closedWithoutPhotoCount} {closedWithoutPhotoCount === 1 ? "closed worksheet still needs" : "closed worksheets still need"} a photo. Open the submitted and closed sheets to see details.
            </p>
          )}
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
}: {
  work: TakeHomeActivity;
  activityId: string;
  targetText: string;
  createdAt: string;
  childId: string | null;
  initialSubmission?: TakeHomeActivitySubmission | null;
  onUploadClick: () => void;
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
  const { closed, processing: isProcessing, rejected: isRejected, returned: isReturned, category, excused } =
    getParentActivityStatus({ ...work, submission }, now);
  const isCompleted = submission?.status === "completed";

  const isTitleSameAsTarget =
    work.title.trim().toLowerCase() === targetText.trim().toLowerCase() ||
    targetText.startsWith(work.title);

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 flex flex-col justify-between gap-3 transition-colors",
        isRejected
          ? "border-warning/50 dark:border-warning/60 bg-warning/5 dark:bg-warning/10"
          : "border-border/80"
      )}
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground font-medium font-sans tabular-nums">
            {excused ? "Excused · Optional practice" : category === "closed" ? "Closed · Photo still needed" : work.dueAt ? `Due ${formatActivityDueAt(work.dueAt)}` : `Assigned ${formattedDate}`}
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

        {excused && <p className="text-sm text-muted-foreground">This worksheet is excused from coursework totals. Your child can still practise.</p>}
        {isReturned && !excused && (
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

        {closed && !excused && (
          <p role="status" className="text-sm text-muted-foreground">
            The deadline has passed. Ask your teacher if you need to send a late photo.
          </p>
        )}
      </div>

      {/* Action Footer */}
      <div className="pt-2.5 border-t border-border/50 flex flex-wrap items-center justify-between gap-2">
        {childId && (work.attempts.length || submission?.submissionId) ? <WorkCommentsButton
          scope={{ activityId, studentId: childId }} activeSubmissionId={work.workState?.active_submission_id ?? null} />
          : <p className="text-xs text-muted-foreground">Comments are available after a worksheet is uploaded.</p>}
        {isLoading ? (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            <span>Checking status...</span>
          </div>
        ) : isProcessing ? (
          <div role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            Checking handwriting…
          </div>
        ) : isRejected ? (
          <div className="space-y-2.5 w-full">
            {(() => {
              const rejection = getRejectionSummary(submission?.rejectionCode ?? null);
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
                  className="h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] min-w-10 sm:min-w-0 text-xs font-medium text-destructive hover:bg-destructive/10 hover:text-destructive gap-1 px-2.5 rounded-lg border border-destructive/20 cursor-pointer"
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
                  className="h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] text-xs sm:text-sm font-medium gap-1.5 cursor-pointer shrink-0 border-border/80 hover:bg-muted/50 px-3"
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
                This permanently deletes your uploaded photo and its comments for &ldquo;{targetText}&rdquo;. You can take and send a new photo anytime.
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
