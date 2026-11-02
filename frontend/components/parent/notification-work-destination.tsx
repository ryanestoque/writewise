"use client";

import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useParentNotificationWork } from "@/lib/hooks/use-parent-data";
import { formatActivityDueAt } from "@/lib/utils/activity-deadlines";
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
}: {
  userId: string;
  target: ParentNotificationTarget | null;
  childName: string;
  onClose: () => void;
}) {
  const work = useParentNotificationWork(userId, target);
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
      />
    );
  }
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
          <p role="status">Loading activity…</p>
        ) : work.status === "error" ? (
          <div className="flex flex-col items-start gap-3" role="alert">
            <p>Could not load this work. Please try again.</p>
            <Button variant="outline" onClick={work.retry}>
              Try again
            </Button>
          </div>
        ) : work.status === "unavailable" ? (
          <p>This work is no longer available.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm">{work.activity.target_text}</p>
            {work.activity.instructions && (
              <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                {work.activity.instructions}
              </p>
            )}
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Status</dt>
              <dd>{work.work.work_status === "Draft" ? "Turned in" : work.work.work_status}</dd>
              <dt className="text-muted-foreground">Due</dt>
              <dd>
                {work.work.effective_due_at
                  ? formatActivityDueAt(work.work.effective_due_at)
                  : "No deadline"}
              </dd>
            </dl>
            {work.work.return_note && (
              <p className="rounded-lg border p-3 text-sm whitespace-pre-wrap">
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
        <Button variant="outline" onClick={onClose}>
          Back to progress
        </Button>
      </DialogContent>
    </Dialog>
  );
}
