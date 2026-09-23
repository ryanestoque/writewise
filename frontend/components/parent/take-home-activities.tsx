"use client";

import { useState } from "react";
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
import { cn } from "@/lib/utils";

interface TakeHomeActivitiesProps {
  childId: string | null;
  onUploadClick: (activityId: string) => void;
}

export function TakeHomeActivities({
  childId,
  onUploadClick,
}: TakeHomeActivitiesProps) {
  const [expanded, setExpanded] = useState(false);
  const { data: activities, isLoading } = useTakeHomeActivities(childId);

  if (isLoading) {
    return (
      <div role="status" aria-live="polite" className="flex flex-col items-center justify-center py-8 gap-2">
        <Loader2 className="size-5 animate-spin motion-reduce:animate-none text-muted-foreground" aria-hidden="true" />
        <span className="text-xs text-muted-foreground">Loading assigned activities...</span>
      </div>
    );
  }

  if (!activities || activities.length === 0) {
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
    activities.length > 2 && !expanded ? activities.slice(0, 2) : activities;

  return (
    <div className="space-y-3">
      <div id="take-home-activities-grid" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {visibleActivities.map((activity) => (
          <ActivityCard
            key={activity.id}
            activityId={activity.id}
            targetText={activity.targetText}
            createdAt={activity.createdAt}
            childId={childId}
            initialSubmission={activity.submission}
            onUploadClick={() => onUploadClick(activity.id)}
          />
        ))}
      </div>

      {activities.length > 2 && (
        <div className="flex justify-center pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((prev) => !prev)}
            aria-expanded={expanded}
            aria-controls="take-home-activities-grid"
            className="h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 gap-1.5 cursor-pointer rounded-lg border border-border/50 bg-card shadow-2xs"
          >
            {expanded ? (
              <>
                <ChevronUp className="size-3.5" aria-hidden="true" />
                <span>Show fewer activities</span>
              </>
            ) : (
              <>
                <ChevronDown className="size-3.5" aria-hidden="true" />
                <span>View all assigned activities ({activities.length})</span>
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
}: {
  activityId: string;
  targetText: string;
  createdAt: string;
  childId: string | null;
  initialSubmission?: TakeHomeActivitySubmission | null;
  onUploadClick: () => void;
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

  return (
    <div
      className={cn(
        "rounded-xl border bg-card shadow-warm p-4 sm:p-5 flex flex-col justify-between gap-3.5 transition-all hover:shadow-md",
        needsUpload
          ? "border-brand-500/40 dark:border-brand-500/30 bg-brand-50/15 dark:bg-brand-950/15 ring-1 ring-brand-500/20"
          : "border-border"
      )}
    >
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground font-medium">Assigned {formattedDate}</p>
        <p className="text-sm font-semibold text-foreground line-clamp-3 leading-snug">
          &ldquo;{targetText}&rdquo;
        </p>
      </div>

      <div className="pt-2 border-t border-border/50 flex flex-wrap items-center justify-between gap-2.5">
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
                variant="default"
                size="sm"
                className="h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] gap-1.5 shadow-warm w-full font-medium cursor-pointer"
                onClick={onUploadClick}
                aria-label={`Take another photo for "${targetText}"`}
              >
                <Upload className="size-4" aria-hidden="true" />
                <span>Take Another Photo</span>
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
          <div className="space-y-1.5 w-full">
            <Button
              variant="default"
              size="sm"
              className="h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] gap-1.5 shadow-warm w-full font-medium cursor-pointer"
              onClick={onUploadClick}
              aria-label={`Upload worksheet for "${targetText}"`}
            >
              <Upload className="size-4" aria-hidden="true" />
              Upload Worksheet
            </Button>
            <p className="text-xs text-muted-foreground leading-tight text-center">
              Tip: Lay flat under bright lighting with all 4 corners in frame
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
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2 cursor-pointer"
              >
                {deleteMutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="size-4" aria-hidden="true" />
                    <span>Delete Submission</span>
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
