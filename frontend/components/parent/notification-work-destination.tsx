"use client";

import dynamic from "next/dynamic";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useActivityNow } from "@/components/activities/activity-work-status";
import { useParentNotificationWork } from "@/lib/hooks/use-parent-data";
import {
  activitySubmissionsClosed,
  formatActivityDueAt,
} from "@/lib/utils/activity-deadlines";
import { PendingWorksheetDialog } from "./pending-worksheet-dialog";
import type { ParentNotificationTarget } from "@/lib/notifications/data";

const WorksheetViewDialog = dynamic(() =>
  import("./worksheet-view-dialog").then((module) => module.WorksheetViewDialog)
);

export function NotificationWorkDestination({
  userId,
  target,
  childName,
  onClose,
  onUploadActivity,
}: {
  userId: string;
  target: ParentNotificationTarget | null;
  childName: string;
  onClose: () => void;
  onUploadActivity?: (activityId: string) => void;
}) {
  const work = useParentNotificationWork(userId, target);
  const now = useActivityNow();

  if (work.status === "ready" && work.item) {
    const item = work.item;
    if (item.releasedAt && item.compositeScore !== null)
      return (
        <WorksheetViewDialog
          open
          onOpenChange={(open) => {
            if (!open) onClose();
          }}
          submissionId={item.submissionId}
          imagePath={item.imagePath ?? null}
          targetText={item.targetText}
          submissionDate={item.submissionDate}
          childName={childName}
          compositeScore={item.compositeScore}
          scoreSource={item.scoreSource}
          scores={item.scores}
          bands={item.bands}
          guideLines={item.guideLines}
          overlay={item.overlay}
          returnNote={item.returnNote}
          onBack={onClose}
          backLabel="Back to progress"
        />
      );
    return (
      <PendingWorksheetDialog
        item={item}
        childName={childName}
        onBack={onClose}
        backLabel="Back to progress"
        onUploadActivity={onUploadActivity}
      />
    );
  }

  const canUpload =
    work.status === "ready" &&
    Boolean(
      onUploadActivity &&
        work.activity.is_take_home &&
        !work.activity.is_archived &&
        work.assigned &&
        !activitySubmissionsClosed(
          {
            due_at: work.work.effective_due_at ?? work.activity.due_at,
            close_after_due: work.activity.close_after_due,
          },
          now
        )
    );

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {work.status === "ready" ? work.activity.title : "Activity update"}
          </DialogTitle>
          <DialogDescription>
            {work.status === "ready" ? childName : "View your activity update."}
          </DialogDescription>
        </DialogHeader>
        {work.status === "loading" ? (
          <div className="flex items-center gap-2.5 py-6" role="status">
            <Loader2
              className="size-4 animate-spin motion-reduce:animate-none text-muted-foreground"
              aria-hidden="true"
            />
            <span className="text-sm text-muted-foreground">Loading activity…</span>
          </div>
        ) : work.status === "error" ? (
          <div className="flex flex-col items-start gap-3 py-2" role="alert">
            <p className="text-sm text-foreground">
              Could not load this work. Please try again.
            </p>
            <Button
              variant="outline"
              onClick={work.retry}
              className="h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] cursor-pointer"
            >
              Try again
            </Button>
          </div>
        ) : work.status === "unavailable" ? (
          <p className="text-sm text-muted-foreground py-2">
            This work is no longer available.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="rounded-lg border border-border/80 bg-muted/30 p-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Worksheet prompt</p>
              <p className="text-sm font-medium text-foreground">{work.activity.target_text}</p>
            </div>
            {work.activity.instructions && (
              <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                {work.activity.instructions}
              </p>
            )}
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Status</dt>
              <dd className="font-medium text-foreground">
                {work.work.work_status === "Draft" ? "Turned in" : work.work.work_status}
              </dd>
              <dt className="text-muted-foreground">Due</dt>
              <dd className="font-sans tabular-nums text-foreground">
                {work.work.effective_due_at
                  ? formatActivityDueAt(work.work.effective_due_at)
                  : "No deadline"}
              </dd>
            </dl>
            {work.work.return_note && (
              <p className="rounded-lg border border-border/80 bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                {work.work.return_note}
              </p>
            )}
            {!work.assigned && (
              <p className="text-muted-foreground text-xs">
                This activity is kept in your child&apos;s history.
              </p>
            )}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] cursor-pointer"
          >
            Back to progress
          </Button>
          {canUpload && work.status === "ready" && (
            <Button
              type="button"
              onClick={() => {
                onClose();
                onUploadActivity?.(work.activity.id);
              }}
              className="h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] gap-1.5 font-semibold cursor-pointer"
            >
              <Camera className="size-4" aria-hidden="true" />
              <span>
                {work.work.work_status === "Returned" ? "Send new photo" : "Send photo"}
              </span>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
