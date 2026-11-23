"use client";

import { humanizeReason } from "@/lib/utils/humanize-reason";
import { useActivityNow } from "@/components/activities/activity-work-status";
import { formatActivityDate, formatActivityDueAt } from "@/lib/utils/activity-deadlines";
import { compareParentActivityUrgency, getParentActivityStatus } from "@/lib/utils/parent-activity-status";
import type { TakeHomeActivity, TakeHomeActivitySubmission } from "@/lib/hooks/use-parent-data";
import { useState, useMemo, useRef, useEffect } from "react";
import { WorkCommentsButton } from "@/components/comments/submission-comment-picker-sheet";
import {
  useTakeHomeActivities,
  useChildSubmissionForActivity,
} from "@/lib/hooks/use-parent-data";
import { useCommentAccountId, useUnreadCommentThreads } from "@/lib/hooks/use-comments";
import { useSubmissionImageUrl } from "@/lib/hooks/use-submissions";
import { BandBadge } from "@/components/shared/band-badge";
import { QueryRecovery } from "@/components/shared/query-recovery";
import { WorksheetPrompt } from "@/components/activities/worksheet-prompt";
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
  RefreshCw,
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
  childName?: string;
  onUploadClick: (activityId: string) => void;
  expanded?: boolean;
  onToggleExpanded?: () => void;
  showExpandButton?: boolean;
  showScoreDetails?: boolean;
  onViewScoredHistory?: () => void;
  gridClassName?: string;
  practiceFocusKey?: CriterionKey | null;
  onOpenCursiveGuide?: (initialLetter?: string) => void;
}

export function TakeHomeActivities({
  childId,
  childName,
  onUploadClick,
  expanded: controlledExpanded,
  onToggleExpanded,
  showExpandButton = true,
  onViewScoredHistory,
  gridClassName = "grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4",
  practiceFocusKey,
  onOpenCursiveGuide,
}: TakeHomeActivitiesProps) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [showPastSheets, setShowPastSheets] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<{
    activityId: string;
    submissionId?: string;
    imagePath: string;
    title: string;
    targetText: string;
    statusLabel?: string;
    canSendNewPhoto: boolean;
    canDelete: boolean;
  } | null>(null);

  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;
  const toggleExpanded = onToggleExpanded || (() => setInternalExpanded((prev) => !prev));
  const isCollapsingRef = useRef(false);
  const toggleContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isCollapsingRef.current && !isExpanded) {
      isCollapsingRef.current = false;
      const prefersReduced =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      toggleContainerRef.current?.scrollIntoView({
        behavior: prefersReduced ? "auto" : "smooth",
        block: "end",
      });
    }
  }, [isExpanded]);

  const handleToggleExpanded = () => {
    if (isExpanded) {
      isCollapsingRef.current = true;
    }
    toggleExpanded();
  };
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
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
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
        <Empty className="border border-border rounded-xl sm:rounded-2xl shadow-warm bg-surface dark:bg-card py-8">
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
    showExpandButton && toDoActivities.length > 3 && !isExpanded
      ? toDoActivities.slice(0, 3)
      : toDoActivities;
  const focusMeta = practiceFocusKey ? PARENT_CRITERIA_METADATA[practiceFocusKey] : null;

  return (
    <div className="space-y-4">
      {recovery}

      {/* Compact Practice Focus Strip */}
      {focusMeta && toDoActivities.length > 0 && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 dark:bg-primary/10 px-4 py-3 text-xs sm:text-sm">
          <p className="text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">Focus · {focusMeta.label}:</span>{" "}
            {focusMeta.homeTip}
          </p>
        </div>
      )}

      {/* Primary To-Do Worksheets Area */}
      {toDoActivities.length === 0 ? (
        <div className="rounded-xl sm:rounded-2xl border border-border bg-surface dark:bg-card p-5 shadow-warm text-center space-y-2.5">
          <div className="size-9 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center mx-auto">
            {closedWithoutPhotoCount > 0 ? (
              <Clock3 className="size-5" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="size-5" aria-hidden="true" />
            )}
          </div>
          <div className="space-y-1">
            <p className="text-sm sm:text-base font-semibold text-foreground">
              {closedWithoutPhotoCount > 0 ? "Past-due worksheets closed" : "All caught up"}
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
              {closedWithoutPhotoCount > 0
                ? `${closedWithoutPhotoCount} ${closedWithoutPhotoCount === 1 ? "worksheet is" : "worksheets are"} closed. Ask your teacher for late submission.`
                : awaitingReviewActivities.length > 0
                  ? "Nothing to send. Submitted worksheets are waiting for review below."
                  : "All assigned practice worksheets have been turned in."}
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
                onPreviewPhoto={(preview) =>
                  setPhotoPreview({ activityId: activity.id, ...preview })
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
            <div ref={toggleContainerRef} className="pt-1 scroll-mb-6">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleToggleExpanded}
                aria-expanded={isExpanded}
                aria-controls="take-home-activities-grid"
                className="h-11 sm:h-9 min-h-11 sm:min-h-9 text-xs sm:text-sm font-medium gap-1.5 cursor-pointer"
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
          <div className="rounded-xl border border-border bg-surface dark:bg-card divide-y divide-border/70">
            {awaitingReviewActivities.map((activity) => (
              <CompactWorksheetRow
                key={activity.id}
                work={activity}
                childId={childId}
                onPreviewPhoto={(preview) =>
                  setPhotoPreview({ activityId: activity.id, ...preview })
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
              aria-controls="past-sheets-list"
              className="h-11 sm:h-9 min-h-11 sm:min-h-9 text-xs sm:text-sm font-medium text-primary hover:text-primary cursor-pointer gap-1.5"
            >
              {showPastSheets ? (
                <>
                  <span>Hide</span>
                  <ChevronUp className="size-3.5" aria-hidden="true" />
                </>
              ) : (
                <>
                  <span>Show</span>
                  <ChevronDown className="size-3.5" aria-hidden="true" />
                </>
              )}
            </Button>
          </div>

          {closedWithoutPhotoCount > 0 && (
            <p
              role="status"
              className="rounded-lg border border-band-1/30 bg-band-1/10 px-3 py-2 text-xs text-band-1-text font-medium"
            >
              {closedWithoutPhotoCount}{" "}
              {closedWithoutPhotoCount === 1
                ? "missed worksheet is closed without a photo."
                : "missed worksheets are closed without a photo."}{" "}
              Ask your teacher for late submission.
            </p>
          )}

          {showPastSheets && (
            <div
              id="past-sheets-list"
              className="rounded-xl border border-border bg-surface dark:bg-card divide-y divide-border/70"
            >
              {pastSheets.map((activity) => (
                <CompactWorksheetRow
                  key={activity.id}
                  work={activity}
                  childId={childId}
                  onViewScoredHistory={onViewScoredHistory}
                  onPreviewPhoto={(preview) =>
                    setPhotoPreview({ activityId: activity.id, ...preview })
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
          childName={childName}
          statusLabel={photoPreview.statusLabel}
          submissionId={photoPreview.submissionId}
          canDelete={photoPreview.canDelete}
          canSendNewPhoto={photoPreview.canSendNewPhoto}
          onSendNewPhoto={() => {
            const targetActivityId = photoPreview.activityId;
            setPhotoPreview(null);
            onUploadClick(targetActivityId);
          }}
        />
      )}
    </div>
  );
}

interface PhotoPreviewTarget {
  submissionId?: string;
  imagePath: string;
  title: string;
  targetText: string;
  statusLabel?: string;
  canSendNewPhoto: boolean;
  canDelete: boolean;
}

function CompactWorksheetRow({
  work,
  childId,
  onViewScoredHistory,
  onPreviewPhoto,
  hasUnreadComments,
}: {
  work: TakeHomeActivity;
  childId: string | null;
  onViewScoredHistory?: () => void;
  onPreviewPhoto: (preview: PhotoPreviewTarget) => void;
  hasUnreadComments?: boolean;
}) {
  const now = useActivityNow();
  const { closed, processing: isProcessing, category, excused } =
    getParentActivityStatus(work, now);
  const submission = work.submission;
  const isCompleted = submission?.status === "completed";
  const isScored =
    isCompleted &&
    work.workState?.work_status === "Released" &&
    submission?.compositeScore != null;
  const activeAttempt = submission?.submissionId
    ? work.attempts.find((attempt) => attempt.id === submission.submissionId)
    : undefined;
  const sentDate = activeAttempt?.created_at
    ? formatActivityDate(activeAttempt.created_at, { includeYear: false })
    : null;
  const assignedDate = formatActivityDate(work.createdAt, { includeYear: false });

  const statusText = excused
    ? "Excused · Optional"
    : category === "closed"
      ? "Closed · No photo sent"
      : isScored
        ? "Scored"
        : "Waiting for teacher review";

  const previewStatusLabel = (() => {
    const base = isScored ? "Scored" : "Waiting for teacher review";
    return sentDate ? `${base} · Sent ${sentDate}` : base;
  })();

  return (
    <div className="px-4 py-3.5 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="font-heading text-sm sm:text-base font-semibold text-foreground break-words">
            {work.title}
          </h4>
          {isScored && submission?.compositeScore != null && (
            <div className="inline-flex items-center gap-1.5">
              <BandBadge
                score={submission.compositeScore}
                band={submission.compositeBand}
                size="sm"
              />
              <span className="font-sans text-xs font-semibold tabular-nums text-foreground">
                {Math.round(submission.compositeScore)}%
              </span>
            </div>
          )}
        </div>

        {work.targetText && (
          <p className="text-xs text-muted-foreground italic line-clamp-1">
            &ldquo;{work.targetText}&rdquo;
          </p>
        )}

        <p className="text-xs text-muted-foreground font-sans tabular-nums flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span
            className={cn(
              category === "closed" && !excused && "text-band-1-text font-medium"
            )}
          >
            {statusText}
          </span>
          <span aria-hidden="true" className="text-muted-foreground/40">·</span>
          <span>
            {sentDate
              ? `Sent ${sentDate}`
              : work.dueAt
                ? `Due ${formatActivityDueAt(work.dueAt)}`
                : `Assigned ${assignedDate}`}
          </span>
          {category === "closed" && !excused && (
            <>
              <span aria-hidden="true" className="text-muted-foreground/40">·</span>
              <span>Ask your teacher for late submission</span>
            </>
          )}
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap sm:shrink-0">
        {childId && (work.attempts.length || submission?.submissionId) ? (
          <WorkCommentsButton
            scope={{ activityId: work.id, studentId: childId }}
            activeSubmissionId={work.workState?.active_submission_id ?? null}
            activityTitle={work.title}
            hasUnread={hasUnreadComments}
          />
        ) : null}

        {submission?.imagePath && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onPreviewPhoto({
                submissionId: submission.submissionId,
                imagePath: submission.imagePath!,
                title: work.title,
                targetText: work.targetText,
                statusLabel: previewStatusLabel,
                canSendNewPhoto: !closed && !isProcessing,
                canDelete: Boolean(submission.canDelete),
              })
            }
            className="h-11 sm:h-9 min-h-11 sm:min-h-9 text-xs sm:text-sm font-medium gap-1.5 cursor-pointer border-border/80 hover:bg-muted/50 px-3"
            aria-label={`View uploaded photo for ${work.title}`}
          >
            <Eye className="size-3.5 shrink-0" aria-hidden="true" />
            <span>View photo</span>
          </Button>
        )}

        {isScored && onViewScoredHistory && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onViewScoredHistory}
            className="h-11 sm:h-9 min-h-11 sm:min-h-9 text-xs sm:text-sm font-medium cursor-pointer px-3"
          >
            View feedback
          </Button>
        )}
      </div>
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
  onPreviewPhoto: (preview: PhotoPreviewTarget) => void;
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

  const formattedDate = formatActivityDate(createdAt, { includeYear: false });

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
  const rejectedSubmission =
    work.latestSubmission?.status === "rejected"
      ? work.latestSubmission
      : submission?.status === "rejected"
        ? submission
        : null;
  const rejectionSummary = rejectedSubmission
    ? getRejectionSummary(rejectedSubmission.rejectionCode)
    : null;
  const hasKeptCompletedPhoto =
    isCompleted &&
    Boolean(rejectedSubmission) &&
    rejectedSubmission?.submissionId !== submission?.submissionId;
  const firstLetter = targetText.trim().match(/[a-zA-Z]/)?.[0]?.toUpperCase() ?? "A";
  const activeAttempt = submission?.submissionId
    ? work.attempts.find((attempt) => attempt.id === submission.submissionId)
    : undefined;
  const previewStatusLabel = (() => {
    const base = hasKeptCompletedPhoto
      ? "Previous photo kept"
      : work.workState?.work_status === "Released"
        ? "Scored"
        : "Waiting for teacher review";
    if (!activeAttempt?.created_at) return base;
    return `${base} · Sent ${formatActivityDate(activeAttempt.created_at, { includeYear: false })}`;
  })();
  const openPreview = () => {
    if (!submission?.imagePath) return;
    onPreviewPhoto({
      submissionId: submission.submissionId,
      imagePath: submission.imagePath,
      title: work.title,
      targetText,
      statusLabel: previewStatusLabel,
      canSendNewPhoto: !closed && !isProcessing,
      canDelete: Boolean(submission.canDelete),
    });
  };
  const wordCount = useMemo(() => {
    const trimmed = targetText.trim();
    return trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
  }, [targetText]);

  return (
    <div
      className={cn(
        "group relative flex flex-col justify-between gap-4 border rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-warm hover:shadow-md transition-all duration-200",
        isRejected || latestRejected
          ? "border-warning/50 dark:border-warning/60 bg-warning/5 dark:bg-warning/10 hover:border-warning/80"
          : isReturned
            ? "border-primary/40 bg-primary/5 dark:bg-primary/10 hover:border-primary/60"
            : "bg-surface dark:bg-card border-border hover:border-brand-300 dark:hover:border-brand-800"
      )}
    >
      <div>
        {/* Attention status indicator when action is requested */}
        {(isReturned || isRejected || latestRejected) && (
          <div className="flex items-center justify-between gap-2 flex-wrap mb-2.5">
            {isReturned && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                <AlertTriangle className="size-3.5" aria-hidden="true" />
                <span>New photo requested</span>
              </span>
            )}
            {(isRejected || latestRejected) && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-warning-foreground">
                <AlertTriangle className="size-3.5" aria-hidden="true" />
                <span>Clearer photo needed</span>
              </span>
            )}
          </div>
        )}

        {/* Title */}
        <h3 className="mb-1 font-heading text-base font-semibold leading-snug text-foreground" title={work.title}>
          {work.title}
        </h3>

        {/* Metadata line: Due date + word count */}
        <p className="mb-3 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground font-sans tabular-nums">
          <span>
            {excused ? (
              "Excused · Optional"
            ) : category === "closed" ? (
              "Closed"
            ) : urgency === "overdue" ? (
              <span className="text-band-1-text font-semibold">
                Past due{work.dueAt ? ` · ${formatActivityDueAt(work.dueAt)}` : ""}
              </span>
            ) : urgency === "due_soon" ? (
              <span className="text-band-2-text font-semibold">
                Due soon{work.dueAt ? ` · ${formatActivityDueAt(work.dueAt)}` : ""}
              </span>
            ) : work.dueAt ? (
              `Due ${formatActivityDueAt(work.dueAt)}`
            ) : (
              `Assigned ${formattedDate}`
            )}
          </span>
          {wordCount > 0 && (
            <>
              <span aria-hidden="true" className="text-muted-foreground/40">·</span>
              <span>
                {wordCount} {wordCount === 1 ? "word" : "words"}
              </span>
            </>
          )}
        </p>

        {/* Cursive Practice Desk: 3-line Guidelines Specimen */}
        <WorksheetPrompt
          text={targetText}
          footer={
            !isCompleted && category !== "closed" && onOpenCursiveGuide ? (
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                {work.title.trim().toLowerCase() !== targetText.trim().toLowerCase() ? (
                  <span aria-hidden="true" className="truncate font-sans">{targetText}</span>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={() => onOpenCursiveGuide(firstLetter)}
                  className="inline-flex items-center gap-1 font-medium text-primary hover:text-brand-700 dark:hover:text-brand-300 hover:underline cursor-pointer shrink-0 min-h-11 sm:min-h-9 px-2 -mr-2 rounded-md touch-manipulation focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                  aria-label={`Inspect cursive letters for "${work.title}"`}
                >
                  <PenTool className="size-3" aria-hidden="true" />
                  <span>Letters</span>
                </button>
              </div>
            ) : undefined
          }
        />

        {work.instructions && (
          <p className="mt-2.5 whitespace-pre-wrap text-xs text-muted-foreground leading-relaxed">
            {work.instructions}
          </p>
        )}

        {/* Status Notices */}
        {rejectionSummary && !isProcessing && (
          <div
            role="status"
            className="mt-3 rounded-lg bg-warning/15 border border-warning/30 px-2.5 py-2 text-xs text-warning-foreground space-y-0.5"
          >
            <p className="font-semibold">
              {hasKeptCompletedPhoto
                ? `Latest photo not accepted: ${rejectionSummary.label}`
                : rejectionSummary.label}
            </p>
            <p className="text-foreground/85 leading-relaxed">
              {rejectionSummary.detail.endsWith(".")
                ? rejectionSummary.detail
                : `${rejectionSummary.detail}.`}
              {hasKeptCompletedPhoto ? " Your earlier photo is still on file." : ""}
            </p>
          </div>
        )}

        {work.latestSubmission?.submissionId !== submission?.submissionId &&
          work.latestSubmission?.status === "processing" && (
            <p role="status" className="mt-3 text-xs text-muted-foreground">
              Checking your new photo…
            </p>
          )}

        {isReturned && !excused && (work.workState?.return_reason || work.workState?.return_note) && (
          <div className="mt-3 space-y-0.5 rounded-lg bg-primary/10 border border-primary/20 px-2.5 py-2 text-xs">
            {work.workState?.return_reason && (
              <p className="font-medium text-foreground">
                {humanizeReason(work.workState.return_reason)}
              </p>
            )}
            {work.workState?.return_note && (
              <p className="text-muted-foreground">{work.workState.return_note}</p>
            )}
          </div>
        )}

        {closed && !excused && category === "closed" && (
          <p role="status" className="mt-3 text-xs text-muted-foreground">
            Deadline passed. Ask your teacher for late submission.
          </p>
        )}
      </div>

      {/* Action Footer */}
      <div className="pt-3 border-t border-border/60 flex flex-wrap items-center justify-between gap-3">
        {/* Left Side: Status indicator */}
        <div className="flex items-center gap-2 min-w-0">
          {isLoading ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              <span>Checking status...</span>
            </div>
          ) : isProcessing ? (
            <div role="status" aria-live="polite" className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden="true" />
              <span>Checking handwriting…</span>
            </div>
          ) : hasKeptCompletedPhoto ? (
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-muted-foreground">
                <Clock3 className="size-3.5 shrink-0" aria-hidden="true" />
                <span>
                  {work.workState?.work_status === "Released"
                    ? "Scored photo kept"
                    : "Previous photo kept"}
                </span>
              </span>
              {submission?.compositeScore != null && (
                <BandBadge
                  score={submission.compositeScore}
                  band={submission.compositeBand}
                  size="sm"
                />
              )}
            </div>
          ) : isCompleted ? (
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="inline-flex items-center gap-1 text-xs sm:text-sm font-medium text-brand-700 dark:text-brand-300">
                <CheckCircle2 className="size-4 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                <span>{work.workState?.work_status === "Released" ? "Scored" : "Turned in"}</span>
              </span>
              {submission?.compositeScore != null && (
                <BandBadge
                  score={submission.compositeScore}
                  band={submission.compositeBand}
                  size="sm"
                />
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
          {isRejected || isReturned ? (
            <>
              {hasKeptCompletedPhoto && submission?.imagePath && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={openPreview}
                  className="h-11 sm:h-9 min-h-11 sm:min-h-9 text-xs sm:text-sm font-medium gap-1.5 cursor-pointer border-border/80 hover:bg-muted/50 px-3"
                  aria-label={`View kept photo for ${work.title}`}
                >
                  <Eye className="size-3.5 shrink-0" aria-hidden="true" />
                  <span>View photo</span>
                </Button>
              )}
              <Button
                variant="default"
                size="sm"
                className="h-11 sm:h-9 min-h-11 sm:min-h-9 gap-1.5 font-semibold cursor-pointer text-xs sm:text-sm px-4"
                onClick={onUploadClick}
                disabled={closed}
                aria-label={`Send new photo for ${work.title}`}
              >
                <Camera className="size-4" aria-hidden="true" />
                <span>Send new photo</span>
              </Button>
            </>
          ) : isCompleted ? (
            submission?.imagePath ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={openPreview}
                className="h-11 sm:h-9 min-h-11 sm:min-h-9 text-xs sm:text-sm font-medium gap-1.5 cursor-pointer border-border/80 hover:bg-muted/50 px-3"
                aria-label={`View uploaded photo for ${work.title}`}
              >
                <Eye className="size-3.5 shrink-0" aria-hidden="true" />
                <span>View photo</span>
              </Button>
            ) : !closed ? (
              <Button
                variant="outline"
                size="sm"
                className="h-11 sm:h-9 min-h-11 sm:min-h-9 text-xs sm:text-sm font-medium gap-1.5 cursor-pointer shrink-0 border-border/80 hover:bg-muted/50 px-3"
                onClick={onUploadClick}
                disabled={isProcessing}
                aria-label={`Send new photo for ${work.title}`}
              >
                <Camera className="size-3.5 shrink-0" aria-hidden="true" />
                <span>Send new photo</span>
              </Button>
            ) : null
          ) : category === "closed" ? null : (
            <Button
              variant="default"
              size="sm"
              className="h-11 sm:h-9 min-h-11 sm:min-h-9 gap-1.5 font-semibold cursor-pointer text-xs sm:text-sm px-4"
              onClick={onUploadClick}
              disabled={closed}
              aria-label={`Send photo for ${work.title}`}
            >
              <Camera className="size-4" aria-hidden="true" />
              <span>Send photo</span>
            </Button>
          )}
        </div>
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
  childName,
  statusLabel,
  submissionId,
  canDelete,
  canSendNewPhoto,
  onSendNewPhoto,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imagePath: string;
  title: string;
  targetText: string;
  childName?: string;
  statusLabel?: string;
  submissionId?: string;
  canDelete?: boolean;
  canSendNewPhoto?: boolean;
  onSendNewPhoto?: () => void;
}) {
  const { data: imageUrl, isLoading, isError, isFetching, refetch } = useSubmissionImageUrl(imagePath);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const deleteMutation = useDeleteSubmission();
  const hasLoadError = isError || !imageUrl || failedUrl === imageUrl;

  const handleRetry = () => {
    setFailedUrl(null);
    void refetch();
  };

  const handleDelete = async () => {
    if (!submissionId) return;
    try {
      await deleteMutation.mutateAsync(submissionId);
      toast.success("Upload deleted. You can send a new photo anytime.");
      setIsDeleteDialogOpen(false);
      onOpenChange(false);
    } catch {
      toast.error("We couldn't delete the upload. Please check your connection and try again.");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90dvh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="p-4 sm:p-5 border-b border-border/70 pr-12 space-y-1">
            <DialogTitle className="text-base sm:text-lg font-semibold text-foreground break-words">
              {title}
            </DialogTitle>
            {(childName || statusLabel) && (
              <p className="text-xs font-medium text-muted-foreground">
                {[childName, statusLabel].filter(Boolean).join(" · ")}
              </p>
            )}
            <DialogDescription className="text-xs text-muted-foreground italic break-words line-clamp-2">
              &ldquo;{targetText}&rdquo;
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto p-4 sm:p-6 flex items-center justify-center bg-muted/20 min-h-[300px]">
            {isLoading ? (
              <div role="status" aria-live="polite" className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
                <span>Loading uploaded worksheet...</span>
              </div>
            ) : hasLoadError ? (
              <div role="alert" className="text-center p-6 space-y-3 max-w-sm">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Could not load worksheet photo</p>
                  <p className="text-xs text-muted-foreground">Please check your connection and try again.</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRetry}
                  disabled={isFetching}
                  className="h-11 sm:h-9 min-h-11 sm:min-h-9 gap-1.5 text-xs sm:text-sm font-medium cursor-pointer"
                >
                  <RefreshCw className={cn("size-3.5", isFetching && "animate-spin")} aria-hidden="true" />
                  <span>{isFetching ? "Retrying..." : "Try again"}</span>
                </Button>
              </div>
            ) : (
              <div className="relative rounded-lg overflow-hidden border border-border shadow-warm max-h-[65dvh]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt={`Uploaded handwriting worksheet for ${title}`}
                  loading="lazy"
                  onError={() => setFailedUrl(imageUrl)}
                  className="w-full h-auto object-contain max-h-[65dvh]"
                />
              </div>
            )}
          </div>

          <div className="p-3 sm:p-4 border-t border-border flex flex-wrap items-center justify-between gap-2 bg-background">
            <div className="flex items-center gap-2 flex-wrap">
              {canDelete && submissionId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsDeleteDialogOpen(true)}
                  disabled={deleteMutation.isPending}
                  className="h-11 sm:h-9 min-h-11 sm:min-h-9 text-xs sm:text-sm font-medium text-destructive hover:bg-destructive/10 hover:text-destructive gap-1.5 px-3 cursor-pointer"
                >
                  <Trash2 className="size-3.5 shrink-0" aria-hidden="true" />
                  <span>Delete upload</span>
                </Button>
              )}
              {canSendNewPhoto && onSendNewPhoto && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onSendNewPhoto}
                  className="h-11 sm:h-9 min-h-11 sm:min-h-9 text-xs sm:text-sm font-medium gap-1.5 px-3 cursor-pointer"
                >
                  <Camera className="size-3.5 shrink-0" aria-hidden="true" />
                  <span>Send new photo</span>
                </Button>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-11 sm:h-9 min-h-11 sm:min-h-9 px-4 text-xs sm:text-sm font-medium cursor-pointer ml-auto"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this upload?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes your uploaded photo and comments for &ldquo;{title}&rdquo;. This action cannot be undone, and you can send a new photo anytime.
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
                void handleDelete();
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
                "Delete upload"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
