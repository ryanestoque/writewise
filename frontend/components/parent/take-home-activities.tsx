"use client";

import {
  useTakeHomeActivities,
  useChildSubmissionForActivity,
} from "@/lib/hooks/use-parent-data";
import { BandBadge } from "@/components/shared/band-badge";
import { Button } from "@/components/ui/button";
import { Upload, ClipboardList, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface TakeHomeActivitiesProps {
  childId: string | null;
  onUploadClick: (activityId: string) => void;
}

export function TakeHomeActivities({
  childId,
  onUploadClick,
}: TakeHomeActivitiesProps) {
  const { data: activities, isLoading } = useTakeHomeActivities(childId);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-2">
        <Loader2 className="size-5 animate-spin motion-reduce:animate-none text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Loading assigned activities...</span>
      </div>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card shadow-warm p-8 text-center space-y-3">
        <div className="flex justify-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300">
            <ClipboardList className="size-6" />
          </div>
        </div>
        <h3 className="font-heading text-base font-semibold text-foreground">
          No take-home activities assigned yet
        </h3>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
          Your child&apos;s teacher will assign cursive practice activities here when ready for home practice.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3.5 sm:grid-cols-2">
      {activities.map((activity) => (
        <TakeHomeActivityCard
          key={activity.id}
          activityId={activity.id}
          targetText={activity.targetText}
          createdAt={activity.createdAt}
          childId={childId}
          onUploadClick={() => onUploadClick(activity.id)}
        />
      ))}
    </div>
  );
}

function TakeHomeActivityCard({
  activityId,
  targetText,
  createdAt,
  childId,
  onUploadClick,
}: {
  activityId: string;
  targetText: string;
  createdAt: string;
  childId: string | null;
  onUploadClick: () => void;
}) {
  const { data: submission, isLoading } = useChildSubmissionForActivity(
    childId,
    activityId
  );

  const formattedDate = new Date(createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="rounded-xl border border-border bg-card shadow-warm p-4 sm:p-5 flex flex-col justify-between gap-3.5 transition-shadow hover:shadow-md">
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground font-medium">Assigned {formattedDate}</p>
        <p className="text-sm font-semibold text-foreground line-clamp-3 leading-snug">
          &ldquo;{targetText}&rdquo;
        </p>
      </div>

      <div className="pt-2 border-t border-border/50 flex flex-wrap items-center justify-between gap-2.5">
        {isLoading ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
            <span>Checking status...</span>
          </div>
        ) : submission ? (
          <div className="space-y-2 w-full">
            <div className="flex items-center justify-between gap-2 w-full">
              {submission.status === "completed" ? (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 dark:text-brand-300">
                    <CheckCircle2 className="size-4 shrink-0 text-brand-600 dark:text-brand-400" />
                    Completed
                  </span>
                  {submission.compositeScore != null && (
                    <BandBadge score={submission.compositeScore} size="sm" />
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>Photo rejected</span>
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                className="h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] text-xs font-medium gap-1.5 cursor-pointer shrink-0 border-border/80 hover:bg-muted/50"
                onClick={onUploadClick}
                aria-label={
                  submission.status === "completed"
                    ? `Submit another practice attempt for "${targetText}"`
                    : `Retake photo for "${targetText}"`
                }
              >
                <Upload className="size-3.5" />
                <span>{submission.status === "completed" ? "New Attempt" : "Retake"}</span>
              </Button>
            </div>

            {submission.status === "rejected" && (
              <p className="text-[11px] text-muted-foreground bg-destructive/5 border border-destructive/20 p-2 rounded-md leading-normal">
                <strong>Tip:</strong> Position the camera directly above the worksheet in bright light without shadows so cursive strokes are crisp.
              </p>
            )}
          </div>
        ) : (
          <Button
            variant="default"
            size="sm"
            className="h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] gap-1.5 shadow-warm w-full font-medium cursor-pointer"
            onClick={onUploadClick}
            aria-label={`Upload worksheet for "${targetText}"`}
          >
            <Upload className="size-4" />
            Upload Worksheet
          </Button>
        )}
      </div>
    </div>
  );
}
