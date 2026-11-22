"use client";

import { humanizeReason } from "@/lib/utils/humanize-reason";
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
import { useCommentAccountId, useUnreadCommentThreads } from "@/lib/hooks/use-comments";
import { useSubmissionImageUrl } from "@/lib/hooks/use-submissions";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  PenTool,
  Eye,
  AlertTriangle,
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
  onOpenCursiveGuide?: (initialLetter?: string) => void;
}

export function TakeHomeActivities({
  childId,
  onUploadClick,
  expanded: controlledExpanded,
  onToggleExpanded,
  showExpandButton = true,
  gridClassName = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4",
  practiceFocusKey,
  onOpenCursiveGuide,
}: TakeHomeActivitiesProps) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [showPastSheets, setShowPastSheets] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<{
    imagePath: string;
    title: string;
    targetText: string;
  } | null>(null);

  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;
  const toggleExpanded = onToggleExpanded || (() => setInternalExpanded((prev) => !prev));
  const { data: activities, isLoading, isError, isFetching, refetch } = useTakeHomeActivities(childId);
  const userId = useCommentAccountId();
  const unread = useUnreadCommentThreads(userId ?? "");
  const now = useActivityNow();

  // Filter to take-home activities only (in-class worksheets are handled in Progress)
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

  const awaitingReviewActivities = useMemo(() => {
    const toDoIds = new Set(toDoActivities.map((item) => item.id));
    return sortedTakeHome.filter((work) => {
      if (toDoIds.has(work.id)) return false;
      const { excused } = getParentActivityStatus(work, now);
      if (excused) return false;
      return (
        work.submission?.status === "completed" &&
        work.workState?.work_status !== "Released"
      );
    });
  }, [sortedTakeHome, toDoActivities, now]);

  const pastSheets = useMemo(() => {
    const visibleIds = new Set([
      ...toDoActivities.map((item) => item.id),
      ...awaitingReviewActivities.map((item) => item.id),
    ]);
    return sortedTakeHome.filter((item) => !visibleIds.has(item.id));
  }, [sortedTakeHome, toDoActivities, awaitingReviewActivities]);

  const closedWithoutPhotoCount = pastSheets.filter(
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
            <ClipboardList className="size-6" aria-hidden="true" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>No practice worksheets assigned</EmptyTitle>
            <EmptyDescription className="text-sm max-w-md mx-auto leading-relaxed">
              When your child&apos;s teacher assigns take-home cursive practice, it will appear right here with a prompt to guide their handwriting on paper.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  const visibleToDo =
    toDoActivities.length > 3 && !isExpanded ? toDoActivities.slice(0, 3) : toDoActivities;
  const focusMeta = practiceFocusKey ? PARENT_CRITERIA_METADATA[practiceFocusKey] : null;

  return (
    <div className="space-y-4">
      {recovery}

      {/* Elevated Practice Focus Coaching Strip */}
      {focusMeta && toDoActivities.length > 0 && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 dark:bg-primary/10 p-3 sm:p-4 flex items-start gap-3 text-xs sm:text-sm">
          <PenTool className="size-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-0.5 flex-1 min-w-0">
            <p className="font-semibold text-foreground">
              Practice focus: {focusMeta.label}
            </p>
            <p className="text-muted-foreground leading-relaxed">
              {focusMeta.homeTip}
            </p>
          </div>
          {practiceFocusKey === "letter_formation" && onOpenCursiveGuide && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenCursiveGuide("A")}
              className="shrink-0 h-9 min-h-[36px] text-xs font-medium cursor-pointer border-primary/30 text-primary hover:bg-primary/10"
            >
              Open guide
            </Button>
          )}
        </div>
      )}

      {/* Primary To-Do Worksheets Area */}
      {toDoActivities.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-5 text-center space-y-3">
          <div className="size-9 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center mx-auto">
            {closedWithoutPhotoCount > 0 ? (
              <Clock3 className="size-5" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="size-5" aria-hidden="true" />
            )}
          </div>
          <div className="space-y-1">
            <p className="text-sm sm:text-base font-semibold text-foreground">
              {closedWithoutPhotoCount > 0 ? "Some worksheets are closed" : "All caught up!"}
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
              {closedWithoutPhotoCount > 0
                ? `${closedWithoutPhotoCount} ${closedWithoutPhotoCount === 1 ? "worksheet is past due" : "worksheets are past due"}, but submissions are closed. Ask the teacher if you need to submit late.`
                : awaitingReviewActivities.length > 0
                  ? "Nothing to send right now. Your turned-in worksheets are waiting for teacher review below."
                  : "Nothing to send right now. All assigned practice worksheets have been turned in."}
            </p>
          </div>
        </div>
      ) : (
        <>
          <div id="take-home-activities-grid" className={gridClassName}>
            {visibleToDo.map((activity) => (
              <ActivityCard
                key={activity.id}
                work={activity}
                activityId={activity.id}
                targetText={activity.targetText}
                createdAt={activity.createdAt}
                childId={childId}
                initialSubmission={activity.submission}
                onUploadClick={() => onUploadClick(activity.id)}
                onOpenCursiveGuide={onOpenCursiveGuide}
                onPreviewPhoto={(imagePath, title, targetText) =>
                  setPhotoPreview({ imagePath, title, targetText })
                }
                hasUnreadComments={
                  activity.attempts.some((a) => unread.data?.has(a.id)) ||
                  (activity.submission?.submissionId
                    ? Boolean(unread.data?.has(activity.submission.submissionId))
                    : false)
                }
              />
            ))}
          </div>

          {toDoActivities.length > 3 && showExpandButton && (
            <div className="pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={toggleExpanded}
                aria-expanded={isExpanded}
                aria-controls="take-home-activities-grid"
                className="h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] text-xs sm:text-sm font-medium gap-1.5 cursor-pointer"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="size-3.5" aria-hidden="true" />
                    <span>Show fewer</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="size-3.5" aria-hidden="true" />
                    <span>See all ({toDoActivities.length})</span>
                  </>
                )}
              </Button>
            </div>
          )}
        </>
      )}

      {/* Dedicated Section: Waiting for Teacher Review */}
      {awaitingReviewActivities.length > 0 && (
        <section aria-labelledby="awaiting-review-heading" className="space-y-3 pt-4 border-t border-border/60">
          <div className="flex items-baseline gap-2">
            <h3 id="awaiting-review-heading" className="font-heading text-sm sm:text-base font-semibold text-foreground">
              Waiting for teacher review
            </h3>
            <span className="text-xs text-muted-foreground font-sans tabular-nums">
              ({awaitingReviewActivities.length})
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            These worksheets have been turned in. Your teacher reviews every submission before grades and feedback are released.
          </p>
          <div className={gridClassName}>
            {awaitingReviewActivities.map((activity) => (
              <ActivityCard
                key={activity.id}
                work={activity}
                activityId={activity.id}
                targetText={activity.targetText}
                createdAt={activity.createdAt}
                childId={childId}
                initialSubmission={activity.submission}
                onUploadClick={() => onUploadClick(activity.id)}
                onOpenCursiveGuide={onOpenCursiveGuide}
                onPreviewPhoto={(imagePath, title, targetText) =>
                  setPhotoPreview({ imagePath, title, targetText })
                }
                hasUnreadComments={
                  activity.attempts.some((a) => unread.data?.has(a.id)) ||
                  (activity.submission?.submissionId
                    ? Boolean(unread.data?.has(activity.submission.submissionId))
                    : false)
                }
              />
            ))}
          </div>
        </section>
      )}

      {/* Dedicated Section: Past Worksheets */}
      {pastSheets.length > 0 && (
        <section aria-labelledby="past-worksheets-heading" className="space-y-3 pt-4 border-t border-border/60">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-baseline gap-2">
              <h3 id="past-worksheets-heading" className="font-heading text-sm sm:text-base font-semibold text-foreground">
                Past worksheets
              </h3>
              <span className="text-xs text-muted-foreground font-sans tabular-nums">
                ({pastSheets.length})
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowPastSheets((prev) => !prev)}
              aria-expanded={showPastSheets}
              aria-controls="past-sheets-grid"
              className="h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] text-xs sm:text-sm font-medium text-primary hover:text-primary cursor-pointer gap-1.5"
            >
              {showPastSheets ? (
                <>
                  <span>Hide past worksheets</span>
                  <ChevronUp className="size-3.5" aria-hidden="true" />
                </>
              ) : (
                <>
                  <span>Show past worksheets ({pastSheets.length})</span>
                  <ChevronDown className="size-3.5" aria-hidden="true" />
                </>
              )}
            </Button>
          </div>

          {showPastSheets && (
            <div id="past-sheets-grid" className={gridClassName}>
              {pastSheets.map((activity) => (
                <ActivityCard
                  key={activity.id}
                  work={activity}
                  activityId={activity.id}
                  targetText={activity.targetText}
                  createdAt={activity.createdAt}
                  childId={childId}
                  initialSubmission={activity.submission}
                  onUploadClick={() => onUploadClick(activity.id)}
                  onOpenCursiveGuide={onOpenCursiveGuide}
                  onPreviewPhoto={(imagePath, title, targetText) =>
                    setPhotoPreview({ imagePath, title, targetText })
                  }
                  hasUnreadComments={
                    activity.attempts.some((a) => unread.data?.has(a.id)) ||
                    (activity.submission?.submissionId
                      ? Boolean(unread.data?.has(activity.submission.submissionId))
                      : false)
                  }
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Photo Preview Dialog */}
      {photoPreview && (
        <PhotoPreviewDialog
          open={Boolean(photoPreview)}
          onOpenChange={(open) => {
            if (!open) setPhotoPreview(null);
          }}
          imagePath={photoPreview.imagePath}
          title={photoPreview.title}
          targetText={photoPreview.targetText}
        />
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
  onOpenCursiveGuide,
  onPreviewPhoto,
  hasUnreadComments,
}: {
  work: TakeHomeActivity;
  activityId: string;
  targetText: string;
  createdAt: string;
  childId: string | null;
  initialSubmission?: TakeHomeActivitySubmission | null;
  onUploadClick: () => void;
  onOpenCursiveGuide?: (initialLetter?: string) => void;
  onPreviewPhoto: (imagePath: string, title: string, targetText: string) => void;
  hasUnreadComments?: boolean;
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
    } catch {
      toast.error("We couldn't remove the photo. Please check your connection and try again.");
    }
  };

  const formattedDate = new Date(createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  const now = useActivityNow();
  const {
    closed,
    processing: isProcessing,
    rejected: isRejected,
    latestRejected,
    returned: isReturned,
    category,
    excused,
    urgency,
  } = getParentActivityStatus({ ...work, submission }, now);

  const isCompleted = submission?.status === "completed";
  const firstLetter = targetText.trim().match(/[a-zA-Z]/)?.[0]?.toUpperCase() ?? "A";

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 shadow-warm-sm flex flex-col justify-between gap-3.5 transition-colors",
        isRejected || latestRejected
          ? "border-warning/50 dark:border-warning/60 bg-warning/5 dark:bg-warning/10"
          : isReturned
            ? "border-primary/40 bg-primary/5 dark:bg-primary/10"
            : "border-border"
      )}
    >
      <div className="space-y-3">
        {/* Status Eyebrow & Urgency Badges */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground font-medium font-sans tabular-nums">
            {excused ? (
              "Excused · Optional practice"
            ) : category === "closed" ? (
              "Closed · Deadline passed"
            ) : urgency === "overdue" ? (
              <span className="text-band-1 font-semibold">
                Past due {work.dueAt ? `· Due ${formatActivityDueAt(work.dueAt)}` : ""}
              </span>
            ) : urgency === "due_soon" ? (
              <span className="text-band-2 font-semibold">
                Due soon {work.dueAt ? `· Due ${formatActivityDueAt(work.dueAt)}` : ""}
              </span>
            ) : work.dueAt ? (
              `Due ${formatActivityDueAt(work.dueAt)}`
            ) : (
              `Assigned ${formattedDate}`
            )}
          </span>
          {isReturned && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
              <AlertTriangle className="size-3.5" aria-hidden="true" />
              <span>Redo requested</span>
            </span>
          )}
          {(isRejected || latestRejected) && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-warning-foreground">
              <AlertTriangle className="size-3.5" aria-hidden="true" />
              <span>Photo needed</span>
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="text-base font-semibold leading-snug text-foreground" title={work.title}>
          {work.title}
        </h3>

        {/* Cursive Practice Desk: 3-line Guidelines Specimen */}
        <div className="space-y-2">
          <div className="rounded-xl border border-border/70 bg-card overflow-hidden shadow-2xs">
            <div className="cursive-guidelines px-4 py-3 overflow-x-auto flex items-center min-h-[58px] bg-background/50">
              <span className="font-cursive text-2xl sm:text-3xl text-foreground whitespace-nowrap tracking-wide select-none">
                {targetText}
              </span>
            </div>
            <div className="px-3 py-1.5 bg-muted/40 border-t border-border/50 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="truncate italic font-sans max-w-full">&ldquo;{targetText}&rdquo;</span>
              {onOpenCursiveGuide && (
                <button
                  type="button"
                  onClick={() => onOpenCursiveGuide(firstLetter)}
                  className="inline-flex items-center gap-1 font-medium text-primary hover:text-primary-hover hover:underline cursor-pointer shrink-0 min-h-6 touch-manipulation"
                  aria-label={`Inspect cursive letters for "${work.title}"`}
                >
                  <PenTool className="size-3" aria-hidden="true" />
                  <span>Inspect letters</span>
                </button>
              )}
            </div>
          </div>

          {/* Paper and script prerequisite cue */}
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-sans">
            <span className="size-1.5 rounded-full bg-primary/70 shrink-0" aria-hidden="true" />
            <span>Write in connected cursive on standard 3-line paper</span>
          </p>

          {work.instructions && (
            <p className="whitespace-pre-wrap text-xs text-muted-foreground leading-relaxed pt-0.5">
              {work.instructions}
            </p>
          )}
        </div>

        {/* Status Notices */}
        {work.latestSubmission?.submissionId !== submission?.submissionId &&
          work.latestSubmission?.status === "rejected" && (
            <div role="status" className="rounded-lg bg-warning/15 border border-warning/30 p-2.5 text-xs text-foreground space-y-0.5">
              <p className="font-semibold text-warning-foreground">
                Latest photo needs a clearer shot: {getRejectionSummary(work.latestSubmission.rejectionCode).label}.
              </p>
              <p className="text-muted-foreground">
                Your earlier completed worksheet is still safely recorded.
              </p>
            </div>
          )}

        {work.latestSubmission?.submissionId !== submission?.submissionId &&
          work.latestSubmission?.status === "processing" && (
            <p role="status" className="text-xs text-muted-foreground">
              Checking your new photo now. Your earlier result stays saved until it finishes.
            </p>
          )}

        {excused && (
          <p className="text-xs text-muted-foreground">
            This worksheet is excused from coursework totals. Your child can still practice.
          </p>
        )}

        {isReturned && !excused && (
          <div className="space-y-1 rounded-lg bg-primary/10 border border-primary/20 p-2.5 text-xs">
            <p className="font-semibold text-foreground">Teacher requested a new photo</p>
            {work.workState?.return_reason && (
              <p className="text-muted-foreground">
                Note: {humanizeReason(work.workState.return_reason)}
              </p>
            )}
            {work.workState?.return_note && (
              <p className="text-foreground">{work.workState.return_note}</p>
            )}
          </div>
        )}

        {closed && !excused && category === "closed" && (
          <p role="status" className="text-xs text-muted-foreground">
            The deadline has passed. Ask your teacher if you need to send a late photo.
          </p>
        )}
      </div>

      {/* Action Footer */}
      <div className="pt-3 border-t border-border/50 flex flex-wrap items-center justify-between gap-2.5">
        {/* Left Side: Status indicator */}
        <div className="flex items-center gap-2 min-w-0">
          {isLoading ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              <span>Checking status...</span>
            </div>
          ) : isProcessing ? (
            <div role="status" aria-live="polite" className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              <span>Checking handwriting…</span>
            </div>
          ) : isCompleted ? (
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="inline-flex items-center gap-1 text-xs sm:text-sm font-medium text-brand-700 dark:text-brand-300">
                <CheckCircle2 className="size-4 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                <span>{work.workState?.work_status === "Released" ? "Scored" : "Turned in"}</span>
              </span>
              {submission?.compositeScore != null && (
                <BandBadge score={submission.compositeScore} size="sm" />
              )}
            </div>
          ) : null}
        </div>

        {/* Right Side: Primary and Secondary Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap ml-auto">
          {/* Comments Button */}
          {childId && (work.attempts.length || submission?.submissionId) ? (
            <WorkCommentsButton
              scope={{ activityId, studentId: childId }}
              activeSubmissionId={work.workState?.active_submission_id ?? null}
              activityTitle={work.title}
              hasUnread={hasUnreadComments}
            />
          ) : null}

          {/* Card-specific action controls */}
          {isRejected ? (
            <Button
              variant="default"
              size="sm"
              className="h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] gap-1.5 font-semibold cursor-pointer text-xs sm:text-sm px-4"
              onClick={onUploadClick}
              disabled={closed}
              aria-label={`Send new photo for ${work.title}`}
            >
              <Camera className="size-4" aria-hidden="true" />
              <span>Send new photo</span>
            </Button>
          ) : isReturned ? (
            <Button
              variant="default"
              size="sm"
              className="h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] text-xs sm:text-sm font-semibold gap-1.5 cursor-pointer px-4"
              onClick={onUploadClick}
              disabled={closed}
              aria-label={`Send new photo for ${work.title}`}
            >
              <Upload className="size-4" aria-hidden="true" />
              <span>Send new photo</span>
            </Button>
          ) : isCompleted ? (
            <>
              {submission?.imagePath && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onPreviewPhoto(submission.imagePath!, work.title, targetText)}
                  className="h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] text-xs sm:text-sm font-medium gap-1.5 cursor-pointer border-border/80 hover:bg-muted/50 px-3"
                  aria-label={`View uploaded photo for ${work.title}`}
                >
                  <Eye className="size-3.5 shrink-0" aria-hidden="true" />
                  <span>View photo</span>
                </Button>
              )}

              {submission?.canDelete && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsDeleteDialogOpen(true)}
                  disabled={deleteMutation.isPending}
                  className="h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] text-xs font-medium text-destructive hover:bg-destructive/10 hover:text-destructive gap-1 px-2.5 rounded-lg border border-destructive/20 cursor-pointer"
                  aria-label={`Delete uploaded photo for ${work.title}`}
                >
                  <Trash2 className="size-3.5 shrink-0" aria-hidden="true" />
                  <span>Delete</span>
                </Button>
              )}

              {!closed && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] text-xs sm:text-sm font-medium gap-1.5 cursor-pointer shrink-0 border-border/80 hover:bg-muted/50 px-3"
                  onClick={onUploadClick}
                  disabled={isProcessing}
                  aria-label={`Send new photo for ${work.title}`}
                >
                  <Upload className="size-3.5 shrink-0" aria-hidden="true" />
                  <span>Send new photo</span>
                </Button>
              )}
            </>
          ) : category === "closed" ? null : (
            <Button
              variant="default"
              size="sm"
              className="h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] gap-1.5 font-semibold cursor-pointer text-xs sm:text-sm px-4"
              onClick={onUploadClick}
              disabled={closed}
              aria-label={`Send photo for ${work.title}`}
            >
              <Upload className="size-4" aria-hidden="true" />
              <span>Send photo</span>
            </Button>
          )}
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this photo?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes your uploaded photo and comments for &ldquo;{work.title}&rdquo;. You can take and send a new photo anytime.
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

function PhotoPreviewDialog({
  open,
  onOpenChange,
  imagePath,
  title,
  targetText,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imagePath: string;
  title: string;
  targetText: string;
}) {
  const { data: imageUrl, isLoading, isError } = useSubmissionImageUrl(imagePath);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90dvh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="p-4 sm:p-5 border-b border-border/70 pr-12">
          <DialogTitle className="text-base sm:text-lg font-semibold text-foreground truncate">
            {title}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground truncate italic">
            &ldquo;{targetText}&rdquo;
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto p-4 sm:p-6 flex items-center justify-center bg-muted/20 min-h-[300px]">
          {isLoading ? (
            <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
              <span>Loading uploaded worksheet...</span>
            </div>
          ) : isError || !imageUrl ? (
            <div className="text-center p-6 space-y-2">
              <p className="text-sm font-medium text-foreground">Could not load worksheet photo</p>
              <p className="text-xs text-muted-foreground">Please check your connection and try again.</p>
            </div>
          ) : (
            <div className="relative rounded-lg overflow-hidden border border-border shadow-warm max-h-[65dvh]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={`Uploaded handwriting worksheet for ${title}`}
                className="w-full h-auto object-contain max-h-[65dvh]"
              />
            </div>
          )}
        </div>

        <div className="p-3 sm:p-4 border-t border-border flex justify-end bg-background">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] px-4 text-xs sm:text-sm font-medium cursor-pointer"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
