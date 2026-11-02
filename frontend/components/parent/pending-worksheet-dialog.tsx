"use client";

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
}: {
  item: StudentScoreHistoryItem;
  childName: string;
  onBack: () => void;
}) {
  const image = useSubmissionImageUrl(item.imagePath ?? null);
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
        {item.returnNote && <p className="text-sm whitespace-pre-wrap">{item.returnNote}</p>}
        <WorksheetImageInspector
          imageUrl={image.data}
          isLoading={image.isLoading}
          isError={image.isError}
          onRetry={() => image.refetch()}
          altText={`Worksheet uploaded for ${item.targetText}`}
        />
        <Button variant="outline" onClick={onBack}>
          Back to history
        </Button>
      </DialogContent>
    </Dialog>
  );
}
