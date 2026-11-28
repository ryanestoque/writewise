"use client";

import dynamic from "next/dynamic";
import { Camera } from "lucide-react";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NotificationWorkLoadingSkeleton } from "@/components/parent/parent-portal-skeletons";
import {
  ResponsiveModal,
  ResponsiveModalBody,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@/components/shared/responsive-modal";
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
    <ResponsiveModal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <ResponsiveModalContent className="sm:max-w-lg">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>
            {work.status === "ready" ? work.activity.title : "Activity update"}
          </ResponsiveModalTitle>
          <ResponsiveModalDescription className="sr-only">
            {work.status === "ready"
              ? `Review activity instructions, due date, and submission status for ${childName}.`
              : "View your activity update."}
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <ResponsiveModalBody className="flex flex-col gap-3 px-5 py-2 md:p-0">
          {work.status === "loading" ? (
            <NotificationWorkLoadingSkeleton />
          ) : work.status === "error" ? (
            <Alert variant="destructive">
              <AlertTitle>Could not load this work</AlertTitle>
              <AlertDescription>Please try again.</AlertDescription>
              <AlertAction>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={work.retry}
                  className="h-10 sm:h-8 touch-manipulation cursor-pointer"
                >
                  Try again
                </Button>
              </AlertAction>
            </Alert>
          ) : work.status === "unavailable" ? (
            <p className="text-sm text-muted-foreground py-2">
              This work is no longer available.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <Card size="sm" className="bg-muted/30 border-border/80 py-0 shadow-none">
                <CardContent className="flex flex-col gap-1 p-3">
                  <p className="text-xs font-medium text-muted-foreground">Worksheet prompt</p>
                  <p className="text-sm font-medium text-foreground">{work.activity.target_text}</p>
                </CardContent>
              </Card>
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
                <Alert role="status" className="border-band-2/40 bg-band-2/15 p-3">
                  <AlertTitle className="text-xs font-semibold text-band-2-text">
                    Teacher note
                  </AlertTitle>
                  <AlertDescription className="text-sm text-foreground/90 whitespace-pre-wrap">
                    {work.work.return_note}
                  </AlertDescription>
                </Alert>
              )}
              {!work.assigned && (
                <p className="text-muted-foreground text-xs">
                  This activity is kept in your child&apos;s history.
                </p>
              )}
            </div>
          )}
        </ResponsiveModalBody>

        <ResponsiveModalFooter showCloseButton={false} className="pt-3.5 sm:pt-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="h-11 md:h-9 min-h-[44px] md:min-h-0 touch-manipulation cursor-pointer"
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
              className="h-11 md:h-9 min-h-[44px] md:min-h-0 font-semibold touch-manipulation cursor-pointer"
            >
              <Camera data-icon="inline-start" aria-hidden="true" />
              <span>
                {work.work.work_status === "Returned" ? "Send new photo" : "Send photo"}
              </span>
            </Button>
          )}
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
