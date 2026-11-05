"use client";

import { Camera } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { WorksheetImageInspector } from "@/components/shared/worksheet-image-inspector";
import { useSubmissionImageUrl } from "@/lib/hooks/use-submissions";
import type { StudentScoreHistoryItem } from "@/lib/hooks/use-dashboard";

export function PendingWorksheetDialog({
  item,
  childName,
  onBack,
  backLabel = "Back to history",
  onUploadActivity,
}: {
  item: StudentScoreHistoryItem;
  childName: string;
  onBack: () => void;
  backLabel?: string;
  onUploadActivity?: (activityId: string) => void;
}) {
  const image = useSubmissionImageUrl(item.imagePath ?? null);
  const canSendNewPhoto = Boolean(
    onUploadActivity &&
      item.isTakeHome &&
      item.activityId &&
      (item.status === "returned" || item.status === "rejected")
  );

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onBack();
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Worksheet photo</DialogTitle>
          <DialogDescription>
            {childName} · {item.targetText}
          </DialogDescription>
        </DialogHeader>
        <p className="text-muted-foreground text-sm">
          {item.status === "returned"
            ? "Your teacher requested another attempt. This photo is kept in history."
            : item.status === "rejected"
              ? "This photo needs another upload."
              : "Your teacher will share the result after review."}
        </p>
        {item.returnNote && (
          <p className="rounded-lg border border-border/80 bg-muted/30 p-3 text-sm whitespace-pre-wrap">
            {item.returnNote}
          </p>
        )}
        <WorksheetImageInspector
          imageUrl={image.data}
          isLoading={image.isLoading}
          isError={image.isError}
          onRetry={() => image.refetch()}
          altText={`Worksheet uploaded for ${item.targetText}`}
        />
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <Button
            variant="outline"
            onClick={onBack}
            className="h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] cursor-pointer"
          >
            {backLabel}
          </Button>
          {canSendNewPhoto && (
            <Button
              type="button"
              onClick={() => {
                onBack();
                onUploadActivity?.(item.activityId);
              }}
              className="h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] gap-1.5 font-semibold cursor-pointer"
            >
              <Camera className="size-4" aria-hidden="true" />
              <span>Send new photo</span>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
