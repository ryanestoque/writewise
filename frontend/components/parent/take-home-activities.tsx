"use client";

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
import type { TakeHomeActivitySubmission } from "@/lib/hooks/use-parent-data";
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
  gridClassName = "grid grid-cols-1 sm:grid-cols-2 gap-4",
  practiceFocusKey,
}: TakeHomeActivitiesProps) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;
  const toggleExpanded = onToggleExpanded || (() => setInternalExpanded((prev) => !prev));
  const { data: activities, isLoading } = useTakeHomeActivities(childId);

  // Intelligently prioritize activities: Photo Retake Needed first, then Practice Focus match, then newest
  const sortedActivities = useMemo(() => {
    if (!activities) return [];
    return [...activities].sort((a, b) => {
      // 1. Rejected needs photo retake first
      const aRejected = a.submission?.status === "rejected";
      const bRejected = b.submission?.status === "rejected";
      if (aRejected && !bRejected) return -1;
      if (!aRejected && bRejected) return 1;

      // 2. Matches child's current practice focus
      if (practiceFocusKey) {
        const aMatches = getActivitySkillMeta(a.targetText).criterionKey === practiceFocusKey;
        const bMatches = getActivitySkillMeta(b.targetText).criterionKey === practiceFocusKey;
        if (aMatches && !bMatches) return -1;
        if (!aMatches && bMatches) return 1;
      }

      // 3. Newest first
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [activities, practiceFocusKey]);

  if (isLoading) {
    return (
      <div role="status" aria-live="polite" className="flex flex-col items-center justify-center py-8 gap-2">
        <Loader2 className="size-5 animate-spin motion-reduce:animate-none text-muted-foreground" aria-hidden="true" />
        <span className="text-xs text-muted-foreground">Loading assigned activities...</span>
      </div>
    );
  }

  if (!sortedActivities || sortedActivities.length === 0) {
    return (
      <Empty className="border border-border rounded-xl shadow-warm bg-card py-10">
        <EmptyMedia variant="icon" className="bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300">
          <ClipboardList className="size-6" />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle>No Take-Home Worksheets Due Yet</EmptyTitle>
          <EmptyDescription className="text-xs sm:text-sm max-w-md mx-auto">
            Your child&apos;s teacher will assign practice activities here as classroom cursive lessons progress. No immediate submission is needed.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const visibleActivities =
    sortedActivities.length > 2 && !isExpanded
      ? sortedActivities.slice(0, 2)
      : sortedActivities;

  return (
    <div className="space-y-3">
      <div id="take-home-activities-grid" className={cn(gridClassName)}>
        {visibleActivities.map((activity) => (
          <ActivityCard
            key={activity.id}
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

      {sortedActivities.length > 2 && showExpandButton && (
        <div className="flex justify-center pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggleExpanded}
            aria-expanded={isExpanded}
            aria-controls="take-home-activities-grid"
            className="h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 gap-1.5 cursor-pointer rounded-lg border border-border/50 bg-card shadow-2xs"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="size-3.5" aria-hidden="true" />
                <span>Show fewer activities</span>
              </>
            ) : (
              <>
                <ChevronDown className="size-3.5" aria-hidden="true" />
                <span>View all assigned activities ({sortedActivities.length})</span>
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

function ActivityCard({
  activityId,
  targetText,
  createdAt,
  childId,
  initialSubmission,
  onUploadClick,
  practiceFocusKey,
}: {
  activityId: string;
  targetText: string;
  createdAt: string;
  childId: string | null;
  initialSubmission?: TakeHomeActivitySubmission | null;
  onUploadClick: () => void;
  practiceFocusKey?: CriterionKey | null;
}) {
  // Only query individually if initialSubmission was not provided by parent query
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
      toast.success("Submission removed. You can upload a new photo anytime.");
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

  const isProcessing = submission?.status === "processing";
  const isCompleted = submission?.status === "completed";
  const isRejected = submission?.status === "rejected";

  const needsUpload = !submission || isRejected;

  const skillMeta = useMemo(() => getActivitySkillMeta(targetText), [targetText]);
  const isPracticeFocusMatch =
    practiceFocusKey != null && skillMeta.criterionKey === practiceFocusKey;

  return (
    <div
      className={cn(
        "rounded-xl border bg-card shadow-warm p-3.5 sm:p-4 flex flex-col justify-between gap-2.5 transition-all hover:shadow-md",
        isRejected
          ? "border-warning/50 dark:border-warning/60 bg-warning/5 dark:bg-warning/10"
          : isPracticeFocusMatch && needsUpload
            ? "border-amber-300/80 dark:border-amber-700/70 bg-amber-50/25 dark:bg-amber-950/20"
            : "border-border/80 hover:border-border"
      )}
    >
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-1.5 flex-wrap">
          <p className="text-[11px] text-muted-foreground font-medium">Assigned {formattedDate}</p>
          <span
            className={cn(
              "inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-md border shrink-0 transition-colors",
              isPracticeFocusMatch
                ? "bg-amber-100/90 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border-amber-300/80 dark:border-amber-700/80 shadow-2xs"
                : "bg-muted/70 text-muted-foreground border-border/60"
            )}
          >
            {isPracticeFocusMatch && (
              <span className="size-1.5 rounded-full bg-amber-600 dark:bg-amber-400 mr-1 shrink-0" aria-hidden="true" />
            )}
            {isPracticeFocusMatch
              ? `Priority Focus • ${skillMeta.shortLabel}`
              : `Focus: ${skillMeta.shortLabel}`}
          </span>
        </div>
        <p className="text-sm font-semibold text-foreground line-clamp-2 leading-snug">
          &ldquo;{targetText}&rdquo;
        </p>
      </div>

      <div className="pt-2 border-t border-border/50 flex flex-wrap items-center justify-between gap-2">
        {isLoading ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            <span>Checking status...</span>
          </div>
        ) : isRejected ? (
          <div className="space-y-2.5 w-full">
            {(() => {
              const rejection = getRejectionSummary(submission.rejectionCode);
              return (
                <div
                  role="status"
                  aria-live="polite"
                  className="space-y-1.5 text-xs bg-warning/10 dark:bg-warning/20 border border-warning/40 dark:border-warning/50 p-3 rounded-lg leading-normal shadow-2xs"
                >
                  <div className="flex items-center gap-1.5 font-semibold text-warning-foreground text-xs">
                    <Camera className="size-3.5 shrink-0 text-warning-foreground" aria-hidden="true" />
                    <span>Photo Retake Needed: {rejection.label}</span>
                  </div>
                  <p className="text-xs text-foreground/90 leading-relaxed pl-5">
                    {rejection.detail}
                  </p>
                </div>
              );
            })()}

            <div className="space-y-1.5 w-full">
              <Button
                variant="outline"
                size="sm"
                className="h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] gap-1.5 w-full font-medium cursor-pointer border-warning/50 dark:border-warning/60 bg-warning/10 dark:bg-warning/20 hover:bg-warning/20 dark:hover:bg-warning/30 text-warning-foreground transition-colors shadow-2xs"
                onClick={onUploadClick}
                aria-label={`Retake photo for "${targetText}"`}
              >
                <Camera className="size-4 text-warning-foreground" aria-hidden="true" />
                <span>Retake Photo</span>
              </Button>
              <p className="text-xs text-muted-foreground leading-tight text-center">
                Tip: Lay flat under bright lighting with all 4 corners in frame
              </p>
            </div>
          </div>
        ) : submission ? (
          <div className="space-y-2 w-full">
            <div className="flex items-center justify-between gap-2 w-full">
              {isCompleted ? (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 dark:text-brand-300">
                    <CheckCircle2 className="size-4 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                    Completed
                  </span>
                  {submission.compositeScore != null && (
                    <BandBadge score={submission.compositeScore} size="sm" />
                  )}
                </div>
              ) : (
                <div role="status" aria-live="polite" className="flex items-center gap-2 min-w-0">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-warning-foreground bg-warning/15 dark:bg-warning/25 px-2.5 py-0.5 rounded-md border border-warning/30 shadow-2xs">
                    <Loader2 className="size-3.5 shrink-0 animate-spin motion-reduce:animate-none text-warning-foreground" aria-hidden="true" />
                    Analyzing handwriting…
                  </span>
                </div>
              )}

              <div className="flex items-center gap-1.5 shrink-0">
                {submission?.canDelete && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsDeleteDialogOpen(true)}
                    disabled={deleteMutation.isPending}
                    className="h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] text-xs font-medium text-destructive hover:bg-destructive/10 hover:text-destructive gap-1 px-2.5 rounded-lg border border-destructive/20 cursor-pointer"
                    title="Delete this submission"
                    aria-label="Delete this submission"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                    <span className="hidden sm:inline">Delete</span>
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] text-xs font-medium gap-1.5 cursor-pointer shrink-0 border-border/80 hover:bg-muted/50"
                  onClick={onUploadClick}
                  disabled={isProcessing}
                  aria-label={
                    isCompleted
                      ? `Submit another practice attempt for "${targetText}"`
                      : `Worksheet "${targetText}" is currently being analyzed`
                  }
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                      <span>In Progress</span>
                    </>
                  ) : (
                    <>
                      <Upload className="size-3.5" aria-hidden="true" />
                      <span>Practice Again</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            {isProcessing && (
              <p
                role="status"
                aria-live="polite"
                className="text-xs text-muted-foreground bg-muted/40 border border-border/60 p-2.5 rounded-md leading-normal"
              >
                Analyzing your child&apos;s handwriting now (usually takes 10–20 seconds). Results will appear automatically.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-1 w-full">
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] gap-1.5 w-full font-medium cursor-pointer transition-colors shadow-2xs",
                isPracticeFocusMatch
                  ? "border-brand-300 dark:border-brand-700 bg-brand-50/80 hover:bg-brand-100 dark:bg-brand-950/50 dark:hover:bg-brand-900/60 text-brand-800 dark:text-brand-200"
                  : "border-border/80 hover:border-border hover:bg-muted/60 text-foreground"
              )}
              onClick={onUploadClick}
              aria-label={`Upload worksheet for "${targetText}"`}
            >
              <Upload
                className={cn(
                  "size-3.5",
                  isPracticeFocusMatch
                    ? "text-brand-700 dark:text-brand-300"
                    : "text-muted-foreground"
                )}
                aria-hidden="true"
              />
              <span>{isPracticeFocusMatch ? "Upload Practice Worksheet" : "Upload Worksheet"}</span>
            </Button>
            <p className="text-[11px] text-muted-foreground leading-tight text-center truncate">
              Flat photo • all 4 corners in frame
            </p>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this submission?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove your uploaded worksheet for &ldquo;{targetText}&rdquo;. You will be able to take and upload a new photo for this activity. This action cannot be undone.
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
                  "Delete Submission"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
