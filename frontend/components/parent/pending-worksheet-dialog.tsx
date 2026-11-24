"use client";

import { useMemo } from "react";
import { Camera, ArrowLeft } from "lucide-react";
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
import { SubmissionCommentTabs } from "@/components/comments/submission-comment-tabs";

interface PendingWorksheetDialogProps {
  item: StudentScoreHistoryItem;
  childName: string;
  onBack: () => void;
  backLabel?: string;
  initialView?: "details" | "comments";
  onUploadActivity?: (activityId: string) => void;
}

export function PendingWorksheetDialog({
  item,
  childName,
  onBack,
  backLabel = "Back to history",
  initialView = "details",
  onUploadActivity,
}: PendingWorksheetDialogProps) {
  const image = useSubmissionImageUrl(item.imagePath ?? null);
  const canSendNewPhoto = Boolean(
    onUploadActivity &&
    item.isTakeHome &&
    item.activityId &&
    (item.status === "returned" || item.status === "rejected")
  );

  const formattedDate = useMemo(() => {
    return new Date(item.submissionDate).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, [item.submissionDate]);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onBack();
      }}
    >
      <DialogContent className="w-[calc(100%-1.5rem)] sm:max-w-3xl lg:max-w-4xl max-h-[min(94dvh,calc(100vh-2rem))] p-0 gap-0 overflow-hidden flex flex-col shadow-warm">
        {/* Header matching WorksheetViewDialog */}
        <DialogHeader className="p-4 sm:p-5 pb-3 border-b border-border bg-card/80">
          <div className="flex items-center justify-between gap-3 pr-10">
            <div className="min-w-0 space-y-1">
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 dark:text-brand-300 hover:text-brand-800 dark:hover:text-brand-200 transition-colors cursor-pointer group mb-0.5 touch-manipulation min-h-[40px] sm:min-h-[36px] px-2 py-1 rounded-md focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
                <span>{backLabel}</span>
              </button>
              <DialogTitle className="font-heading text-base sm:text-lg font-semibold text-foreground truncate">
                Worksheet &amp; Review Status
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                <span className="font-medium text-foreground">{childName}</span>
                <span>&middot;</span>
                <span className="font-sans tabular-nums">{formattedDate}</span>
                {item.targetText && (
                  <>
                    <span>&middot;</span>
                    <span className="italic truncate max-w-xs sm:max-w-md" title={item.targetText}>
                      &ldquo;{item.targetText}&rdquo;
                    </span>
                  </>
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Content Body: Unified Multimodal Split View */}
        <SubmissionCommentTabs
          key={item.submissionId}
          submissionId={item.submissionId}
          studentName={childName}
          initialView={initialView}
          commentsLabel="Notes"
          open
        >
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left Column: Photo Inspector */}
            <div className="lg:col-span-7 flex flex-col justify-center w-full gap-3">
              <WorksheetImageInspector
                imageUrl={image.data}
                altText={`Handwriting worksheet submitted for ${childName}`}
                isLoading={image.isLoading}
                isError={image.isError}
                onRetry={() => image.refetch()}
                headerLabel="Uploaded Worksheet Photo"
                imageToolsDisclosure={true}
                aspectRatioClass="h-[230px] sm:h-[320px] lg:h-auto lg:min-h-[420px] lg:max-h-[min(640px,calc(100dvh-14rem))]"
              />
            </div>

            {/* Right Column: Status & Teacher Note */}
            <div className="lg:col-span-5 space-y-4 w-full">
              <div className="p-4 sm:p-5 rounded-xl border border-border bg-card space-y-4 shadow-warm-sm">
                {/* Status Headline & Explanation */}
                <div className="space-y-1.5">
                  <h3 className="font-heading text-base font-semibold text-foreground">
                    {item.status === "returned"
                      ? "New photo requested"
                      : item.status === "rejected"
                        ? "Clearer photo needed"
                        : "Waiting for teacher review"}
                  </h3>

                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {item.status === "returned"
                      ? "Your teacher asked for another photo. Earlier uploads stay saved in history."
                      : item.status === "rejected"
                        ? "This photo couldn't be read clearly. Retake it flat in even light."
                        : "Worksheet received. Feedback will appear here once your teacher shares it."}
                  </p>
                </div>

                {/* Teacher Return Note if present (flat, border-divided) */}
                {item.returnNote && (
                  <div className="border-t border-border/70 pt-3 space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground">
                      Teacher note
                    </p>
                    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                      {item.returnNote}
                    </p>
                  </div>
                )}

                {/* Primary Action */}
                {canSendNewPhoto && (
                  <div className="pt-2 border-t border-border/60">
                    <Button
                      type="button"
                      onClick={() => {
                        onBack();
                        onUploadActivity?.(item.activityId);
                      }}
                      className="w-full h-10 min-h-[40px] gap-2 font-semibold cursor-pointer"
                    >
                      <Camera className="size-4" aria-hidden="true" />
                      <span>Send new photo</span>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        </SubmissionCommentTabs>
      </DialogContent>
    </Dialog>
  );
}
