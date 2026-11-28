"use client";

import { humanizeReason } from "@/lib/utils/humanize-reason";
import { useActivityNow } from "@/components/activities/activity-work-status";
import { formatActivityDate, formatActivityDueAt } from "@/lib/utils/activity-deadlines";
import { compareParentActivityUrgency, getParentActivityStatus } from "@/lib/utils/parent-activity-status";
import type { TakeHomeActivity, TakeHomeActivitySubmission } from "@/lib/hooks/use-parent-data";
import { useState, useMemo, useRef, useEffect, useId } from "react";
import { normalizeActivityPrompt } from "@/lib/utils/formatters";
import { WorkCommentsButton } from "@/components/comments/submission-comment-picker-sheet";
import {
  useTakeHomeActivities,
  useChildSubmissionForActivity,
} from "@/lib/hooks/use-parent-data";
import { useCommentAccountId, useUnreadCommentThreads } from "@/lib/hooks/use-comments";
import { useChildGradebook } from "@/lib/hooks/use-gradebook";
import { useSubmissionImageUrl } from "@/lib/hooks/use-submissions";
import { BandBadge } from "@/components/shared/band-badge";
import { QueryRecovery } from "@/components/shared/query-recovery";
import { WorksheetPrompt } from "@/components/activities/worksheet-prompt";
import { WorksheetImageInspector } from "@/components/shared/worksheet-image-inspector";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemTitle,
} from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { TakeHomeActivitiesSkeleton } from "@/components/parent/parent-portal-skeletons";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  ResponsiveRichOverlay,
  ResponsiveRichOverlayBody,
  ResponsiveRichOverlayContent,
  ResponsiveRichOverlayDescription,
  ResponsiveRichOverlayFooter,
  ResponsiveRichOverlayHeader,
  ResponsiveRichOverlayTitle,
} from "@/components/shared/responsive-rich-overlay";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ClipboardList,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Camera,
  MoreHorizontal,
  Trash2,
  Clock3,
  Eye,
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
import { toast } from "@/components/ui/toast";
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
  onViewScoredHistory?: (work: { activityId: string; submissionId: string | null }) => void;
  gridClassName?: string;
  practiceFocusKey?: CriterionKey | null;
}

export function TakeHomeActivities({
  childId,
  childName,
  onUploadClick,
  expanded: controlledExpanded,
  onToggleExpanded,
  showExpandButton = true,
  onViewScoredHistory,
  gridClassName = "grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-4",
  practiceFocusKey,
}: TakeHomeActivitiesProps) {
  const awaitingReviewHeadingId = useId();
  const completedPracticeHeadingId = useId();
  const gridId = useId();
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [pastSheetsToggled, setPastSheetsToggled] = useState<boolean | null>(null);
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
  const gradebook = useChildGradebook(userId ?? "", childId, Boolean(userId && childId));

  const teacherNameMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!gradebook.data?.groups) return map;
    for (const group of gradebook.data.groups) {
      const raw = group.teacher_name?.trim();
      if (!raw) continue;
      const formatted = raw.toLowerCase().startsWith("teacher")
        ? raw
        : `Teacher ${raw.split(/\s+/)[0]}`;
      for (const act of group.activities) {
        map.set(act.id, formatted);
      }
    }
    return map;
  }, [gradebook.data]);

  const fallbackTeacherName = useMemo(() => {
    const raw = gradebook.data?.groups[0]?.teacher_name?.trim();
    if (!raw) return undefined;
    return raw.toLowerCase().startsWith("teacher") ? raw : `Teacher ${raw.split(/\s+/)[0]}`;
  }, [gradebook.data]);

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
    return <TakeHomeActivitiesSkeleton gridClassName={gridClassName} />;
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
        <Empty className="border border-border rounded-xl sm:rounded-2xl shadow-warm bg-card py-8">
          <EmptyMedia variant="icon" className="bg-secondary text-secondary-foreground">
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
  const isPastSheetsOpen =
    pastSheetsToggled ?? (toDoActivities.length === 0 && awaitingReviewActivities.length === 0);
  const focusMeta = practiceFocusKey ? PARENT_CRITERIA_METADATA[practiceFocusKey] : null;

  return (
    <div className="flex flex-col gap-4">
      {recovery}

      {/* Compact Practice Focus Strip */}
      {focusMeta && toDoActivities.length > 0 && (
        <Alert
          role="note"
          className="border-primary/20 bg-primary/5 px-4 py-3 text-xs sm:text-sm"
        >
          <AlertDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">Focus · {focusMeta.label}:</span>{" "}
            {focusMeta.homeTip}
          </AlertDescription>
        </Alert>
      )}

      {/* Primary To-Do Worksheets Area */}
      {toDoActivities.length === 0 ? (
        <Empty className="border border-border rounded-xl sm:rounded-2xl shadow-warm bg-card p-5 gap-2.5">
          <EmptyMedia variant="icon" className="mb-0 size-9 rounded-full bg-secondary text-secondary-foreground">
            {closedWithoutPhotoCount > 0 ? (
              <Clock3 aria-hidden="true" />
            ) : (
              <CheckCircle2 aria-hidden="true" />
            )}
          </EmptyMedia>
          <EmptyHeader className="gap-1">
            <EmptyTitle className="text-sm sm:text-base font-semibold">
              {closedWithoutPhotoCount > 0 ? "Past-due worksheets closed" : "All caught up"}
            </EmptyTitle>
            <EmptyDescription className="text-sm leading-relaxed">
              {closedWithoutPhotoCount > 0
                ? `${closedWithoutPhotoCount} ${closedWithoutPhotoCount === 1 ? "worksheet is" : "worksheets are"} closed. Contact your teacher directly to ask about late submission.`
                : awaitingReviewActivities.length > 0
                  ? "Nothing to send. Submitted worksheets are waiting for review below."
                  : "All assigned practice worksheets have been turned in."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div id={gridId} className={gridClassName}>
            {visibleToDo.map((activity) => (
              <ActivityCard
                key={activity.id}
                work={activity}
                teacherName={teacherNameMap.get(activity.id) ?? fallbackTeacherName}
                activityId={activity.id}
                targetText={activity.targetText}
                createdAt={activity.createdAt}
                childId={childId}
                now={now}
                initialSubmission={activity.submission}
                onUploadClick={() => onUploadClick(activity.id)}
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
                aria-controls={gridId}
                className="h-11 sm:h-9 min-h-11 sm:min-h-9 text-xs sm:text-sm font-medium cursor-pointer"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp data-icon="inline-start" aria-hidden="true" />
                    <span>Show fewer</span>
                  </>
                ) : (
                  <>
                    <ChevronDown data-icon="inline-start" aria-hidden="true" />
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
        <section aria-labelledby={awaitingReviewHeadingId} className="flex flex-col gap-3">
          <Separator className="bg-border/60" />
          <div className="flex items-baseline gap-2 pt-1">
            <h3 id={awaitingReviewHeadingId} className="font-heading text-sm sm:text-base font-semibold text-foreground">
              Waiting for teacher review
            </h3>
            <span className="text-xs text-muted-foreground font-sans tabular-nums">
              ({awaitingReviewActivities.length})
            </span>
          </div>
          <Card className="p-0 gap-0 shadow-none">
            <CardContent className="p-0 divide-y divide-border/70">
              {awaitingReviewActivities.map((activity) => (
                <CompactWorksheetRow
                  key={activity.id}
                  work={activity}
                  teacherName={teacherNameMap.get(activity.id) ?? fallbackTeacherName}
                  childId={childId}
                  now={now}
                  onReplacePhoto={() => onUploadClick(activity.id)}
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
            </CardContent>
          </Card>
        </section>
      )}

      {/* Dedicated Section: Completed & Closed Practice */}
      {pastSheets.length > 0 && (
        <Collapsible
          open={isPastSheetsOpen}
          onOpenChange={setPastSheetsToggled}
          render={
            <section
              aria-labelledby={completedPracticeHeadingId}
              className="flex flex-col gap-3"
            />
          }
        >
          <Separator className="bg-border/60" />
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-baseline gap-2">
              <h3 id={completedPracticeHeadingId} className="font-heading text-sm sm:text-base font-semibold text-foreground">
                Completed &amp; closed practice
              </h3>
              <span className="text-xs text-muted-foreground font-sans tabular-nums">
                ({pastSheets.length})
              </span>
            </div>
            <CollapsibleTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-11 sm:h-9 min-h-11 sm:min-h-9 text-xs sm:text-sm font-medium text-primary hover:text-primary cursor-pointer"
                />
              }
            >
              {isPastSheetsOpen ? (
                <>
                  <span>Hide</span>
                  <ChevronUp data-icon="inline-end" aria-hidden="true" />
                </>
              ) : (
                <>
                  <span>Show</span>
                  <ChevronDown data-icon="inline-end" aria-hidden="true" />
                </>
              )}
            </CollapsibleTrigger>
          </div>

          {closedWithoutPhotoCount > 0 && (
            <Alert
              role="note"
              className="rounded-lg border-band-1/30 bg-band-1/10 px-3 py-2"
            >
              <AlertDescription className="text-xs text-band-1-text font-medium">
                {closedWithoutPhotoCount}{" "}
                {closedWithoutPhotoCount === 1
                  ? "missed worksheet is closed without a photo."
                  : "missed worksheets are closed without a photo."}{" "}
                Contact your teacher directly to ask about late submission.
              </AlertDescription>
            </Alert>
          )}

          <CollapsibleContent>
            <Card className="p-0 gap-0 shadow-none">
              <CardContent className="p-0 divide-y divide-border/70">
                {pastSheets.map((activity) => (
                  <CompactWorksheetRow
                    key={activity.id}
                    work={activity}
                    teacherName={teacherNameMap.get(activity.id) ?? fallbackTeacherName}
                    childId={childId}
                    now={now}
                    onViewScoredHistory={onViewScoredHistory}
                    onReplacePhoto={() => onUploadClick(activity.id)}
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
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Photo Preview Dialog */}
      {photoPreview && (
        <PhotoPreviewDialog
          open={Boolean(photoPreview)}
          onOpenChange={(open) => {
            if (!open) setPhotoPreview(null);
          }}
          activityId={photoPreview.activityId}
          teacherName={(photoPreview.activityId && teacherNameMap.get(photoPreview.activityId)) ?? fallbackTeacherName}
          childId={childId}
          hasUnreadComments={Boolean(
            photoPreview.submissionId && unread.data?.has(photoPreview.submissionId)
          )}
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
  teacherName,
  childId,
  now,
  onViewScoredHistory,
  onReplacePhoto,
  onPreviewPhoto,
  hasUnreadComments,
}: {
  work: TakeHomeActivity;
  teacherName?: string;
  childId: string | null;
  now: number;
  onViewScoredHistory?: (work: { activityId: string; submissionId: string | null }) => void;
  onReplacePhoto?: () => void;
  onPreviewPhoto: (preview: PhotoPreviewTarget) => void;
  hasUnreadComments?: boolean;
}) {
  const {
    closed,
    processing: isProcessing,
    rejected: isRejected,
    returned: isReturned,
    category,
    excused,
  } = getParentActivityStatus(work, now);
  const submission = work.submission;
  const isCompleted = submission?.status === "completed";
  const isScored =
    isCompleted &&
    work.workState?.work_status === "Released" &&
    submission?.compositeScore != null;
  const hasRejectedLatestRetake =
    isCompleted &&
    work.latestSubmission?.status === "rejected" &&
    work.latestSubmission.submissionId !== submission?.submissionId &&
    !isProcessing;
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
    <Item className="rounded-none border-0 px-4 py-3.5 sm:px-5 flex-col sm:flex-row sm:items-center justify-between gap-3">
      <ItemContent className="min-w-0 w-full sm:w-auto flex-1 gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <ItemTitle className="line-clamp-none">
            <h4 className="font-heading text-sm sm:text-base font-semibold text-foreground break-words">
              {work.title}
            </h4>
          </ItemTitle>
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
            &ldquo;{normalizeActivityPrompt(work.targetText)}&rdquo;
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
        </p>

        {hasRejectedLatestRetake && (
          <p className="text-xs text-warning-foreground font-medium">
            Latest retake wasn&apos;t clear enough — your earlier photo is kept on file.
          </p>
        )}
      </ItemContent>

      <ItemActions className="flex-wrap sm:flex-nowrap gap-1.5 sm:gap-2 w-full sm:w-auto sm:shrink-0">
        {childId && (work.attempts.length || submission?.submissionId) ? (
          <WorkCommentsButton
            scope={{ activityId: work.id, studentId: childId }}
            activeSubmissionId={work.workState?.active_submission_id ?? null}
            activityTitle={work.title}
            teacherName={teacherName}
            audience="parent"
            hasUnread={hasUnreadComments}
            worksheetContext={{
              targetText: work.targetText,
              canSendNewPhoto: (isRejected || isReturned) && !closed && !isProcessing,
              onViewWorksheet:
                isScored && onViewScoredHistory
                  ? () =>
                      onViewScoredHistory({
                        activityId: work.id,
                        submissionId: submission?.submissionId ?? null,
                      })
                  : submission?.imagePath
                    ? () =>
                        onPreviewPhoto({
                          submissionId: submission.submissionId,
                          imagePath: submission.imagePath!,
                          title: work.title,
                          targetText: work.targetText,
                          statusLabel: previewStatusLabel,
                          canSendNewPhoto: !closed && !isProcessing,
                          canDelete: Boolean(submission.canDelete),
                        })
                    : undefined,
              onSendNewPhoto: !closed && !isProcessing && onReplacePhoto ? onReplacePhoto : undefined,
            }}
            className="flex-1 sm:flex-initial min-w-0 h-11 sm:h-9 min-h-11 sm:min-h-9 px-2 sm:px-3 text-xs sm:text-sm font-medium gap-1.5"
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
            className="flex-1 sm:flex-initial min-w-0 h-11 sm:h-9 min-h-11 sm:min-h-9 text-xs sm:text-sm font-medium cursor-pointer border-border/80 hover:bg-muted/50 px-2 sm:px-3"
            aria-label={`View uploaded photo for ${work.title}`}
          >
            <Eye data-icon="inline-start" aria-hidden="true" />
            <span className="truncate sm:hidden">Photo</span>
            <span className="hidden sm:inline">View photo</span>
          </Button>
        )}

        {!isScored && !closed && !isProcessing && onReplacePhoto && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onReplacePhoto}
            className="flex-1 sm:flex-initial min-w-0 h-11 sm:h-9 min-h-11 sm:min-h-9 text-xs sm:text-sm font-medium cursor-pointer border-border/80 hover:bg-muted/50 px-2 sm:px-3"
            aria-label={`Replace photo for ${work.title}`}
          >
            <Camera data-icon="inline-start" aria-hidden="true" />
            <span className="truncate sm:hidden">Replace</span>
            <span className="hidden sm:inline">Replace photo</span>
          </Button>
        )}

        {isScored && onViewScoredHistory && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() =>
              onViewScoredHistory({
                activityId: work.id,
                submissionId: submission?.submissionId ?? null,
              })
            }
            className="flex-1 sm:flex-initial min-w-0 h-11 sm:h-9 min-h-11 sm:min-h-9 text-xs sm:text-sm font-medium cursor-pointer px-2 sm:px-3"
          >
            <span className="truncate sm:hidden">Feedback</span>
            <span className="hidden sm:inline">View feedback</span>
          </Button>
        )}
      </ItemActions>
    </Item>
  );
}

function ActivityCard({
  work,
  teacherName,
  activityId,
  targetText,
  createdAt,
  childId,
  now,
  initialSubmission,
  onUploadClick,
  onPreviewPhoto,
  hasUnreadComments,
}: {
  work: TakeHomeActivity;
  teacherName?: string;
  activityId: string;
  targetText: string;
  createdAt: string;
  childId: string | null;
  now: number;
  initialSubmission?: TakeHomeActivitySubmission | null;
  onUploadClick: () => void;
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
    <Card
      size="sm"
      className={cn(
        "group relative justify-between rounded-xl sm:rounded-2xl sm:[--card-spacing:--spacing(5)] hover:shadow-md transition-[border-color,box-shadow] duration-200",
        isRejected || latestRejected
          ? "border-warning/50 bg-warning/5 hover:border-warning/80"
          : isReturned
            ? "border-primary/40 bg-primary/5 hover:border-primary/60"
            : "hover:border-primary/40"
      )}
    >
      <CardHeader className="gap-1">
        {/* Title */}
        <CardTitle as="h3" className="text-base font-semibold leading-snug text-foreground" title={work.title}>
          {work.title}
        </CardTitle>

        {/* Metadata line: Due date + word count */}
        <CardDescription className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs font-sans tabular-nums">
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
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3">
        {/* Cursive Practice Desk: 3-line Guidelines Specimen */}
        <WorksheetPrompt
          text={targetText}
          footer={
            targetText.trim() ? (
              <p className="font-sans text-xs text-muted-foreground leading-snug break-words py-0.5">
                {normalizeActivityPrompt(targetText)}
              </p>
            ) : undefined
          }
        />

        {work.instructions && (
          <p className="whitespace-pre-wrap text-xs text-muted-foreground leading-relaxed">
            {work.instructions}
          </p>
        )}

        {/* Consolidated Status Notice (single clear callout per card) */}
        {rejectionSummary && !isProcessing && (
          <Alert className="rounded-lg bg-warning/15 border-warning/30 px-3 py-2 text-xs text-warning-foreground gap-1">
            <AlertTitle className="font-semibold">
              {`Clearer photo needed · ${rejectionSummary.label}`}
            </AlertTitle>
            <AlertDescription className="text-xs text-foreground/85 leading-relaxed">
              {rejectionSummary.detail.endsWith(".")
                ? rejectionSummary.detail
                : `${rejectionSummary.detail}.`}
              {hasKeptCompletedPhoto ? " Your earlier photo is still on file." : ""}
            </AlertDescription>
          </Alert>
        )}

        {isReturned && !excused && !rejectionSummary && !isProcessing && (
          <Alert className="rounded-lg bg-primary/10 border-primary/20 px-3 py-2 text-xs gap-1">
            <AlertTitle className="font-semibold text-primary">
              New photo requested
            </AlertTitle>
            {(work.workState?.return_reason || work.workState?.return_note) && (
              <AlertDescription className="flex flex-col gap-1 text-xs">
                {work.workState?.return_reason && (
                  <p className="font-medium text-foreground">
                    {humanizeReason(work.workState.return_reason)}
                  </p>
                )}
                {work.workState?.return_note && (
                  <p className="text-muted-foreground leading-relaxed">{work.workState.return_note}</p>
                )}
              </AlertDescription>
            )}
          </Alert>
        )}

        {closed && !excused && category === "closed" && (
          <p className="text-xs text-muted-foreground">
            {work.attempts.length > 0 || submission?.submissionId
              ? "Deadline passed. Use Comments to ask your teacher for late submission."
              : "Deadline passed. Contact your teacher directly for late submission."}
          </p>
        )}
      </CardContent>

      {/* Action Footer */}
      <CardFooter className="flex-col items-stretch gap-2 border-t border-border/60 pt-3">
        {/* Status / processing message if active */}
        {isLoading ? (
          <div role="status" aria-live="polite" aria-label="Checking worksheet status" className="w-full">
            <span className="sr-only">Checking worksheet status</span>
            <Skeleton aria-hidden="true" className="h-11 sm:h-9 w-full rounded-lg" />
          </div>
        ) : isProcessing ? (
          <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 py-1 text-xs text-muted-foreground w-full">
            <Spinner className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
            <span className="font-medium text-foreground">
              {isCompleted ? "Checking new photo…" : "Checking handwriting…"}
            </span>
          </div>
        ) : (
          <>
            {/* Kept photo status row (secondary state if an earlier scored photo is preserved) */}
            {hasKeptCompletedPhoto && (
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Clock3 className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="font-medium truncate text-foreground/80">
                    {work.workState?.work_status === "Released"
                      ? "Scored photo kept"
                      : "Previous photo kept"}
                  </span>
                  {submission?.compositeScore != null && (
                    <BandBadge
                      score={submission.compositeScore}
                      band={submission.compositeBand}
                      size="sm"
                    />
                  )}
                </div>
                {submission?.imagePath && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={openPreview}
                    className="h-11 sm:h-8 px-3 sm:px-2 text-xs font-medium text-primary hover:text-primary shrink-0 cursor-pointer touch-manipulation"
                    aria-label={`View kept photo for ${work.title}`}
                  >
                    <Eye data-icon="inline-start" aria-hidden="true" />
                    <span>View photo</span>
                  </Button>
                )}
              </div>
            )}

            {/* Main Action Bar: Cohesive single row with clear primary/secondary balance */}
            <div className="flex items-center gap-1.5 sm:gap-2 w-full">
              {/* Secondary utility: Notes with teacher */}
              {childId && (work.attempts.length || submission?.submissionId) ? (
                <WorkCommentsButton
                  scope={{ activityId, studentId: childId }}
                  activeSubmissionId={work.workState?.active_submission_id ?? null}
                  activityTitle={work.title}
                  teacherName={teacherName}
                  audience="parent"
                  hasUnread={hasUnreadComments}
                  worksheetContext={{
                    targetText,
                    canSendNewPhoto: (isRejected || isReturned) && !closed && !isProcessing,
                    onViewWorksheet: submission?.imagePath ? openPreview : undefined,
                    onSendNewPhoto: !closed ? onUploadClick : undefined,
                  }}
                  className="shrink-0 h-11 sm:h-9 px-2.5 sm:px-3 text-xs sm:text-sm font-medium gap-1.5"
                />
              ) : null}

              {/* Primary CTA: Clear call to action filling remaining width */}
              <Button
                variant="default"
                size="sm"
                className="flex-1 min-w-0 h-11 sm:h-9 font-semibold cursor-pointer text-xs sm:text-sm px-3.5 shadow-warm-sm touch-manipulation"
                onClick={onUploadClick}
                disabled={closed}
                aria-label={`${isRejected || isReturned ? "Send new photo" : "Send photo"} for ${work.title}`}
              >
                <Camera data-icon="inline-start" aria-hidden="true" />
                <span className="truncate">
                  {isRejected || isReturned ? "Send new photo" : "Send photo"}
                </span>
              </Button>
            </div>
          </>
        )}
      </CardFooter>
    </Card>
  );
}

function PhotoPreviewDialog({
  open,
  onOpenChange,
  activityId,
  teacherName,
  childId,
  hasUnreadComments,
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
  activityId?: string;
  teacherName?: string;
  childId?: string | null;
  hasUnreadComments?: boolean;
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
  const { data: imageUrl, isLoading, isError, refetch } = useSubmissionImageUrl(imagePath);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const deleteMutation = useDeleteSubmission();

  const handleDelete = async () => {
    if (!submissionId) return;
    try {
      await deleteMutation.mutateAsync(submissionId);
      toast.add({ type: "success", title: "Photo removed. You can send a new photo anytime." });
      setIsDeleteDialogOpen(false);
      onOpenChange(false);
    } catch {
      toast.add({ type: "error", title: "We couldn't remove the photo. Please check your connection and try again." });
    }
  };

  return (
    <>
      <ResponsiveRichOverlay open={open} onOpenChange={onOpenChange}>
        <ResponsiveRichOverlayContent className="w-[calc(100%-1.5rem)] sm:max-w-3xl max-h-[90dvh] p-0 gap-0 overflow-hidden flex flex-col shadow-warm">
          <ResponsiveRichOverlayHeader className="p-4 sm:p-5 border-b border-border/70">
            <div className="flex items-start justify-between gap-2 pr-12 md:pr-9">
              <div className="min-w-0 flex flex-col gap-1">
                <ResponsiveRichOverlayTitle className="font-heading text-base sm:text-lg font-semibold text-foreground break-words">
                  {title}
                </ResponsiveRichOverlayTitle>
                {(childName || statusLabel) && (
                  <p className="text-xs font-medium text-muted-foreground">
                    {[childName, statusLabel].filter(Boolean).join(" · ")}
                  </p>
                )}
                <ResponsiveRichOverlayDescription className="text-xs text-muted-foreground italic break-words line-clamp-2">
                  &ldquo;{normalizeActivityPrompt(targetText)}&rdquo;
                </ResponsiveRichOverlayDescription>
              </div>

              {canDelete && submissionId && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        disabled={deleteMutation.isPending}
                        className="-mt-1 size-11 md:size-8 rounded-lg border-border/70 shrink-0 text-muted-foreground hover:text-foreground cursor-pointer touch-manipulation"
                        aria-label="Worksheet options"
                      />
                    }
                  >
                    <MoreHorizontal aria-hidden="true" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 rounded-xl">
                    <DropdownMenuGroup>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setIsDeleteDialogOpen(true)}
                      >
                        <Trash2 aria-hidden="true" />
                        <span>Delete upload</span>
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </ResponsiveRichOverlayHeader>

          <ResponsiveRichOverlayBody className="p-4 sm:p-5">
            <WorksheetImageInspector
              imageUrl={imageUrl}
              altText={`Uploaded handwriting worksheet for ${title}`}
              isLoading={isLoading}
              isError={isError}
              onRetry={() => {
                void refetch();
              }}
              headerLabel="Uploaded Worksheet Photo"
              imageToolsDisclosure={true}
              flatFrame={true}
              aspectRatioClass="h-[260px] sm:h-[360px] lg:min-h-[420px] lg:max-h-[min(600px,calc(100dvh-18rem))]"
            />
          </ResponsiveRichOverlayBody>

          {((activityId && childId && submissionId) ||
            (canSendNewPhoto && onSendNewPhoto)) && (
            <ResponsiveRichOverlayFooter
              showCloseButton={false}
              className="border-t border-border sm:p-4 sm:items-center sm:justify-end bg-background"
            >
              <div className="flex w-full items-center gap-2 sm:w-auto sm:justify-end">
                {activityId && childId && submissionId && (
                  <WorkCommentsButton
                    scope={{ activityId, studentId: childId }}
                    activeSubmissionId={submissionId}
                    activityTitle={title}
                    teacherName={teacherName}
                    audience="parent"
                    hasUnread={hasUnreadComments}
                    className="flex-1 sm:flex-initial min-w-0 h-11 sm:h-9 min-h-11 sm:min-h-9 text-xs sm:text-sm font-medium gap-1.5 px-3"
                  />
                )}
                {canSendNewPhoto && onSendNewPhoto && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onSendNewPhoto}
                    className="flex-1 sm:flex-initial min-w-0 h-11 sm:h-9 min-h-11 sm:min-h-9 text-xs sm:text-sm font-medium px-3 cursor-pointer"
                  >
                    <Camera data-icon="inline-start" aria-hidden="true" />
                    <span className="truncate">Send new photo</span>
                  </Button>
                )}
              </div>
            </ResponsiveRichOverlayFooter>
          )}
        </ResponsiveRichOverlayContent>
      </ResponsiveRichOverlay>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this upload?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes your uploaded photo and notes for &ldquo;{title}&rdquo;. This action cannot be undone, and you can send a new photo anytime.
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
                  <Spinner data-icon="inline-start" aria-hidden="true" />
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
